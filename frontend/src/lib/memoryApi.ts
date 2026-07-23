import { authenticatedFetch } from './supabase';

export interface MemoryEntry {
  id: string;
  kind: 'task_summary' | 'file_changed' | 'observation';
  content: string;
  task_id: string;
  created_at: string;
}

const KIND_LABEL: Record<MemoryEntry['kind'], string> = {
  task_summary: 'Task',
  file_changed: 'File',
  observation: 'Note',
};

const KIND_COLOR: Record<MemoryEntry['kind'], string> = {
  task_summary: 'var(--accent)',
  file_changed: 'var(--success)',
  observation: 'var(--warning)',
};

export { KIND_LABEL, KIND_COLOR };

async function request<T>(path: string, method = 'GET'): Promise<T> {
  const res = await authenticatedFetch(path, { method });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const memoryApi = {
  getMemory: (workspacePath: string) =>
    request<MemoryEntry[]>(
      `/api/agent/memory?workspace_path=${encodeURIComponent(workspacePath)}`
    ),

  clearMemory: (workspacePath: string) =>
    request<{ ok: boolean }>(
      `/api/agent/memory?workspace_path=${encodeURIComponent(workspacePath)}`,
      'DELETE'
    ),
};
