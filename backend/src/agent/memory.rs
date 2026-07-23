// =============================================================
// Workspace context memory — persistent cross-session knowledge
// for the agent runtime.
//
// Each workspace accumulates a bounded ring of MemoryEntries.
// The runner reads the top-N entries at task start and injects
// them as a "workspace context" section in the system prompt.
// After a task completes the runner writes a summary entry so
// future tasks know what was previously accomplished.
//
// Design choices:
//   - In-memory only (same caveat as TaskStore; migrate to
//     Supabase using the same pattern documented in the migration).
//   - Keyed by canonical workspace_path string (not workspace_id)
//     so it works even before a workspace row exists in Supabase.
//   - MAX_ENTRIES_PER_WORKSPACE keeps memory bounded; old entries
//     are evicted FIFO when the cap is reached.
//   - API keys and file content are NEVER stored here.
// =============================================================

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use std::collections::HashMap;

/// Hard cap on entries per workspace to keep memory bounded.
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
        self.entries.iter().rev().take(n).cloned().collect::<Vec<_>>()
            .into_iter().rev().collect()
    }
}

// ─── MemoryStore ─────────────────────────────────────────────────────────────

pub struct MemoryStore {
    inner: RwLock<HashMap<String, WorkspaceMemory>>,
}

impl MemoryStore {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            inner: RwLock::new(HashMap::new()),
        })
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    /// Record that a task completed and what it accomplished.
    pub async fn record_task_summary(
        &self,
        workspace_path: &str,
        summary: String,
        task_id: Uuid,
    ) {
        let entry = MemoryEntry::new(MemoryKind::TaskSummary, summary, task_id);
        self.inner
            .write()
            .await
            .entry(workspace_path.to_string())
            .or_insert_with(WorkspaceMemory::new)
            .push(entry);
    }

    /// Record that the agent wrote to or created a file.
    pub async fn record_file_change(
        &self,
        workspace_path: &str,
        file_path: &str,
        task_id: Uuid,
    ) {
        let content = format!("Modified: {file_path}");
        let entry = MemoryEntry::new(MemoryKind::FileChanged, content, task_id);
        self.inner
            .write()
            .await
            .entry(workspace_path.to_string())
            .or_insert_with(WorkspaceMemory::new)
            .push(entry);
    }

    /// Let the agent record a freeform codebase observation.
    pub async fn record_observation(
        &self,
        workspace_path: &str,
        observation: String,
        task_id: Uuid,
    ) {
        let entry = MemoryEntry::new(MemoryKind::Observation, observation, task_id);
        self.inner
            .write()
            .await
            .entry(workspace_path.to_string())
            .or_insert_with(WorkspaceMemory::new)
            .push(entry);
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    /// Return the N most recent entries for a workspace (chronological order).
    pub async fn get_context(&self, workspace_path: &str) -> Vec<MemoryEntry> {
        self.inner
            .read()
            .await
            .get(workspace_path)
            .map(|m| m.recent(CONTEXT_ENTRIES_TO_INJECT))
            .unwrap_or_default()
    }

    /// Return all entries for a workspace (for the API endpoint).
    pub async fn get_all(&self, workspace_path: &str) -> Vec<MemoryEntry> {
        self.inner
            .read()
            .await
            .get(workspace_path)
            .map(|m| m.entries.iter().rev().cloned().collect())
            .unwrap_or_default()
    }

    /// Clear all memory for a workspace.
    pub async fn clear(&self, workspace_path: &str) {
        self.inner.write().await.remove(workspace_path);
    }

    /// Format memory as a system-prompt section (empty string if no entries).
    pub async fn build_context_block(&self, workspace_path: &str) -> String {
        let entries = self.get_context(workspace_path).await;
        if entries.is_empty() {
            return String::new();
        }
        let mut block = String::from(
            "\n\n## Workspace Memory\nWhat previous agent tasks have learned about this codebase:\n",
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
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn tid() -> Uuid {
        Uuid::new_v4()
    }

    #[tokio::test]
    async fn records_and_retrieves_entries() {
        let store = MemoryStore::new();
        let ws = "/home/user/proj";
        let task_id = tid();

        store.record_task_summary(ws, "Fixed the auth bug".into(), task_id).await;
        store.record_file_change(ws, "src/auth.rs", task_id).await;

        let ctx = store.get_context(ws).await;
        assert_eq!(ctx.len(), 2);
        assert_eq!(ctx[0].kind, MemoryKind::TaskSummary);
        assert_eq!(ctx[1].kind, MemoryKind::FileChanged);
    }

    #[tokio::test]
    async fn evicts_oldest_when_cap_exceeded() {
        let store = MemoryStore::new();
        let ws = "/home/user/proj";
        let task_id = tid();

        for i in 0..=MAX_ENTRIES_PER_WORKSPACE {
            store
                .record_observation(ws, format!("obs {i}"), task_id)
                .await;
        }

        let all = store.get_all(ws).await;
        assert_eq!(all.len(), MAX_ENTRIES_PER_WORKSPACE);
        // Oldest (obs 0) should be evicted; most recent should still be there
        assert!(all[0].content.contains("obs 1"));
    }

    #[tokio::test]
    async fn clear_removes_all_entries() {
        let store = MemoryStore::new();
        let ws = "/home/user/proj";
        let task_id = tid();

        store.record_task_summary(ws, "something".into(), task_id).await;
        store.clear(ws).await;

        assert!(store.get_context(ws).await.is_empty());
    }

    #[tokio::test]
    async fn content_is_capped_at_500_chars() {
        let store = MemoryStore::new();
        let ws = "/tmp/ws";
        let task_id = tid();
        let long = "x".repeat(1000);
        store.record_observation(ws, long, task_id).await;

        let ctx = store.get_context(ws).await;
        assert_eq!(ctx[0].content.len(), 500);
    }

    #[tokio::test]
    async fn empty_workspace_returns_empty_block() {
        let store = MemoryStore::new();
        let block = store.build_context_block("/no/such/ws").await;
        assert!(block.is_empty());
    }

    #[tokio::test]
    async fn context_block_contains_entry_summaries() {
        let store = MemoryStore::new();
        let ws = "/tmp/ws2";
        let task_id = tid();
        store.record_task_summary(ws, "Added login screen".into(), task_id).await;

        let block = store.build_context_block(ws).await;
        assert!(block.contains("Added login screen"));
        assert!(block.contains("Task summary"));
        assert!(block.contains("Workspace Memory"));
    }

    #[tokio::test]
    async fn separate_workspaces_are_isolated() {
        let store = MemoryStore::new();
        let task_id = tid();
        store.record_task_summary("/ws/a", "A task".into(), task_id).await;
        store.record_task_summary("/ws/b", "B task".into(), task_id).await;

        let a = store.get_context("/ws/a").await;
        let b = store.get_context("/ws/b").await;
        assert_eq!(a.len(), 1);
        assert_eq!(b.len(), 1);
        assert!(a[0].content.contains("A task"));
        assert!(b[0].content.contains("B task"));
    }

    #[tokio::test]
    async fn recent_returns_in_chronological_order() {
        let store = MemoryStore::new();
        let ws = "/tmp/order";
        let task_id = tid();
        for i in 0..5usize {
            store.record_observation(ws, format!("obs {i}"), task_id).await;
        }
        let ctx = store.get_context(ws).await;
        for (i, entry) in ctx.iter().enumerate() {
            assert!(entry.content.contains(&format!("obs {i}")));
        }
    }
}
