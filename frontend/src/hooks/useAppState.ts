// ============================================
// Core application state hook
// ============================================

import { useState, useCallback, useRef } from 'react';
import type { TreeNode, OpenFile, SidebarPanel, GitStatusResult, ProviderInfo, ReasoningEffort } from '../types';
import { detectLanguage } from '../lib/utils';
import { fs, git, ai } from '../lib/api';
import { authenticatedFetch } from '../lib/supabase';

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
  agentStatus: string;
  selectedProvider: string;
  selectedModel: string;
  apiKey: string;
  reasoningEffort: ReasoningEffort;
  creditsConsumed: number;
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
  const cancelAgentRef = useRef(false);
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
    agentStatus: 'Ready',
    selectedProvider: 'mock',
    selectedModel: 'mock-responses',
    apiKey: '',
    reasoningEffort: 'medium',
    creditsConsumed: 0,
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
    cancelAgentRef.current = false;
    const newMessages = [...state.chatMessages, { role: 'user' as const, content: message }];
    update({ chatMessages: newMessages, aiLoading: true, agentStatus: 'Planning task' });

    try {
      const activeFile = state.openFiles.find(f => f.path === state.activeFile);
      const systemContent = activeFile
        ? `You are Archon, an autonomous coding agent working on ${activeFile.path}.\n\nCurrent file:\n\`\`\`${activeFile.language}\n${activeFile.content.slice(0, 12000)}\n\`\`\`\n\nWork continuously: plan, inspect context, reason, and verify. Never ask whether to continue. End with [ARCHON_DONE] only when complete or [ARCHON_BLOCKED: reason] for a genuine blocker.`
        : 'You are Archon, an autonomous coding agent. Work continuously: plan, analyze, verify, and continue without asking the user whether to proceed. End with [ARCHON_DONE] only when complete or [ARCHON_BLOCKED: reason] for a genuine blocker.';

      let workingMessages = [
        { role: 'system' as const, content: systemContent },
        ...newMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];
      const isDemoMode = state.selectedProvider === 'mock';
      const maxPasses = isDemoMode ? 1 : state.reasoningEffort === 'high' ? 12 : state.reasoningEffort === 'medium' ? 5 : 2;
      let visibleMessages = [...newMessages];
      let credits = state.creditsConsumed;

      for (let pass = 0; pass < maxPasses && !cancelAgentRef.current; pass += 1) {
        update({ agentStatus: pass === 0 ? 'Reasoning about the task' : `Continuing work · pass ${pass + 1}/${maxPasses}` });
        const response = await ai.chat(workingMessages, {
          provider: state.selectedProvider,
          model: state.selectedModel,
          apiKey: state.apiKey,
          reasoningEffort: state.reasoningEffort,
        });
        credits += response.credit_units;
        const cleaned = response.content.replace(/\[ARCHON_DONE\]/g, '').replace(/\[ARCHON_BLOCKED:[^\]]+\]/g, '').trim();
        visibleMessages = [...visibleMessages, { role: 'assistant' as const, content: cleaned }];
        update({ chatMessages: visibleMessages, creditsConsumed: credits });

        if (response.content.includes('[ARCHON_DONE]') || response.content.includes('[ARCHON_BLOCKED:')) break;
        workingMessages = [
          ...workingMessages,
          { role: 'assistant' as const, content: response.content },
          { role: 'user' as const, content: 'Continue working autonomously. Re-check the task, deepen the analysis, and finish it. Do not ask me a question and do not stop at a partial answer.' },
        ];
      }
      update({
        aiLoading: false,
        agentStatus: cancelAgentRef.current
          ? 'Stopped by user'
          : isDemoMode
            ? 'Demo complete — connect a model for real analysis'
            : 'Task finished',
      });
    } catch (e) {
      console.error('AI request failed:', e);
      update({
        chatMessages: [
          ...newMessages,
          { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : 'Request failed'}` },
        ],
        aiLoading: false,
        agentStatus: 'Task failed',
      });
    }
  }, [state.chatMessages, state.openFiles, state.activeFile, state.selectedProvider, state.selectedModel, state.apiKey, state.reasoningEffort, state.creditsConsumed, update]);

  const stopAgent = useCallback(() => {
    cancelAgentRef.current = true;
    update({ agentStatus: 'Stopping after current step' });
  }, [update]);

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
      const res = await authenticatedFetch('/api/diff/preview', {
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
    stopAgent,
    showDiffPreview,
    acceptDiff,
    rejectDiff,
  };
}
