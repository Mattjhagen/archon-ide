// ============================================
// Core application state hook
// ============================================

import { useState, useCallback } from 'react';
import type { TreeNode, OpenFile, SidebarPanel, GitStatusResult, ProviderInfo } from '../types';
import { detectLanguage } from '../lib/utils';
import { fs, git, ai } from '../lib/api';

export interface AppState {
  // Project
  projectPath: string | null;
  projectTree: TreeNode | null;
  projectLoading: boolean;

  // Files
  openFiles: OpenFile[];
  activeFile: string | null;

  // Sidebar
  sidebarPanel: SidebarPanel;
  sidebarWidth: number;
  sidebarCollapsed: boolean;

  // Terminal
  terminalVisible: boolean;
  terminalHeight: number;
  terminalSessionId: string | null;

  // AI
  aiPanelVisible: boolean;
  aiPanelWidth: number;
  chatMessages: { role: 'user' | 'assistant'; content: string }[];
  aiLoading: boolean;
  selectedProvider: string;
  selectedModel: string;
  apiKey: string;
  providers: ProviderInfo[];

  // Git
  gitStatus: GitStatusResult | null;
  gitLog: { hash: string; author: string; date: string; message: string }[];

  // Diff
  diffPreview: {
    path: string;
    newContent: string;
    additions: number;
    deletions: number;
  } | null;

  // Connection
  connectionState: 'connected' | 'disconnected' | 'loading';
}

export function useAppState() {
  const [state, setState] = useState<AppState>({
    projectPath: null,
    projectTree: null,
    projectLoading: false,
    openFiles: [],
    activeFile: null,
    sidebarPanel: 'files',
    sidebarWidth: 260,
    sidebarCollapsed: false,
    terminalVisible: false,
    terminalHeight: 200,
    terminalSessionId: null,
    aiPanelVisible: true,
    aiPanelWidth: 380,
    chatMessages: [],
    aiLoading: false,
    selectedProvider: 'mock',
    selectedModel: 'mock-responses',
    apiKey: '',
    providers: [],
    gitStatus: null,
    gitLog: [],
    diffPreview: null,
    connectionState: 'connected',
  });

  const update = useCallback((patch: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  // Project actions
  const openProject = useCallback(async (path: string) => {
    update({ projectLoading: true, projectPath: path });
    try {
      const result = await fs.openProject(path);
      update({ projectTree: result.tree, projectPath: path, projectLoading: false });
      // Refresh git status
      refreshGit(path);
      // Load providers
      loadProviders();
    } catch (e) {
      console.error('Failed to open project:', e);
      update({ projectLoading: false });
    }
  }, [update]);

  // File actions
  const openFile = useCallback(async (filePath: string) => {
    const current = state.projectPath;
    if (!current) return;
    const fullPath = `${current}/${filePath}`;

    // Check if already open
    const existing = state.openFiles.find(f => f.path === fullPath);
    if (existing) {
      update({ activeFile: fullPath });
      return;
    }

    try {
      const file = await fs.readFile(fullPath);
      const openFile: OpenFile = {
        path: fullPath,
        content: file.content,
        originalContent: file.content,
        modified: false,
        language: detectLanguage(fullPath),
      };
      update({
        openFiles: [...state.openFiles, openFile],
        activeFile: fullPath,
      });
    } catch (e) {
      console.error('Failed to open file:', e);
    }
  }, [state.openFiles, state.projectPath, update]);

  const closeFile = useCallback((filePath: string) => {
    const newFiles = state.openFiles.filter(f => f.path !== filePath);
    const newActive = state.activeFile === filePath
      ? (newFiles.length > 0 ? newFiles[newFiles.length - 1].path : null)
      : state.activeFile;
    update({ openFiles: newFiles, activeFile: newActive });
  }, [state.openFiles, state.activeFile, update]);

  const updateFileContent = useCallback((filePath: string, content: string) => {
    const newFiles = state.openFiles.map(f => {
      if (f.path === filePath) {
        return {
          ...f,
          content,
          modified: content !== f.originalContent,
        };
      }
      return f;
    });
    update({ openFiles: newFiles });
  }, [state.openFiles, update]);

  const saveFile = useCallback(async (filePath: string) => {
    const file = state.openFiles.find(f => f.path === filePath);
    if (!file) return;
    try {
      await fs.writeFile(filePath, file.content);
      const newFiles = state.openFiles.map(f => {
        if (f.path === filePath) {
          return { ...f, originalContent: f.content, modified: false };
        }
        return f;
      });
      update({ openFiles: newFiles });
      // Refresh git status after save
      if (state.projectPath) refreshGit(state.projectPath);
    } catch (e) {
      console.error('Failed to save file:', e);
    }
  }, [state.openFiles, state.projectPath, update]);

  const saveAllFiles = useCallback(async () => {
    for (const file of state.openFiles.filter(f => f.modified)) {
      await saveFile(file.path);
    }
  }, [state.openFiles, saveFile]);

  // Git actions
  const refreshGit = useCallback(async (projectPath?: string) => {
    const p = projectPath ?? state.projectPath;
    if (!p) return;
    try {
      const [status, log] = await Promise.all([
        git.status(p),
        git.log(p),
      ]);
      update({ gitStatus: status, gitLog: log });
    } catch (e) {
      console.error('Failed to refresh git:', e);
    }
  }, [state.projectPath, update]);

  // AI actions
  const loadProviders = useCallback(async () => {
    try {
      const providers = await ai.providers();
      update({ providers });
    } catch (e) {
      console.error('Failed to load providers:', e);
    }
  }, [update]);

  const sendChatMessage = useCallback(async (message: string) => {
    const newMessages = [...state.chatMessages, { role: 'user' as const, content: message }];
    update({ chatMessages: newMessages, aiLoading: true });

    try {
      const activeFile = state.openFiles.find(f => f.path === state.activeFile);
      const systemContent = activeFile
        ? `You are an AI coding assistant. The user is working on a file: ${activeFile.path}\n\nCurrent file content:\n\`\`\`${activeFile.language}\n${activeFile.content.slice(0, 4000)}\n\`\`\`\n\nAnswer concisely and helpfully. Use markdown for code blocks.`
        : 'You are an AI coding assistant. Answer concisely and helpfully.';

      const messages = [
        { role: 'system' as const, content: systemContent },
        ...newMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];

      const response = await ai.chat(messages, {
        provider: state.selectedProvider,
        model: state.selectedModel,
        apiKey: state.apiKey,
      });

      update({
        chatMessages: [...newMessages, { role: 'assistant', content: response.content }],
        aiLoading: false,
      });
    } catch (e) {
      console.error('AI request failed:', e);
      update({
        chatMessages: [
          ...newMessages,
          { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : 'Request failed'}` },
        ],
        aiLoading: false,
      });
    }
  }, [state.chatMessages, state.openFiles, state.activeFile, state.selectedProvider, state.selectedModel, state.apiKey, update]);

  // Diff actions
  const showDiffPreview = useCallback(async (filePath: string, newContent: string) => {
    try {
      const preview = await diff.preview(filePath, newContent);
      update({
        diffPreview: {
          path: filePath,
          newContent,
          additions: preview.additions,
          deletions: preview.deletions,
        },
      });
    } catch (e) {
      console.error('Failed to preview diff:', e);
    }
  }, [update]);

  const acceptDiff = useCallback(async () => {
    if (!state.diffPreview) return;
    try {
      await fs.writeFile(state.diffPreview.path, state.diffPreview.newContent);
      const newFiles = state.openFiles.map(f => {
        if (f.path === state.diffPreview!.path) {
          return {
            ...f,
            content: state.diffPreview!.newContent,
            originalContent: state.diffPreview!.newContent,
            modified: false,
          };
        }
        return f;
      });
      update({ openFiles: newFiles, diffPreview: null });
      if (state.projectPath) refreshGit(state.projectPath);
    } catch (e) {
      console.error('Failed to apply diff:', e);
    }
  }, [state.diffPreview, state.openFiles, state.projectPath, update, refreshGit]);

  const rejectDiff = useCallback(() => {
    update({ diffPreview: null });
  }, [update]);

  // Import diff module
  const diff = {
    preview: async (path: string, newContent: string) => {
      const res = await fetch('/api/diff/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, new_content: newContent }),
      });
      return res.json();
    },
  };

  return {
    state,
    update,
    openProject,
    openFile,
    closeFile,
    updateFileContent,
    saveFile,
    saveAllFiles,
    refreshGit,
    sendChatMessage,
    showDiffPreview,
    acceptDiff,
    rejectDiff,
  };
}
