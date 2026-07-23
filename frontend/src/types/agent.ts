// ============================================================
// Agent task domain types — mirror of backend agent/domain.rs
// ============================================================

export type TaskStatus =
  | 'queued'
  | 'planning'
  | 'running'
  | 'verifying'
  | 'completed'
  | 'blocked'
  | 'failed'
  | 'cancelling'
  | 'cancelled';

export type ReasoningEffort = 'low' | 'medium' | 'high';

export type EventKind =
  | 'task_created'
  | 'status_changed'
  | 'model_request'
  | 'model_response'
  | 'tool_call'
  | 'tool_result'
  | 'verification_started'
  | 'verification_result'
  | 'error'
  | 'cancel_requested'
  | 'completed';

export interface AgentTask {
  id: string;
  user_id: string;
  workspace_id: string | null;
  title: string;
  request: string;
  provider: string;
  model: string;
  reasoning_effort: ReasoningEffort;
  status: TaskStatus;
  current_step: number;
  max_steps: number;
  credits_used: number;
  credit_limit: number;
  created_at: string;
  started_at: string | null;
  updated_at: string;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  cancel_requested_at: string | null;
  workspace_path: string;
}

export interface AgentEvent {
  id: string;
  task_id: string;
  sequence: number;
  kind: EventKind;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateTaskRequest {
  title: string;
  request: string;
  provider: string;
  model: string;
  reasoning_effort: ReasoningEffort;
  api_key?: string;
  workspace_path: string;
}

// ── Display helpers ─────────────────────────────────────────────────────────

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  queued: 'Queued',
  planning: 'Planning',
  running: 'Running',
  verifying: 'Verifying',
  completed: 'Completed',
  blocked: 'Blocked',
  failed: 'Failed',
  cancelling: 'Cancelling…',
  cancelled: 'Cancelled',
};

export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  queued: 'var(--text-muted)',
  planning: 'var(--accent)',
  running: 'var(--accent)',
  verifying: 'var(--accent-hover)',
  completed: 'var(--success)',
  blocked: 'var(--warning)',
  failed: 'var(--danger)',
  cancelling: 'var(--text-muted)',
  cancelled: 'var(--text-muted)',
};

export function isActiveStatus(status: TaskStatus): boolean {
  return ['queued', 'planning', 'running', 'verifying', 'cancelling'].includes(status);
}

export function isTerminalStatus(status: TaskStatus): boolean {
  return ['completed', 'failed', 'cancelled', 'blocked'].includes(status);
}

export const EVENT_KIND_ICON: Record<EventKind, string> = {
  task_created: '🆕',
  status_changed: '⟳',
  model_request: '→',
  model_response: '←',
  tool_call: '⚙',
  tool_result: '✓',
  verification_started: '🔍',
  verification_result: '✅',
  error: '⚠',
  cancel_requested: '🛑',
  completed: '🎉',
};

export const REASONING_LABEL: Record<ReasoningEffort, string> = {
  low: 'Low · 1×',
  medium: 'Medium · 2×',
  high: 'High · 4×',
};
