// ============================================================
// Tests for the agent runtime frontend layer.
//
// Covers:
//   - TaskStatus display helpers  (types/agent.ts)
//   - isActiveStatus / isTerminalStatus predicates
//   - EVENT_KIND_ICON completeness
//   - REASONING_LABEL completeness
//   - agentApi request construction  (lib/agentApi.ts)
//   - agentApi error unwrapping
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_COLOR,
  REASONING_LABEL,
  EVENT_KIND_ICON,
  isActiveStatus,
  isTerminalStatus,
} from '../types/agent';
import type { TaskStatus, ReasoningEffort, EventKind, AgentTask, AgentEvent } from '../types/agent';

// ─── Helper types ─────────────────────────────────────────────────────────────

const ALL_STATUSES: TaskStatus[] = [
  'queued',
  'planning',
  'running',
  'verifying',
  'completed',
  'blocked',
  'failed',
  'cancelling',
  'cancelled',
];

const ALL_EFFORTS: ReasoningEffort[] = ['low', 'medium', 'high'];

const ALL_EVENT_KINDS: EventKind[] = [
  'task_created',
  'status_changed',
  'model_request',
  'model_response',
  'tool_call',
  'tool_result',
  'verification_started',
  'verification_result',
  'error',
  'cancel_requested',
  'completed',
];

// ─── TASK_STATUS_LABEL ────────────────────────────────────────────────────────

describe('TASK_STATUS_LABEL', () => {
  it('has a label for every TaskStatus', () => {
    for (const status of ALL_STATUSES) {
      expect(TASK_STATUS_LABEL[status]).toBeDefined();
      expect(typeof TASK_STATUS_LABEL[status]).toBe('string');
      expect(TASK_STATUS_LABEL[status].length).toBeGreaterThan(0);
    }
  });

  it('labels match expected human-readable values', () => {
    expect(TASK_STATUS_LABEL['queued']).toBe('Queued');
    expect(TASK_STATUS_LABEL['completed']).toBe('Completed');
    expect(TASK_STATUS_LABEL['failed']).toBe('Failed');
    expect(TASK_STATUS_LABEL['cancelling']).toBe('Cancelling…');
  });
});

// ─── TASK_STATUS_COLOR ────────────────────────────────────────────────────────

describe('TASK_STATUS_COLOR', () => {
  it('has a CSS variable color for every TaskStatus', () => {
    for (const status of ALL_STATUSES) {
      const color = TASK_STATUS_COLOR[status];
      expect(color).toBeDefined();
      expect(color.startsWith('var(--')).toBe(true);
    }
  });

  it('active statuses use accent color', () => {
    expect(TASK_STATUS_COLOR['planning']).toBe('var(--accent)');
    expect(TASK_STATUS_COLOR['running']).toBe('var(--accent)');
  });

  it('completed uses success color', () => {
    expect(TASK_STATUS_COLOR['completed']).toBe('var(--success)');
  });

  it('failed uses danger color', () => {
    expect(TASK_STATUS_COLOR['failed']).toBe('var(--danger)');
  });

  it('blocked uses warning color', () => {
    expect(TASK_STATUS_COLOR['blocked']).toBe('var(--warning)');
  });

  it('terminal muted statuses use muted color', () => {
    expect(TASK_STATUS_COLOR['cancelled']).toBe('var(--text-muted)');
    expect(TASK_STATUS_COLOR['cancelling']).toBe('var(--text-muted)');
  });
});

// ─── isActiveStatus ───────────────────────────────────────────────────────────

describe('isActiveStatus', () => {
  it('returns true for active statuses', () => {
    const active: TaskStatus[] = ['queued', 'planning', 'running', 'verifying', 'cancelling'];
    for (const s of active) {
      expect(isActiveStatus(s)).toBe(true);
    }
  });

  it('returns false for terminal statuses', () => {
    const terminal: TaskStatus[] = ['completed', 'failed', 'cancelled', 'blocked'];
    for (const s of terminal) {
      expect(isActiveStatus(s)).toBe(false);
    }
  });
});

// ─── isTerminalStatus ─────────────────────────────────────────────────────────

describe('isTerminalStatus', () => {
  it('returns true for terminal statuses', () => {
    const terminal: TaskStatus[] = ['completed', 'failed', 'cancelled', 'blocked'];
    for (const s of terminal) {
      expect(isTerminalStatus(s)).toBe(true);
    }
  });

  it('returns false for active statuses', () => {
    const active: TaskStatus[] = ['queued', 'planning', 'running', 'verifying', 'cancelling'];
    for (const s of active) {
      expect(isTerminalStatus(s)).toBe(false);
    }
  });

  it('active and terminal are mutually exclusive for every status', () => {
    for (const s of ALL_STATUSES) {
      expect(isActiveStatus(s) && isTerminalStatus(s)).toBe(false);
    }
  });

  it('every status is either active or terminal', () => {
    for (const s of ALL_STATUSES) {
      expect(isActiveStatus(s) || isTerminalStatus(s)).toBe(true);
    }
  });
});

// ─── EVENT_KIND_ICON ──────────────────────────────────────────────────────────

describe('EVENT_KIND_ICON', () => {
  it('has an icon for every EventKind', () => {
    for (const kind of ALL_EVENT_KINDS) {
      expect(EVENT_KIND_ICON[kind]).toBeDefined();
      expect(typeof EVENT_KIND_ICON[kind]).toBe('string');
      expect(EVENT_KIND_ICON[kind].length).toBeGreaterThan(0);
    }
  });
});

// ─── REASONING_LABEL ──────────────────────────────────────────────────────────

describe('REASONING_LABEL', () => {
  it('has a label for every ReasoningEffort', () => {
    for (const effort of ALL_EFFORTS) {
      expect(REASONING_LABEL[effort]).toBeDefined();
      expect(typeof REASONING_LABEL[effort]).toBe('string');
    }
  });

  it('labels include the effort name', () => {
    expect(REASONING_LABEL['low'].toLowerCase()).toContain('low');
    expect(REASONING_LABEL['medium'].toLowerCase()).toContain('medium');
    expect(REASONING_LABEL['high'].toLowerCase()).toContain('high');
  });
});

// ─── agentApi (with mocked authenticatedFetch) ───────────────────────────────

// Mock the supabase lib before importing agentApi
vi.mock('../lib/supabase', () => ({
  authenticatedFetch: vi.fn(),
}));

// Import after mock is registered
import { agentApi } from '../lib/agentApi';
import { authenticatedFetch } from '../lib/supabase';

const mockFetch = vi.mocked(authenticatedFetch);

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-abc',
    user_id: 'user-xyz',
    workspace_id: null,
    title: 'Test task',
    request: 'Do something',
    provider: 'anthropic',
    model: 'claude-fable-5',
    reasoning_effort: 'medium',
    status: 'queued',
    current_step: 0,
    max_steps: 15,
    credits_used: 0,
    credit_limit: 100,
    created_at: '2026-07-22T00:00:00Z',
    started_at: null,
    updated_at: '2026-07-22T00:00:00Z',
    completed_at: null,
    error_code: null,
    error_message: null,
    cancel_requested_at: null,
    workspace_path: '/home/user/project',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<AgentEvent> = {}): AgentEvent {
  return {
    id: 'evt-1',
    task_id: 'task-abc',
    sequence: 1,
    kind: 'task_created',
    summary: 'Task was created',
    metadata: {},
    created_at: '2026-07-22T00:00:00Z',
    ...overrides,
  };
}

function mockOk(body: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);
}

function mockErr(status: number, errorBody: { error: string }) {
  return Promise.resolve({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve(errorBody),
  } as Response);
}

describe('agentApi.createTask', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('POSTs to /api/agent/tasks and returns an AgentTask', async () => {
    const task = makeTask();
    mockFetch.mockReturnValueOnce(mockOk(task));

    const result = await agentApi.createTask({
      title: task.title,
      request: task.request,
      provider: task.provider,
      model: task.model,
      reasoning_effort: task.reasoning_effort,
      workspace_path: task.workspace_path,
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/agent/tasks');
    expect(opts?.method).toBe('POST');
    expect(result.id).toBe(task.id);
    expect(result.status).toBe('queued');
  });

  it('passes api_key in the body when provided', async () => {
    mockFetch.mockReturnValueOnce(mockOk(makeTask()));

    await agentApi.createTask({
      title: 'T',
      request: 'R',
      provider: 'anthropic',
      model: 'claude-fable-5',
      reasoning_effort: 'low',
      workspace_path: '/tmp/p',
      api_key: 'sk-test-key',
    });

    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts?.body as string);
    expect(body.api_key).toBe('sk-test-key');
  });

  it('throws with the server error message on failure', async () => {
    mockFetch.mockReturnValueOnce(mockErr(422, { error: 'title too long' }));

    await expect(
      agentApi.createTask({
        title: 'T',
        request: 'R',
        provider: 'anthropic',
        model: 'claude-fable-5',
        reasoning_effort: 'medium',
        workspace_path: '/tmp/p',
      })
    ).rejects.toThrow('title too long');
  });
});

describe('agentApi.listTasks', () => {
  beforeEach(() => mockFetch.mockReset());

  it('GETs /api/agent/tasks and returns an array', async () => {
    const tasks = [makeTask(), makeTask({ id: 'task-def', status: 'completed' })];
    mockFetch.mockReturnValueOnce(mockOk(tasks));

    const result = await agentApi.listTasks();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('task-abc');
    expect(result[1].status).toBe('completed');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/agent/tasks');
    expect(opts?.method).toBe('GET');
  });
});

describe('agentApi.getTask', () => {
  beforeEach(() => mockFetch.mockReset());

  it('GETs /api/agent/tasks/{id}', async () => {
    const task = makeTask({ status: 'running', current_step: 3 });
    mockFetch.mockReturnValueOnce(mockOk(task));

    const result = await agentApi.getTask('task-abc');

    expect(result.current_step).toBe(3);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/agent/tasks/task-abc');
  });

  it('throws 404 message on not-found', async () => {
    mockFetch.mockReturnValueOnce(mockErr(404, { error: 'task not found' }));
    await expect(agentApi.getTask('no-such-id')).rejects.toThrow('task not found');
  });
});

describe('agentApi.getTaskEvents', () => {
  beforeEach(() => mockFetch.mockReset());

  it('GETs /api/agent/tasks/{id}/events and returns an array', async () => {
    const events = [makeEvent(), makeEvent({ sequence: 2, kind: 'status_changed', summary: 'Now planning' })];
    mockFetch.mockReturnValueOnce(mockOk(events));

    const result = await agentApi.getTaskEvents('task-abc');

    expect(result).toHaveLength(2);
    expect(result[1].kind).toBe('status_changed');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/agent/tasks/task-abc/events');
  });
});

describe('agentApi.cancelTask', () => {
  beforeEach(() => mockFetch.mockReset());

  it('POSTs to /api/agent/tasks/{id}/cancel', async () => {
    mockFetch.mockReturnValueOnce(mockOk({ ok: true, message: 'cancellation requested' }));

    const result = await agentApi.cancelTask('task-abc');

    expect(result.ok).toBe(true);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/agent/tasks/task-abc/cancel');
    expect(opts?.method).toBe('POST');
  });

  it('throws on 403 (wrong user)', async () => {
    mockFetch.mockReturnValueOnce(mockErr(403, { error: 'forbidden' }));
    await expect(agentApi.cancelTask('other-user-task')).rejects.toThrow('forbidden');
  });
});
