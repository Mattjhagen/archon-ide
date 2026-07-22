// ============================================
// Core domain types for Archon IDE
// ============================================

export interface TreeNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: TreeNode[];
  depth: number;
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
  is_binary: boolean;
}

export interface GitFileStatus {
  path: string;
  status: 'new' | 'modified' | 'deleted' | 'renamed' | 'unchanged';
  staged: boolean;
}

export interface GitStatusResult {
  branch: string;
  files: GitFileStatus[];
  ahead: number;
  behind: number;
}

export interface GitLogEntry {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export interface DiffHunk {
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  content: string;
}

export interface DiffPreview {
  path: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
  model: string;
  provider: string;
  tokens_used: {
    input: number;
    output: number;
  };
}

export interface ProviderInfo {
  id: string;
  name: string;
  models: ModelInfo[];
  requires_key: boolean;
  configured: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
}

export interface SearchResult {
  path: string;
  line: number;
  content: string;
}

export interface DiffEntry {
  path: string;
  status: string;
  content: string;
}

// App state types
export type SidebarPanel = 'files' | 'git' | 'search';

export interface AppState {
  projectPath: string | null;
  openFiles: OpenFile[];
  activeFile: string | null;
  sidebarPanel: SidebarPanel;
  sidebarWidth: number;
  terminalVisible: boolean;
  aiPanelVisible: boolean;
  aiPanelWidth: number;
  terminalHeight: number;
}

export interface OpenFile {
  path: string;
  content: string;
  originalContent: string;
  modified: boolean;
  language: string;
}

export interface TerminalSession {
  id: string;
}

// Provider adapter types
export type ProviderId = 'openai' | 'anthropic' | 'ollama' | 'mock';
export type ModelId = string;
