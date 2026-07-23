// =============================================================
// Agent task domain: types, lifecycle state machine, events
// =============================================================

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub use crate::ai::ReasoningEffort;

/// Lifecycle states for an agent task.
///
/// Valid forward paths:
///   queued → planning → running → verifying → completed
///
/// Exceptional / terminal paths:
///   any-active → blocked | failed
///   any-active → cancelling → cancelled
///
/// Invalid transitions are rejected explicitly by `can_transition_to`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Queued,
    Planning,
    Running,
    Verifying,
    Completed,
    Blocked,
    Failed,
    Cancelling,
    Cancelled,
}

impl TaskStatus {
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            Self::Completed | Self::Blocked | Self::Failed | Self::Cancelled
        )
    }

    pub fn is_active(&self) -> bool {
        !self.is_terminal()
    }

    /// Returns true if a direct transition from `self` to `next` is allowed.
    pub fn can_transition_to(&self, next: &TaskStatus) -> bool {
        use TaskStatus::*;
        matches!(
            (self, next),
            // Happy path
            (Queued, Planning)
                | (Planning, Running)
                | (Running, Running)    // re-enter after tool step
                | (Running, Verifying)
                | (Verifying, Running)  // model requests another tool after verify
                | (Verifying, Completed)
                // Error / blocker paths from active states
                | (Planning, Failed)
                | (Planning, Blocked)
                | (Running, Failed)
                | (Running, Blocked)
                | (Verifying, Failed)
                // Cancellation: any active → cancelling → cancelled
                | (Queued, Cancelling)
                | (Planning, Cancelling)
                | (Running, Cancelling)
                | (Verifying, Cancelling)
                | (Cancelling, Cancelled)
        )
    }
}

/// Budget limits per reasoning effort level.
fn effort_limits(effort: ReasoningEffort) -> (u32, u64) {
    match effort {
        ReasoningEffort::Low => (5, 20),
        ReasoningEffort::Medium => (15, 100),
        ReasoningEffort::High => (40, 500),
    }
}

/// A long-running autonomous coding task owned by a single authenticated user.
///
/// Security: the `workspace_path` field is the *requested* path supplied by the
/// client; all actual file operations go through `WorkspacePolicy::resolve` which
/// enforces containment.  API keys are never stored here — see `TaskStore`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AgentTask {
    pub id: Uuid,
    pub user_id: String,
    pub workspace_id: Option<Uuid>,
    pub title: String,
    pub request: String,
    pub provider: String,
    pub model: String,
    pub reasoning_effort: ReasoningEffort,
    pub status: TaskStatus,
    pub current_step: u32,
    pub max_steps: u32,
    pub credits_used: u64,
    pub credit_limit: u64,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub cancel_requested_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub cancel_requested_at: Option<DateTime<Utc>>,
    pub workspace_id: Uuid,
}

impl AgentTask {
    pub fn new(
        user_id: String,
        title: String,
        request: String,
        provider: String,
        model: String,
        reasoning_effort: ReasoningEffort,
        workspace_id: Uuid,
    ) -> Self {
        let (max_steps, credit_limit) = effort_limits(reasoning_effort);
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            user_id,
            workspace_id,
            title,
            request,
            provider,
            model,
            reasoning_effort,
            status: TaskStatus::Queued,
            current_step: 0,
            max_steps,
            credits_used: 0,
            credit_limit,
            created_at: now,
            started_at: None,
            updated_at: now,
            completed_at: None,
            error_code: None,
            error_message: None,
            cancel_requested_at: None,
        }
    }
}

/// The kind of a task progress event.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    TaskCreated,
    StatusChanged,
    ModelRequest,
    ModelResponse,
    ToolCall,
    ToolResult,
    VerificationStarted,
    VerificationResult,
    Error,
    CancelRequested,
    Completed,
}

/// A single immutable record in a task's progress log.
///
/// `metadata` is bounded at the store layer and must never contain raw API keys,
/// full file contents, or other sensitive data.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AgentEvent {
    pub id: Uuid,
    pub task_id: Uuid,
    pub sequence: u64,
    pub kind: EventKind,
    pub summary: String,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

impl AgentEvent {
    pub fn new(
        task_id: Uuid,
        sequence: u64,
        kind: EventKind,
        summary: String,
        metadata: serde_json::Value,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            task_id,
            sequence,
            kind,
            summary,
            metadata,
            created_at: Utc::now(),
        }
    }
}

/// Error returned by repository state-machine operations.
#[derive(Debug)]
pub enum TransitionError {
    InvalidTransition { from: TaskStatus, to: TaskStatus },
    NotFound,
    Unauthorized,
    AlreadyTerminal,
}

impl std::fmt::Display for TransitionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidTransition { from, to } => {
                write!(f, "cannot transition from {:?} to {:?}", from, to)
            }
            Self::NotFound => write!(f, "task not found"),
            Self::Unauthorized => write!(f, "not authorized"),
            Self::AlreadyTerminal => write!(f, "task is already in a terminal state"),
        }
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── Lifecycle transitions ─────────────────────────────────────────────────

    #[test]
    fn queued_to_planning_is_valid() {
        assert!(TaskStatus::Queued.can_transition_to(&TaskStatus::Planning));
    }

    #[test]
    fn planning_to_running_is_valid() {
        assert!(TaskStatus::Planning.can_transition_to(&TaskStatus::Running));
    }

    #[test]
    fn running_to_verifying_is_valid() {
        assert!(TaskStatus::Running.can_transition_to(&TaskStatus::Verifying));
    }

    #[test]
    fn verifying_to_completed_is_valid() {
        assert!(TaskStatus::Verifying.can_transition_to(&TaskStatus::Completed));
    }

    #[test]
    fn cancelling_to_cancelled_is_valid() {
        assert!(TaskStatus::Cancelling.can_transition_to(&TaskStatus::Cancelled));
    }

    #[test]
    fn queued_to_completed_is_invalid() {
        assert!(!TaskStatus::Queued.can_transition_to(&TaskStatus::Completed));
    }

    #[test]
    fn running_to_planning_is_invalid() {
        assert!(!TaskStatus::Running.can_transition_to(&TaskStatus::Planning));
    }

    #[test]
    fn terminal_states_have_no_outgoing_transitions() {
        let terminal = [
            TaskStatus::Completed,
            TaskStatus::Failed,
            TaskStatus::Cancelled,
            TaskStatus::Blocked,
        ];
        let any = [
            TaskStatus::Queued,
            TaskStatus::Planning,
            TaskStatus::Running,
            TaskStatus::Verifying,
            TaskStatus::Completed,
            TaskStatus::Failed,
            TaskStatus::Cancelled,
            TaskStatus::Blocked,
            TaskStatus::Cancelling,
        ];
        for from in &terminal {
            for to in &any {
                assert!(
                    !from.can_transition_to(to),
                    "terminal {:?} must not transition to {:?}",
                    from,
                    to
                );
            }
        }
    }

    #[test]
    fn any_active_state_can_request_cancelling() {
        let active = [
            TaskStatus::Queued,
            TaskStatus::Planning,
            TaskStatus::Running,
            TaskStatus::Verifying,
        ];
        for s in &active {
            assert!(
                s.can_transition_to(&TaskStatus::Cancelling),
                "{:?} should be cancellable",
                s
            );
        }
    }

    #[test]
    fn is_terminal_flags() {
        assert!(TaskStatus::Completed.is_terminal());
        assert!(TaskStatus::Failed.is_terminal());
        assert!(TaskStatus::Cancelled.is_terminal());
        assert!(TaskStatus::Blocked.is_terminal());
        assert!(!TaskStatus::Running.is_terminal());
        assert!(!TaskStatus::Queued.is_terminal());
        assert!(!TaskStatus::Cancelling.is_terminal());
    }

    // ── Budget limits ─────────────────────────────────────────────────────────

    #[test]
    fn low_effort_gives_tight_budget() {
        let task = AgentTask::new(
            "u".into(), "t".into(), "r".into(),
            "mock".into(), "mock-responses".into(),
            ReasoningEffort::Low,
            Uuid::new_v4(),
        );
        assert_eq!(task.max_steps, 5);
        assert_eq!(task.credit_limit, 20);
    }

    #[test]
    fn high_effort_gives_generous_budget() {
        let task = AgentTask::new(
            "u".into(), "t".into(), "r".into(),
            "mock".into(), "mock-responses".into(),
            ReasoningEffort::High,
            Uuid::new_v4(),
        );
        assert_eq!(task.max_steps, 40);
        assert_eq!(task.credit_limit, 500);
    }

    // ── Serialisation — api key must never appear ─────────────────────────────

    #[test]
    fn task_serialization_contains_no_api_key_field() {
        let task = AgentTask::new(
            "user-1".into(), "title".into(), "request".into(),
            "anthropic".into(), "claude-sonnet-4".into(),
            ReasoningEffort::Medium,
            Uuid::new_v4(),
        );
        let json = serde_json::to_string(&task).unwrap();
        // These patterns must never appear in serialized task output
        assert!(!json.contains("api_key"), "api_key field must not be serialized");
        assert!(!json.contains("sk-"), "API key prefix must not appear");
    }
}
