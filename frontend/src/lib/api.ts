// ============================================
// API client for Archon backend
// ============================================

import type {
  TreeNode,
  FileContent,
  GitStatusResult,
  GitLogEntry,
  DiffPreview,
  ChatMessage,
  ChatResponse,
  ProviderInfo,
  SearchResult,
  DiffEntry,
} from '../types';

const API_BASE = '/api';

async function request<T>(
  path: string,
  method: string = 'GET',
  body?: unknown
): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Filesystem API
export const fs = {
  openProject: (path: string) =>
    request<{ path: string; tree: TreeNode }>(
      '/project/open',
      'POST',
      { path }
    ),

  readFile: (path: string) =>
    request<FileContent>('/fs/read', 'POST', { path }),

  writeFile: (path: string, content: string) =>
    request<{ ok: boolean }>('/fs/write', 'POST', { path, content }),

  listTree: (root: string, maxDepth?: number) =>
    request<TreeNode>('/fs/tree', 'POST', { root, max_depth: maxDepth }),

  mkdir: (path: string) =>
    request<{ ok: boolean }>('/fs/mkdir', 'POST', { path }),

  rename: (from: string, to: string) =>
    request<{ ok: boolean }>('/fs/rename', 'POST', { from, to }),

  deletePath: (path: string) =>
    request<{ ok: boolean }>('/fs/delete', 'POST', { path }),

  search: (root: string, query: string) =>
    request<SearchResult[]>('/fs/search', 'POST', { root, query }),
};

// Git API
export const git = {
  status: (projectPath: string) =>
    request<GitStatusResult>('/git/status', 'POST', { project_path: projectPath }),

  diff: (projectPath: string) =>
    request<DiffEntry[]>('/git/diff', 'POST', { project_path: projectPath }),

  log: (projectPath: string) =>
    request<GitLogEntry[]>('/git/log', 'POST', { project_path: projectPath }),

  branches: (projectPath: string) =>
    request<{ name: string; is_current: boolean }[]>(
      '/git/branches',
      'POST',
      { project_path: projectPath }
    ),

  commit: (projectPath: string, message: string, files?: string[]) =>
    request<{ ok: boolean; commit: string }>(
      '/git/commit',
      'POST',
      { project_path: projectPath, message, files }
    ),
};

// AI API
export const ai = {
  providers: () => request<ProviderInfo[]>('/ai/providers'),

  chat: (messages: ChatMessage[], options?: {
    model?: string;
    provider?: string;
    maxTokens?: number;
    temperature?: number;
  }) =>
    request<ChatResponse>('/ai/chat', 'POST', {
      messages,
      model: options?.model,
      provider: options?.provider,
      max_tokens: options?.maxTokens,
      temperature: options?.temperature,
    }),
};

// Diff API
export const diff = {
  preview: (path: string, newContent: string) =>
    request<DiffPreview>('/diff/preview', 'POST', { path, new_content: newContent }),

  apply: (path: string, newContent: string) =>
    request<{ ok: boolean; diff: string }>(
      '/diff/apply',
      'POST',
      { path, new_content: newContent }
    ),
};
