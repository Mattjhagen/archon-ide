// ============================================================
// API client for the agent task endpoints.
// All calls use authenticatedFetch which injects the Supabase
// Authorization header.
// ============================================================

import type { AgentTask, AgentEvent, CreateTaskRequest } from '../types/agent';
import { authenticatedFetch } from './supabase';

const BASE = '/api/agent';

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await authenticatedFetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const agentApi = {
  /** Create a new task and start the background runner. */
  createTask: (req: CreateTaskRequest) =>
    request<AgentTask>('/tasks', 'POST', req),

  /** List all tasks for the authenticated user, most-recent first. */
  listTasks: () =>
    request<AgentTask[]>('/tasks'),

  /** Get a single task. Throws if not found or not owned by the user. */
  getTask: (id: string) =>
    request<AgentTask>(`/tasks/${id}`),

  /** Get the ordered event log for a task. */
  getTaskEvents: (id: string) =>
    request<AgentEvent[]>(`/tasks/${id}/events`),

  /** Request cancellation of an active task. Idempotent. */
  cancelTask: (id: string) =>
    request<{ ok: boolean; message: string }>(`/tasks/${id}/cancel`, 'POST'),
};
