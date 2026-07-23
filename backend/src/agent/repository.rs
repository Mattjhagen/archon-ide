// =============================================================
// In-memory task repository with per-user access enforcement.
//
// All public methods enforce that the caller's user_id matches the
// task owner.  Every task lookup that crosses user boundaries returns
// None or Unauthorized — not a different user's data.
//
// Production path: replace inner RwLock maps with Supabase/Postgres
// queries behind the same method signatures.  The AgentTask and
// AgentEvent types are already serde-compatible with the SQL schema
// defined in supabase/migrations/20260722235200_create_agent_tasks.sql.
// =============================================================

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use chrono::Utc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::agent::domain::{AgentEvent, AgentTask, EventKind, TaskStatus, TransitionError};

pub struct TaskStore {
    /// Primary task storage.
    tasks: RwLock<HashMap<Uuid, AgentTask>>,
    /// Ordered event log, keyed by task id.
    events: RwLock<HashMap<Uuid, Vec<AgentEvent>>>,
    /// API keys — stored separately from task entity, never serialized,
    /// cleared when the task enters a terminal state.
    api_keys: RwLock<HashMap<Uuid, String>>,
    /// Atomic cancel flags set by the cancel endpoint, polled by the runner.
    cancel_flags: RwLock<HashMap<Uuid, Arc<AtomicBool>>>,
    /// Monotonic sequence counters for deterministic event ordering.
    seq_counters: RwLock<HashMap<Uuid, u64>>,
}

impl TaskStore {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            tasks: RwLock::new(HashMap::new()),
            events: RwLock::new(HashMap::new()),
            api_keys: RwLock::new(HashMap::new()),
            cancel_flags: RwLock::new(HashMap::new()),
            seq_counters: RwLock::new(HashMap::new()),
        })
    }

    /// Persist a new task.  The optional API key is kept in a separate map
    /// and never included in task serialization.
    pub async fn create(&self, task: AgentTask, api_key: Option<String>) -> AgentTask {
        let id = task.id;

        self.tasks.write().await.insert(id, task.clone());
        self.events.write().await.insert(id, Vec::new());
        self.cancel_flags
            .write()
            .await
            .insert(id, Arc::new(AtomicBool::new(false)));
        self.seq_counters.write().await.insert(id, 0);

        if let Some(key) = api_key {
            self.api_keys.write().await.insert(id, key);
        }

        task
    }

    /// Retrieve a task, enforcing ownership.
    /// Returns None for both "not found" and "wrong user" to avoid leaking
    /// whether a task id belongs to another user.
    pub async fn get_for_user(&self, id: Uuid, user_id: &str) -> Option<AgentTask> {
        let tasks = self.tasks.read().await;
        let task = tasks.get(&id)?;
        if task.user_id != user_id {
            return None;
        }
        Some(task.clone())
    }

    /// List all tasks for a user, most-recent first.
    pub async fn list_for_user(&self, user_id: &str) -> Vec<AgentTask> {
        let tasks = self.tasks.read().await;
        let mut result: Vec<AgentTask> = tasks
            .values()
            .filter(|t| t.user_id == user_id)
            .cloned()
            .collect();
        result.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        result
    }

    /// Apply a lifecycle transition, enforcing ownership and state-machine rules.
    pub async fn transition(
        &self,
        id: Uuid,
        user_id: &str,
        next: TaskStatus,
        error: Option<(String, String)>,
    ) -> Result<(), TransitionError> {
        let became_terminal = {
            let mut tasks = self.tasks.write().await;
            let task = tasks.get_mut(&id).ok_or(TransitionError::NotFound)?;

            if task.user_id != user_id {
                return Err(TransitionError::Unauthorized);
            }
            if task.status.is_terminal() {
                return Err(TransitionError::AlreadyTerminal);
            }
            if !task.status.can_transition_to(&next) {
                return Err(TransitionError::InvalidTransition {
                    from: task.status.clone(),
                    to: next,
                });
            }

            let now = Utc::now();
            task.updated_at = now;

            if next == TaskStatus::Planning && task.started_at.is_none() {
                task.started_at = Some(now);
            }
            if matches!(
                next,
                TaskStatus::Completed
                    | TaskStatus::Failed
                    | TaskStatus::Cancelled
                    | TaskStatus::Blocked
            ) {
                task.completed_at = Some(now);
            }
            if let Some((code, msg)) = error {
                task.error_code = Some(code);
                task.error_message = Some(msg);
            }

            task.status = next;
            task.status.is_terminal()
        }; // tasks write-lock released here

        if became_terminal {
            // Remove the API key now that the task is done
            self.api_keys.write().await.remove(&id);
        }

        Ok(())
    }

    /// Signal that the authenticated user wants this task cancelled.
    /// Sets the atomic flag that the background runner polls; the actual
    /// transition to `Cancelling` → `Cancelled` happens inside the runner.
    pub async fn request_cancel(&self, id: Uuid, user_id: &str) -> Result<(), TransitionError> {
        {
            let mut tasks = self.tasks.write().await;
            let task = tasks.get_mut(&id).ok_or(TransitionError::NotFound)?;

            if task.user_id != user_id {
                return Err(TransitionError::Unauthorized);
            }
            if task.status.is_terminal() {
                return Err(TransitionError::AlreadyTerminal);
            }

            let now = Utc::now();
            task.cancel_requested_at = Some(now);
            task.updated_at = now;
        } // tasks write-lock released

        // Set the atomic flag so the runner sees it without holding the lock
        let flags = self.cancel_flags.read().await;
        if let Some(flag) = flags.get(&id) {
            flag.store(true, Ordering::SeqCst);
        }

        Ok(())
    }

    /// Poll the cancellation flag for a task.  Called by the runner.
    pub async fn is_cancel_requested(&self, id: Uuid) -> bool {
        match self.cancel_flags.read().await.get(&id) {
            Some(flag) => flag.load(Ordering::SeqCst),
            None => false,
        }
    }

    /// Increment and return the new step count.
    pub async fn increment_step(&self, id: Uuid) -> u32 {
        let mut tasks = self.tasks.write().await;
        if let Some(task) = tasks.get_mut(&id) {
            task.current_step += 1;
            task.updated_at = Utc::now();
            return task.current_step;
        }
        0
    }

    /// Add credits consumed and return the running total.
    pub async fn add_credits(&self, id: Uuid, units: u64) -> u64 {
        let mut tasks = self.tasks.write().await;
        if let Some(task) = tasks.get_mut(&id) {
            task.credits_used = task.credits_used.saturating_add(units);
            task.updated_at = Utc::now();
            return task.credits_used;
        }
        0
    }

    pub async fn get_credit_limit(&self, id: Uuid) -> Option<u64> {
        self.tasks.read().await.get(&id).map(|t| t.credit_limit)
    }

    pub async fn get_max_steps(&self, id: Uuid) -> Option<u32> {
        self.tasks.read().await.get(&id).map(|t| t.max_steps)
    }

    /// Retrieve the stored API key for use by the runner.
    /// Does not remove the key — runner needs it for the whole run.
    /// Key is cleared automatically when the task transitions to a terminal state.
    pub async fn take_api_key(&self, id: Uuid) -> Option<String> {
        self.api_keys.read().await.get(&id).cloned()
    }

    /// Return the next monotonic sequence number for an event.
    pub async fn next_sequence(&self, task_id: Uuid) -> u64 {
        let mut counters = self.seq_counters.write().await;
        let counter = counters.entry(task_id).or_insert(0);
        let seq = *counter;
        *counter += 1;
        seq
    }

    /// Append a progress event to a task's log.
    pub async fn append_event(&self, event: AgentEvent) {
        let task_id = event.task_id;
        self.events.write().await.entry(task_id).or_default().push(event);
    }

    /// Return a task's events, enforcing ownership.
    /// Returns None for both "not found" and "wrong user".
    pub async fn get_events_for_user(&self, task_id: Uuid, user_id: &str) -> Option<Vec<AgentEvent>> {
        // Verify ownership first
        {
            let tasks = self.tasks.read().await;
            let task = tasks.get(&task_id)?;
            if task.user_id != user_id {
                return None;
            }
        }

        let events = self.events.read().await;
        Some(events.get(&task_id).cloned().unwrap_or_default())
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent::domain::{AgentTask, ReasoningEffort};

    fn make_task(user_id: &str) -> AgentTask {
        AgentTask::new(
            user_id.to_string(),
            "Test task".to_string(),
            "Write hello world".to_string(),
            "mock".to_string(),
            "mock-responses".to_string(),
            ReasoningEffort::Low,
            "/workspace/test".to_string(),
        )
    }

    // ── Ownership ─────────────────────────────────────────────────────────────

    #[tokio::test]
    async fn create_and_retrieve_own_task() {
        let store = TaskStore::new();
        let task = make_task("user-a");
        let id = task.id;
        store.create(task, None).await;

        let found = store.get_for_user(id, "user-a").await;
        assert!(found.is_some());
        assert_eq!(found.unwrap().status, TaskStatus::Queued);
    }

    #[tokio::test]
    async fn cross_user_read_is_denied() {
        let store = TaskStore::new();
        let task = make_task("user-a");
        let id = task.id;
        store.create(task, None).await;

        let result = store.get_for_user(id, "user-b").await;
        assert!(result.is_none(), "user-b must not read user-a's task");
    }

    #[tokio::test]
    async fn list_returns_only_own_tasks() {
        let store = TaskStore::new();
        store.create(make_task("user-a"), None).await;
        store.create(make_task("user-a"), None).await;
        store.create(make_task("user-b"), None).await;

        assert_eq!(store.list_for_user("user-a").await.len(), 2);
        assert_eq!(store.list_for_user("user-b").await.len(), 1);
        assert_eq!(store.list_for_user("user-c").await.len(), 0);
    }

    #[tokio::test]
    async fn cross_user_cancel_is_denied() {
        let store = TaskStore::new();
        let task = make_task("user-a");
        let id = task.id;
        store.create(task, None).await;

        let result = store.request_cancel(id, "user-b").await;
        assert!(
            matches!(result, Err(TransitionError::Unauthorized)),
            "user-b must not cancel user-a's task"
        );
    }

    #[tokio::test]
    async fn cross_user_events_are_denied() {
        let store = TaskStore::new();
        let task = make_task("user-a");
        let id = task.id;
        store.create(task, None).await;

        let result = store.get_events_for_user(id, "user-b").await;
        assert!(result.is_none(), "user-b must not read user-a's events");
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    #[tokio::test]
    async fn valid_full_lifecycle() {
        let store = TaskStore::new();
        let task = make_task("user-a");
        let id = task.id;
        let uid = "user-a";
        store.create(task, None).await;

        store.transition(id, uid, TaskStatus::Planning, None).await.unwrap();
        store.transition(id, uid, TaskStatus::Running, None).await.unwrap();
        store.transition(id, uid, TaskStatus::Verifying, None).await.unwrap();
        store.transition(id, uid, TaskStatus::Completed, None).await.unwrap();

        let final_task = store.get_for_user(id, uid).await.unwrap();
        assert_eq!(final_task.status, TaskStatus::Completed);
        assert!(final_task.started_at.is_some());
        assert!(final_task.completed_at.is_some());
    }

    #[tokio::test]
    async fn invalid_transition_rejected() {
        let store = TaskStore::new();
        let task = make_task("user-a");
        let id = task.id;
        store.create(task, None).await;

        // Queued → Completed is not a valid transition
        let result = store.transition(id, "user-a", TaskStatus::Completed, None).await;
        assert!(matches!(result, Err(TransitionError::InvalidTransition { .. })));
    }

    #[tokio::test]
    async fn terminal_task_cannot_transition() {
        let store = TaskStore::new();
        let task = make_task("user-a");
        let id = task.id;
        let uid = "user-a";
        store.create(task, None).await;

        store.transition(id, uid, TaskStatus::Planning, None).await.unwrap();
        store.transition(id, uid, TaskStatus::Running, None).await.unwrap();
        store.transition(id, uid, TaskStatus::Verifying, None).await.unwrap();
        store.transition(id, uid, TaskStatus::Completed, None).await.unwrap();

        let result = store.transition(id, uid, TaskStatus::Running, None).await;
        assert!(matches!(result, Err(TransitionError::AlreadyTerminal)));
    }

    // ── Cancellation ──────────────────────────────────────────────────────────

    #[tokio::test]
    async fn cancellation_sets_flag() {
        let store = TaskStore::new();
        let task = make_task("user-a");
        let id = task.id;
        store.create(task, None).await;

        assert!(!store.is_cancel_requested(id).await);
        store.request_cancel(id, "user-a").await.unwrap();
        assert!(store.is_cancel_requested(id).await);
    }

    #[tokio::test]
    async fn cancel_is_idempotent() {
        let store = TaskStore::new();
        let task = make_task("user-a");
        let id = task.id;
        store.create(task, None).await;

        store.request_cancel(id, "user-a").await.unwrap();
        // Second call on the same active task is also OK
        let result = store.request_cancel(id, "user-a").await;
        assert!(result.is_ok(), "second cancel must not error: {:?}", result);
    }

    #[tokio::test]
    async fn terminal_task_cannot_be_cancelled() {
        let store = TaskStore::new();
        let task = make_task("user-a");
        let id = task.id;
        let uid = "user-a";
        store.create(task, None).await;

        store.transition(id, uid, TaskStatus::Planning, None).await.unwrap();
        store.transition(id, uid, TaskStatus::Running, None).await.unwrap();
        store.transition(id, uid, TaskStatus::Failed, Some(("err".into(), "msg".into()))).await.unwrap();

        let result = store.request_cancel(id, uid).await;
        assert!(matches!(result, Err(TransitionError::AlreadyTerminal)));
    }

    // ── Budget tracking ───────────────────────────────────────────────────────

    #[tokio::test]
    async fn step_counter_increments() {
        let store = TaskStore::new();
        let task = make_task("user-a");
        let id = task.id;
        store.create(task, None).await;

        assert_eq!(store.increment_step(id).await, 1);
        assert_eq!(store.increment_step(id).await, 2);
        assert_eq!(store.increment_step(id).await, 3);

        let task = store.get_for_user(id, "user-a").await.unwrap();
        assert_eq!(task.current_step, 3);
    }

    #[tokio::test]
    async fn credit_counter_accumulates() {
        let store = TaskStore::new();
        let task = make_task("user-a");
        let id = task.id;
        store.create(task, None).await;

        store.add_credits(id, 5).await;
        store.add_credits(id, 8).await;

        let task = store.get_for_user(id, "user-a").await.unwrap();
        assert_eq!(task.credits_used, 13);
    }

    // ── API key isolation ─────────────────────────────────────────────────────

    #[tokio::test]
    async fn api_key_not_in_task_serialization() {
        let store = TaskStore::new();
        let task = make_task("user-a");
        let id = task.id;
        store.create(task, Some("sk-very-secret".to_string())).await;

        let task = store.get_for_user(id, "user-a").await.unwrap();
        let json = serde_json::to_string(&task).unwrap();
        assert!(
            !json.contains("sk-very-secret"),
            "API key must not appear in task JSON"
        );
        assert!(!json.contains("api_key"), "api_key field must not exist in task JSON");
    }

    #[tokio::test]
    async fn api_key_retrievable_by_runner() {
        let store = TaskStore::new();
        let task = make_task("user-a");
        let id = task.id;
        store.create(task, Some("sk-runner-key".to_string())).await;

        let key = store.take_api_key(id).await;
        assert_eq!(key.as_deref(), Some("sk-runner-key"));
    }

    #[tokio::test]
    async fn api_key_cleared_on_terminal_transition() {
        let store = TaskStore::new();
        let task = make_task("user-a");
        let id = task.id;
        let uid = "user-a";
        store.create(task, Some("sk-secret".to_string())).await;

        store.transition(id, uid, TaskStatus::Planning, None).await.unwrap();
        store.transition(id, uid, TaskStatus::Running, None).await.unwrap();
        store.transition(id, uid, TaskStatus::Verifying, None).await.unwrap();
        store.transition(id, uid, TaskStatus::Completed, None).await.unwrap();

        let key = store.take_api_key(id).await;
        assert!(key.is_none(), "API key must be cleared after task completes");
    }
}
