// =============================================================
// Workspace context memory — persistent cross-session knowledge
// for the agent runtime.
//
// Each (user_id, workspace_path) pair accumulates a bounded ring
// of MemoryEntries.  The runner reads the top-N entries at task
// start and injects them as a historical-notes section in the
// system prompt, labelled as unverified hints to avoid the model
// treating them as ground truth.
//
// Design choices:
//   - Keyed by (user_id, workspace_path) — no cross-user leakage.
//   - Persisted to a JSON file on every write so entries survive
//     server restarts.  File path is set via AGENT_MEMORY_PATH
//     (default: ./data/agent_memory.json).
//   - MAX_ENTRIES_PER_WORKSPACE keeps memory bounded; old entries
//     are evicted FIFO when the cap is reached.
//   - API keys and file content are NEVER stored here.
// =============================================================

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Hard cap on entries per (user, workspace) to keep memory bounded.
const MAX_ENTRIES_PER_WORKSPACE: usize = 50;

/// How many recent entries to inject into the system prompt.
pub const CONTEXT_ENTRIES_TO_INJECT: usize = 10;

// ─── Entry kinds ──────────────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MemoryKind {
    /// A high-level summary of what a completed task accomplished.
    TaskSummary,
    /// A file that was created or modified.
    FileChanged,
    /// Something the agent observed about the codebase structure or behaviour.
    Observation,
}

// ─── MemoryEntry ─────────────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub id: Uuid,
    pub kind: MemoryKind,
    /// Human-readable summary (capped at 500 chars at write time).
    pub content: String,
    /// The task that produced this entry, for traceability.
    pub task_id: Uuid,
    pub created_at: DateTime<Utc>,
}

impl MemoryEntry {
    fn new(kind: MemoryKind, content: String, task_id: Uuid) -> Self {
        let content = content.chars().take(500).collect();
        Self {
            id: Uuid::new_v4(),
            kind,
            content,
            task_id,
            created_at: Utc::now(),
        }
    }
}

// ─── Per-workspace memory ────────────────────────────────────────────────────

struct WorkspaceMemory {
    entries: VecDeque<MemoryEntry>,
}

impl WorkspaceMemory {
    fn new() -> Self {
        Self {
            entries: VecDeque::new(),
        }
    }

    fn push(&mut self, entry: MemoryEntry) {
        if self.entries.len() >= MAX_ENTRIES_PER_WORKSPACE {
            self.entries.pop_front(); // evict oldest
        }
        self.entries.push_back(entry);
    }

    fn recent(&self, n: usize) -> Vec<MemoryEntry> {
        self.entries
            .iter()
            .rev()
            .take(n)
            .cloned()
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect()
    }
}

// ─── Persistence format ───────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
struct PersistedStore {
    workspaces: Vec<PersistedWorkspace>,
}

#[derive(Serialize, Deserialize)]
struct PersistedWorkspace {
    user_id: String,
    workspace_path: String,
    entries: Vec<MemoryEntry>,
}

// ─── MemoryStore ─────────────────────────────────────────────────────────────

pub struct MemoryStore {
    /// Map key is (user_id, workspace_path) — user-scoped, no cross-user access.
    inner: RwLock<HashMap<(String, String), WorkspaceMemory>>,
    persist_path: Option<PathBuf>,
}

impl MemoryStore {
    /// Create (or reload) the store.  Pass `Some(path)` to enable persistence.
    pub fn new(persist_path: Option<PathBuf>) -> Arc<Self> {
        let inner = match persist_path.as_deref() {
            Some(p) => load_from_disk(p),
            None => HashMap::new(),
        };
        Arc::new(Self {
            inner: RwLock::new(inner),
            persist_path,
        })
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    /// Record that a task completed and what it accomplished.
    pub async fn record_task_summary(
        &self,
        user_id: &str,
        workspace_path: &str,
        summary: String,
        task_id: Uuid,
    ) {
        let entry = MemoryEntry::new(MemoryKind::TaskSummary, summary, task_id);
        let mut map = self.inner.write().await;
        map.entry((user_id.to_string(), workspace_path.to_string()))
            .or_insert_with(WorkspaceMemory::new)
            .push(entry);
        self.save_sync(&map);
    }

    /// Record that the agent wrote to or created a file.
    pub async fn record_file_change(
        &self,
        user_id: &str,
        workspace_path: &str,
        file_path: &str,
        task_id: Uuid,
    ) {
        let content = format!("Modified: {file_path}");
        let entry = MemoryEntry::new(MemoryKind::FileChanged, content, task_id);
        let mut map = self.inner.write().await;
        map.entry((user_id.to_string(), workspace_path.to_string()))
            .or_insert_with(WorkspaceMemory::new)
            .push(entry);
        self.save_sync(&map);
    }

    /// Let the agent record a freeform codebase observation.
    pub async fn record_observation(
        &self,
        user_id: &str,
        workspace_path: &str,
        observation: String,
        task_id: Uuid,
    ) {
        let entry = MemoryEntry::new(MemoryKind::Observation, observation, task_id);
        let mut map = self.inner.write().await;
        map.entry((user_id.to_string(), workspace_path.to_string()))
            .or_insert_with(WorkspaceMemory::new)
            .push(entry);
        self.save_sync(&map);
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    /// Return the N most recent entries for a (user, workspace) (chronological order).
    pub async fn get_context(&self, user_id: &str, workspace_path: &str) -> Vec<MemoryEntry> {
        self.inner
            .read()
            .await
            .get(&(user_id.to_string(), workspace_path.to_string()))
            .map(|m| m.recent(CONTEXT_ENTRIES_TO_INJECT))
            .unwrap_or_default()
    }

    /// Return all entries for a (user, workspace) (for the API endpoint).
    pub async fn get_all(&self, user_id: &str, workspace_path: &str) -> Vec<MemoryEntry> {
        self.inner
            .read()
            .await
            .get(&(user_id.to_string(), workspace_path.to_string()))
            .map(|m| m.entries.iter().rev().cloned().collect())
            .unwrap_or_default()
    }

    /// Clear all memory for a (user, workspace).
    pub async fn clear(&self, user_id: &str, workspace_path: &str) {
        let mut map = self.inner.write().await;
        map.remove(&(user_id.to_string(), workspace_path.to_string()));
        self.save_sync(&map);
    }

    /// Format memory as a system-prompt section (empty string if no entries).
    ///
    /// Entries are labelled as unverified historical hints so the model does
    /// not treat them as authoritative ground truth.
    pub async fn build_context_block(&self, user_id: &str, workspace_path: &str) -> String {
        let entries = self.get_context(user_id, workspace_path).await;
        if entries.is_empty() {
            return String::new();
        }
        let mut block = String::from(
            "\n\n## Historical Workspace Notes (unverified)\n\
             Past agent tasks recorded these notes. Treat them as hints only — \
             verify before acting on them:\n",
        );
        for e in &entries {
            let kind = match e.kind {
                MemoryKind::TaskSummary => "Task summary",
                MemoryKind::FileChanged => "File changed",
                MemoryKind::Observation => "Observation",
            };
            block.push_str(&format!(
                "- [{}] {} (task {})\n",
                kind,
                e.content,
                &e.task_id.to_string()[..8],
            ));
        }
        block
    }

    // ── Persistence ───────────────────────────────────────────────────────────

    /// Serialize the entire store and write to disk while the write lock is held.
    /// Errors are logged but never propagated — a failed persist is non-fatal.
    fn save_sync(
        &self,
        guard: &tokio::sync::RwLockWriteGuard<HashMap<(String, String), WorkspaceMemory>>,
    ) {
        let Some(ref path) = self.persist_path else {
            return;
        };
        let workspaces: Vec<PersistedWorkspace> = guard
            .iter()
            .map(|((uid, ws), mem)| PersistedWorkspace {
                user_id: uid.clone(),
                workspace_path: ws.clone(),
                entries: mem.entries.iter().cloned().collect(),
            })
            .collect();
        let store = PersistedStore { workspaces };
        match serde_json::to_vec(&store) {
            Ok(bytes) => {
                if let Err(e) = std::fs::write(path, &bytes) {
                    log::warn!("agent memory: persist write failed: {e}");
                }
            }
            Err(e) => log::warn!("agent memory: persist serialize failed: {e}"),
        }
    }
}

fn load_from_disk(
    path: &std::path::Path,
) -> HashMap<(String, String), WorkspaceMemory> {
    let bytes = match std::fs::read(path) {
        Ok(b) => b,
        Err(_) => return HashMap::new(),
    };
    let store: PersistedStore = match serde_json::from_slice(&bytes) {
        Ok(s) => s,
        Err(e) => {
            log::warn!("agent memory: failed to load persisted data: {e}");
            return HashMap::new();
        }
    };
    let mut map = HashMap::new();
    for pw in store.workspaces {
        let mut wm = WorkspaceMemory::new();
        // Re-insert up to cap (data was already capped at save time)
        for entry in pw.entries.into_iter().take(MAX_ENTRIES_PER_WORKSPACE) {
            wm.entries.push_back(entry);
        }
        map.insert((pw.user_id, pw.workspace_path), wm);
    }
    map
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn tid() -> Uuid {
        Uuid::new_v4()
    }

    const USER_A: &str = "user-alice";
    const USER_B: &str = "user-bob";

    #[tokio::test]
    async fn records_and_retrieves_entries() {
        let store = MemoryStore::new(None);
        let ws = "/home/user/proj";
        let task_id = tid();

        store.record_task_summary(USER_A, ws, "Fixed the auth bug".into(), task_id).await;
        store.record_file_change(USER_A, ws, "src/auth.rs", task_id).await;

        let ctx = store.get_context(USER_A, ws).await;
        assert_eq!(ctx.len(), 2);
        assert_eq!(ctx[0].kind, MemoryKind::TaskSummary);
        assert_eq!(ctx[1].kind, MemoryKind::FileChanged);
    }

    #[tokio::test]
    async fn evicts_oldest_when_cap_exceeded() {
        let store = MemoryStore::new(None);
        let ws = "/home/user/proj";
        let task_id = tid();

        for i in 0..=MAX_ENTRIES_PER_WORKSPACE {
            store
                .record_observation(USER_A, ws, format!("obs {i}"), task_id)
                .await;
        }

        let all = store.get_all(USER_A, ws).await;
        assert_eq!(all.len(), MAX_ENTRIES_PER_WORKSPACE);
        // obs 0 evicted; obs 1 is oldest remaining (get_all reverses, so last in vec)
        assert!(all.iter().any(|e| e.content.contains("obs 1")));
        assert!(!all.iter().any(|e| e.content == "obs 0"));
    }

    #[tokio::test]
    async fn clear_removes_all_entries() {
        let store = MemoryStore::new(None);
        let ws = "/home/user/proj";
        let task_id = tid();

        store.record_task_summary(USER_A, ws, "something".into(), task_id).await;
        store.clear(USER_A, ws).await;

        assert!(store.get_context(USER_A, ws).await.is_empty());
    }

    #[tokio::test]
    async fn content_is_capped_at_500_chars() {
        let store = MemoryStore::new(None);
        let ws = "/tmp/ws";
        let task_id = tid();
        let long = "x".repeat(1000);
        store.record_observation(USER_A, ws, long, task_id).await;

        let ctx = store.get_context(USER_A, ws).await;
        assert_eq!(ctx[0].content.len(), 500);
    }

    #[tokio::test]
    async fn empty_workspace_returns_empty_block() {
        let store = MemoryStore::new(None);
        let block = store.build_context_block(USER_A, "/no/such/ws").await;
        assert!(block.is_empty());
    }

    #[tokio::test]
    async fn context_block_contains_entry_summaries() {
        let store = MemoryStore::new(None);
        let ws = "/tmp/ws2";
        let task_id = tid();
        store.record_task_summary(USER_A, ws, "Added login screen".into(), task_id).await;

        let block = store.build_context_block(USER_A, ws).await;
        assert!(block.contains("Added login screen"));
        assert!(block.contains("Task summary"));
        assert!(block.contains("Historical Workspace Notes (unverified)"));
        assert!(block.contains("hints only"));
    }

    #[tokio::test]
    async fn separate_workspaces_are_isolated() {
        let store = MemoryStore::new(None);
        let task_id = tid();
        store.record_task_summary(USER_A, "/ws/a", "A task".into(), task_id).await;
        store.record_task_summary(USER_A, "/ws/b", "B task".into(), task_id).await;

        let a = store.get_context(USER_A, "/ws/a").await;
        let b = store.get_context(USER_A, "/ws/b").await;
        assert_eq!(a.len(), 1);
        assert_eq!(b.len(), 1);
        assert!(a[0].content.contains("A task"));
        assert!(b[0].content.contains("B task"));
    }

    #[tokio::test]
    async fn recent_returns_in_chronological_order() {
        let store = MemoryStore::new(None);
        let ws = "/tmp/order";
        let task_id = tid();
        for i in 0..5usize {
            store.record_observation(USER_A, ws, format!("obs {i}"), task_id).await;
        }
        let ctx = store.get_context(USER_A, ws).await;
        for (i, entry) in ctx.iter().enumerate() {
            assert!(entry.content.contains(&format!("obs {i}")));
        }
    }

    // ── Authorization: cross-user isolation ───────────────────────────────────

    #[tokio::test]
    async fn different_users_cannot_read_each_others_memory() {
        let store = MemoryStore::new(None);
        let ws = "/shared/project";
        let task_id = tid();

        store
            .record_task_summary(USER_A, ws, "Alice's confidential notes".into(), task_id)
            .await;

        // Bob queries the same workspace path — must see nothing
        let bobs_view = store.get_all(USER_B, ws).await;
        assert!(bobs_view.is_empty(), "user B must not see user A's memory");

        // Alice's view is unaffected
        let alices_view = store.get_all(USER_A, ws).await;
        assert_eq!(alices_view.len(), 1);
        assert!(alices_view[0].content.contains("confidential"));
    }

    #[tokio::test]
    async fn clear_is_scoped_to_user() {
        let store = MemoryStore::new(None);
        let ws = "/shared/project";
        let task_id = tid();

        store.record_task_summary(USER_A, ws, "Alice entry".into(), task_id).await;
        store.record_task_summary(USER_B, ws, "Bob entry".into(), task_id).await;

        // Bob clears his own memory
        store.clear(USER_B, ws).await;

        // Alice's entries must be untouched
        let alices_view = store.get_all(USER_A, ws).await;
        assert_eq!(alices_view.len(), 1, "Alice's entries must survive Bob's clear");

        // Bob's entries gone
        let bobs_view = store.get_all(USER_B, ws).await;
        assert!(bobs_view.is_empty());
    }

    // ── Persistence: entries survive store recreation ─────────────────────────

    #[tokio::test]
    async fn entries_survive_store_recreation() {
        let path = std::env::temp_dir()
            .join(format!("archon_mem_test_{}.json", Uuid::new_v4()));

        {
            let store = MemoryStore::new(Some(path.clone()));
            let task_id = tid();
            store
                .record_task_summary(USER_A, "/my/project", "Refactored auth module".into(), task_id)
                .await;
            store
                .record_observation(USER_A, "/my/project", "Uses tokio for async".into(), task_id)
                .await;
        }
        // store dropped; data is on disk

        let store2 = MemoryStore::new(Some(path.clone()));
        let entries = store2.get_all(USER_A, "/my/project").await;
        assert_eq!(entries.len(), 2, "both entries must survive reload");
        // get_all returns newest-first
        assert!(entries.iter().any(|e| e.content.contains("Refactored auth")));
        assert!(entries.iter().any(|e| e.content.contains("tokio")));

        // Clean up temp file
        let _ = std::fs::remove_file(&path);
    }

    #[tokio::test]
    async fn cross_user_isolation_survives_reload() {
        let path = std::env::temp_dir()
            .join(format!("archon_mem_test_{}.json", Uuid::new_v4()));

        {
            let store = MemoryStore::new(Some(path.clone()));
            let task_id = tid();
            store.record_task_summary(USER_A, "/ws", "Alice's note".into(), task_id).await;
            store.record_task_summary(USER_B, "/ws", "Bob's note".into(), task_id).await;
        }

        let store2 = MemoryStore::new(Some(path.clone()));
        let a = store2.get_all(USER_A, "/ws").await;
        let b = store2.get_all(USER_B, "/ws").await;
        assert_eq!(a.len(), 1);
        assert_eq!(b.len(), 1);
        assert!(a[0].content.contains("Alice"));
        assert!(b[0].content.contains("Bob"));

        let _ = std::fs::remove_file(&path);
    }

    #[tokio::test]
    async fn no_persist_path_does_not_crash() {
        let store = MemoryStore::new(None);
        let task_id = tid();
        // Must not panic — writes simply skip disk I/O
        store.record_task_summary(USER_A, "/ws", "no-op".into(), task_id).await;
        let ctx = store.get_all(USER_A, "/ws").await;
        assert_eq!(ctx.len(), 1);
    }
}
