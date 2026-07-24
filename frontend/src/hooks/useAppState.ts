import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  TreeNode,
  OpenFile,
  SidebarPanel,
  GitStatusResult,
  ProviderInfo,
  ReasoningEffort,
  AiJob,
  AiJobLog,
} from '../types';
import { detectLanguage } from '../lib/utils';
import { fs, git, ai } from '../lib/api';
import { authenticatedFetch } from '../lib/supabase';
import {
  createChatSession,
  defaultPreferences,
  deleteCloudSession,
  ensureCloudProject,
  loadCloudMemory,
  loadLocalSnapshot,
  mergeSessions,
  saveCloudMessage,
  saveCloudPreferences,
  saveCloudSession,
  saveLocalSnapshot,
  titleForMessage,
  type AppPreferences,
  type ChatSession,
  type PersistedChatMessage,
} from '../lib/persistence';
import { applyAppearance, type Appearance } from '../lib/appearance';

export interface AppState {
  appearance: Appearance;
  projectPath: string | null;
  projectTree: TreeNode | null;
  projectLoading: boolean;
  projectCloudId: string | null;
  openFiles: OpenFile[];
  activeFile: string | null;
  sidebarPanel: SidebarPanel;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  terminalVisible: boolean;
  terminalHeight: number;
  terminalSessionId: string | null;
  aiPanelVisible: boolean;
  aiPanelWidth: number;
  chatMessages: PersistedChatMessage[];
  chatSessions: ChatSession[];
  activeChatSessionId: string | null;
  aiLoading: boolean;
  activeJobId: string | null;
  activeJobSessionId: string | null;
  activeJobLogs: AiJobLog[];
  agentStatus: string;
  selectedProvider: string;
  selectedModel: string;
  apiKey: string;
  reasoningEffort: ReasoningEffort;
  failoverEnabled: boolean;
  creditsConsumed: number;
  providers: ProviderInfo[];
  profileAvatarUrl: string;
  gitStatus: GitStatusResult | null;
  gitLog: { hash: string; author: string; date: string; message: string }[];
  diffPreview: {
    path: string;
    newContent: string;
    additions: number;
    deletions: number;
  } | null;
  connectionState: 'connected' | 'disconnected' | 'loading';
  memoryState: 'local' | 'syncing' | 'synced' | 'offline';
}

function initialState(): AppState {
  const snapshot = loadLocalSnapshot();
  const sessions = snapshot.sessions.length
    ? snapshot.sessions
    : [createChatSession(
      snapshot.preferences.selectedProvider,
      snapshot.preferences.selectedModel,
      null,
    )];
  const activeSession = sessions.find(session => session.id === snapshot.activeSessionId) ?? sessions[0];
  return {
    appearance: snapshot.preferences.appearance,
    projectPath: null,
    projectTree: null,
    projectLoading: false,
    projectCloudId: activeSession.projectId,
    openFiles: [],
    activeFile: null,
    sidebarPanel: 'files',
    sidebarWidth: snapshot.preferences.sidebarWidth,
    sidebarCollapsed: snapshot.preferences.sidebarCollapsed,
    terminalVisible: snapshot.preferences.terminalVisible,
    terminalHeight: snapshot.preferences.terminalHeight,
    terminalSessionId: null,
    aiPanelVisible: snapshot.preferences.aiPanelVisible,
    aiPanelWidth: snapshot.preferences.aiPanelWidth,
    chatMessages: activeSession.messages,
    chatSessions: sessions,
    activeChatSessionId: activeSession.id,
    aiLoading: Boolean(snapshot.activeJobId),
    activeJobId: snapshot.activeJobId,
    activeJobSessionId: snapshot.activeJobSessionId,
    activeJobLogs: [],
    agentStatus: snapshot.activeJobId ? 'Reconnecting to background build' : 'Ready',
    selectedProvider: snapshot.preferences.selectedProvider,
    selectedModel: snapshot.preferences.selectedModel,
    apiKey: '',
    reasoningEffort: snapshot.preferences.reasoningEffort,
    failoverEnabled: snapshot.preferences.failoverEnabled,
    creditsConsumed: 0,
    providers: [],
    profileAvatarUrl: snapshot.preferences.profileAvatarUrl,
    gitStatus: null,
    gitLog: [],
    diffPreview: null,
    connectionState: navigator.onLine ? 'connected' : 'disconnected',
    memoryState: 'local',
  };
}

function currentPreferences(state: AppState): AppPreferences {
  return {
    ...defaultPreferences,
    appearance: state.appearance,
    selectedProvider: state.selectedProvider,
    selectedModel: state.selectedModel,
    reasoningEffort: state.reasoningEffort,
    failoverEnabled: state.failoverEnabled,
    sidebarWidth: state.sidebarWidth,
    sidebarCollapsed: state.sidebarCollapsed,
    terminalVisible: state.terminalVisible,
    terminalHeight: state.terminalHeight,
    aiPanelVisible: state.aiPanelVisible,
    aiPanelWidth: state.aiPanelWidth,
    lastProjectPath: state.projectPath,
    profileAvatarUrl: state.profileAvatarUrl,
  };
}

export function useAppState() {
  const initialSnapshot = useMemo(loadLocalSnapshot, []);
  const [state, setState] = useState<AppState>(initialState);
  const stateRef = useRef(state);
  const cancelAgentRef = useRef(false);
  const resumedJobRef = useRef<string | null>(null);
  const resumedProjectRef = useRef(false);
  stateRef.current = state;

  const update = useCallback((patch: Partial<AppState>) => {
    setState(prev => {
      const next = { ...prev, ...patch };
      if (
        prev.activeChatSessionId
        && (patch.selectedProvider || patch.selectedModel || patch.chatMessages)
      ) {
        next.chatSessions = prev.chatSessions.map(session => session.id === prev.activeChatSessionId
          ? {
            ...session,
            provider: patch.selectedProvider ?? session.provider,
            model: patch.selectedModel ?? session.model,
            messages: patch.chatMessages ?? session.messages,
            updatedAt: new Date().toISOString(),
          }
          : session);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onOnline = () => update({ connectionState: 'connected' });
    const onOffline = () => update({ connectionState: 'disconnected', memoryState: 'offline' });
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [update]);

  useEffect(() => {
    applyAppearance(state.appearance);
  }, [state.appearance]);

  useEffect(() => {
    const preferences = currentPreferences(state);
    saveLocalSnapshot({
      version: 2,
      preferences,
      activeSessionId: state.activeChatSessionId,
      sessions: state.chatSessions,
      activeJobId: state.activeJobId,
      activeJobSessionId: state.activeJobSessionId,
    });
  }, [
    state.activeChatSessionId,
    state.activeJobId,
    state.activeJobSessionId,
    state.appearance,
    state.aiPanelVisible,
    state.aiPanelWidth,
    state.chatSessions,
    state.failoverEnabled,
    state.profileAvatarUrl,
    state.projectPath,
    state.reasoningEffort,
    state.selectedModel,
    state.selectedProvider,
    state.sidebarCollapsed,
    state.sidebarWidth,
    state.terminalHeight,
    state.terminalVisible,
  ]);

  useEffect(() => {
    let cancelled = false;
    update({ memoryState: 'syncing' });
    loadCloudMemory()
      .then(({ preferences, sessions }) => {
        if (cancelled) return;
        setState(prev => {
          const merged = mergeSessions(prev.chatSessions, sessions);
          const active = merged.find(session => session.id === prev.activeChatSessionId) ?? merged[0];
          return {
            ...prev,
            appearance: preferences.appearance ?? prev.appearance,
            selectedProvider: preferences.selectedProvider ?? prev.selectedProvider,
            selectedModel: preferences.selectedModel ?? prev.selectedModel,
            reasoningEffort: preferences.reasoningEffort ?? prev.reasoningEffort,
            failoverEnabled: preferences.failoverEnabled ?? prev.failoverEnabled,
            profileAvatarUrl: preferences.profileAvatarUrl ?? prev.profileAvatarUrl,
            sidebarWidth: preferences.sidebarWidth ?? prev.sidebarWidth,
            sidebarCollapsed: preferences.sidebarCollapsed ?? prev.sidebarCollapsed,
            terminalVisible: preferences.terminalVisible ?? prev.terminalVisible,
            terminalHeight: preferences.terminalHeight ?? prev.terminalHeight,
            aiPanelVisible: preferences.aiPanelVisible ?? prev.aiPanelVisible,
            aiPanelWidth: preferences.aiPanelWidth ?? prev.aiPanelWidth,
            chatSessions: merged,
            activeChatSessionId: active?.id ?? null,
            chatMessages: active?.messages ?? [],
            memoryState: 'synced',
          };
        });
      })
      .catch(error => {
        console.warn('Cloud memory unavailable; continuing locally:', error);
        if (!cancelled) update({ memoryState: navigator.onLine ? 'local' : 'offline' });
      });
    return () => { cancelled = true; };
  }, [update]);

  useEffect(() => {
    if (state.memoryState !== 'synced') return;
    const handle = window.setTimeout(() => {
      const preferences = currentPreferences(stateRef.current);
      void saveCloudPreferences(preferences);
    }, 500);
    return () => window.clearTimeout(handle);
  }, [
    state.appearance,
    state.aiPanelVisible,
    state.aiPanelWidth,
    state.failoverEnabled,
    state.memoryState,
    state.profileAvatarUrl,
    state.projectPath,
    state.reasoningEffort,
    state.selectedModel,
    state.selectedProvider,
    state.sidebarCollapsed,
    state.sidebarWidth,
    state.terminalHeight,
    state.terminalVisible,
  ]);

  const refreshGit = useCallback(async (projectPath?: string) => {
    const path = projectPath ?? stateRef.current.projectPath;
    if (!path) return;
    try {
      const [status, log] = await Promise.all([git.status(path), git.log(path)]);
      update({ gitStatus: status, gitLog: log });
    } catch (error) {
      console.error('Failed to refresh git:', error);
    }
  }, [update]);

  const loadProviders = useCallback(async () => {
    try {
      update({ connectionState: 'loading' });
      const providers = await ai.providers();
      update({ providers, connectionState: 'connected' });
    } catch (error) {
      console.error('Failed to load providers:', error);
      update({ connectionState: 'disconnected' });
    }
  }, [update]);

  const openProject = useCallback(async (path: string) => {
    update({ projectLoading: true });
    try {
      const result = await fs.openProject(path);
      const projectCloudId = await ensureCloudProject(path);
      setState(prev => {
        const now = new Date().toISOString();
        const current = prev.chatSessions.find(session => session.id === prev.activeChatSessionId);
        const needsNewSession = !current || current.messages.length > 0 || current.projectPath !== path;
        const session = needsNewSession
          ? createChatSession(prev.selectedProvider, prev.selectedModel, path, projectCloudId)
          : { ...current, projectPath: path, projectId: projectCloudId, updatedAt: now };
        const sessions = needsNewSession
          ? [session, ...prev.chatSessions]
          : prev.chatSessions.map(item => item.id === session.id ? session : item);
        void saveCloudSession(session);
        return {
          ...prev,
          projectTree: result.tree,
          projectPath: path,
          projectCloudId,
          projectLoading: false,
          chatSessions: sessions,
          activeChatSessionId: session.id,
          chatMessages: session.messages,
        };
      });
      void refreshGit(path);
      void loadProviders();
    } catch (error) {
      console.error('Failed to open project:', error);
      update({ projectLoading: false, projectPath: null, projectTree: null });
    }
  }, [loadProviders, refreshGit, update]);

  useEffect(() => {
    if (resumedProjectRef.current) return;
    resumedProjectRef.current = true;
    const path = initialSnapshot.preferences.lastProjectPath;
    if (path) void openProject(path);
    else void loadProviders();
  }, [initialSnapshot.preferences.lastProjectPath, loadProviders, openProject]);

  const closeProject = useCallback(() => {
    update({
      projectPath: null,
      projectTree: null,
      projectCloudId: null,
      openFiles: [],
      activeFile: null,
      gitStatus: null,
      gitLog: [],
      terminalSessionId: null,
    });
  }, [update]);

  const openFile = useCallback(async (filePath: string) => {
    const current = stateRef.current;
    if (!current.projectPath) return;
    const fullPath = filePath.startsWith(`${current.projectPath}/`)
      ? filePath
      : `${current.projectPath}/${filePath}`;
    const existing = current.openFiles.find(file => file.path === fullPath);
    if (existing) {
      update({ activeFile: fullPath });
      return;
    }
    try {
      const file = await fs.readFile(fullPath);
      update({
        openFiles: [...stateRef.current.openFiles, {
          path: fullPath,
          content: file.content,
          originalContent: file.content,
          modified: false,
          language: detectLanguage(fullPath),
        }],
        activeFile: fullPath,
      });
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  }, [update]);

  const closeFile = useCallback((filePath: string) => {
    const current = stateRef.current;
    const openFiles = current.openFiles.filter(file => file.path !== filePath);
    update({
      openFiles,
      activeFile: current.activeFile === filePath
        ? openFiles[openFiles.length - 1]?.path ?? null
        : current.activeFile,
    });
  }, [update]);

  const updateFileContent = useCallback((filePath: string, content: string) => {
    update({
      openFiles: stateRef.current.openFiles.map(file => file.path === filePath
        ? { ...file, content, modified: content !== file.originalContent }
        : file),
    });
  }, [update]);

  const saveFile = useCallback(async (filePath: string) => {
    const file = stateRef.current.openFiles.find(item => item.path === filePath);
    if (!file) return;
    try {
      await fs.writeFile(filePath, file.content);
      update({
        openFiles: stateRef.current.openFiles.map(item => item.path === filePath
          ? { ...item, originalContent: item.content, modified: false }
          : item),
      });
      void refreshGit();
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }, [refreshGit, update]);

  const saveAllFiles = useCallback(async () => {
    for (const file of stateRef.current.openFiles.filter(item => item.modified)) {
      await saveFile(file.path);
    }
  }, [saveFile]);

  const newConversation = useCallback(() => {
    const current = stateRef.current;
    const session = createChatSession(
      current.selectedProvider,
      current.selectedModel,
      current.projectPath,
      current.projectCloudId,
    );
    setState(prev => ({
      ...prev,
      chatSessions: [session, ...prev.chatSessions],
      activeChatSessionId: session.id,
      chatMessages: [],
      activeJobLogs: [],
      agentStatus: 'Ready',
    }));
    void saveCloudSession(session);
  }, []);

  const selectConversation = useCallback((sessionId: string) => {
    setState(prev => {
      const session = prev.chatSessions.find(item => item.id === sessionId);
      if (!session) return prev;
      return {
        ...prev,
        activeChatSessionId: session.id,
        chatMessages: session.messages,
        selectedProvider: session.provider,
        selectedModel: session.model,
        agentStatus: 'Ready',
        activeJobLogs: [],
      };
    });
  }, []);

  const deleteConversation = useCallback((sessionId: string) => {
    setState(prev => {
      const remaining = prev.chatSessions.filter(session => session.id !== sessionId);
      const fallback = remaining[0] ?? createChatSession(
        prev.selectedProvider,
        prev.selectedModel,
        prev.projectPath,
        prev.projectCloudId,
      );
      return {
        ...prev,
        chatSessions: remaining.length ? remaining : [fallback],
        activeChatSessionId: prev.activeChatSessionId === sessionId ? fallback.id : prev.activeChatSessionId,
        chatMessages: prev.activeChatSessionId === sessionId ? fallback.messages : prev.chatMessages,
      };
    });
    void deleteCloudSession(sessionId);
  }, []);

  const appendMessage = useCallback((sessionId: string, message: PersistedChatMessage) => {
    let sessionToSync: ChatSession | null = null;
    setState(prev => {
      const sessions = prev.chatSessions.map(session => {
        if (session.id !== sessionId) return session;
        const updated: ChatSession = {
          ...session,
          title: session.messages.length === 0 && message.role === 'user'
            ? titleForMessage(message.content)
            : session.title,
          provider: message.provider ?? session.provider,
          model: message.model ?? session.model,
          updatedAt: message.createdAt,
          messages: [...session.messages, message],
        };
        sessionToSync = updated;
        return updated;
      }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return {
        ...prev,
        chatSessions: sessions,
        chatMessages: prev.activeChatSessionId === sessionId
          ? sessions.find(session => session.id === sessionId)?.messages ?? prev.chatMessages
          : prev.chatMessages,
      };
    });
    window.setTimeout(() => {
      if (sessionToSync) void saveCloudMessage(sessionToSync, message);
    }, 0);
  }, []);

  const completeJob = useCallback((job: AiJob, sessionId: string) => {
    if (job.status === 'completed' && job.response) {
      appendMessage(sessionId, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: job.response.content
          .replace(/\[ARCHON_DONE\]/g, '')
          .replace(/\[ARCHON_BLOCKED:[^\]]+\]/g, '')
          .trim(),
        provider: job.response.provider,
        model: job.response.model,
        createdAt: new Date().toISOString(),
      });
      update({
        aiLoading: false,
        activeJobId: null,
        activeJobSessionId: null,
        activeJobLogs: job.logs,
        creditsConsumed: stateRef.current.creditsConsumed + job.response.credit_units,
        agentStatus: 'Build finished',
      });
      return true;
    }
    if (job.status === 'failed' || job.status === 'timed_out') {
      appendMessage(sessionId, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Build stopped: ${job.error ?? 'The background task could not finish.'}`,
        createdAt: new Date().toISOString(),
      });
      update({
        aiLoading: false,
        activeJobId: null,
        activeJobSessionId: null,
        activeJobLogs: job.logs,
        agentStatus: job.status === 'timed_out' ? 'Build timed out' : 'Build failed',
      });
      return true;
    }
    return false;
  }, [appendMessage, update]);

  const pollJob = useCallback(async (jobId: string, sessionId: string) => {
    cancelAgentRef.current = false;
    for (let attempt = 0; attempt < 900 && !cancelAgentRef.current; attempt += 1) {
      try {
        const job = await ai.getJob(jobId);
        update({
          aiLoading: true,
          activeJobId: job.id,
          activeJobLogs: job.logs,
          agentStatus: job.logs[job.logs.length - 1]?.summary ?? 'Build running in background',
        });
        if (completeJob(job, sessionId)) return;
      } catch (error) {
        console.warn('Background build reconnect failed:', error);
        update({
          aiLoading: false,
          activeJobId: null,
          activeJobSessionId: null,
          agentStatus: 'Build connection lost — conversation is safe locally',
          connectionState: 'disconnected',
        });
        return;
      }
      await new Promise(resolve => window.setTimeout(resolve, 2000));
    }
    if (cancelAgentRef.current) {
      update({ aiLoading: false, agentStatus: 'Detached — build continues in the background' });
    }
  }, [completeJob, update]);

  useEffect(() => {
    if (!state.activeJobId || resumedJobRef.current === state.activeJobId) return;
    resumedJobRef.current = state.activeJobId;
    const sessionId = state.activeJobSessionId ?? initialSnapshot.activeJobSessionId ?? state.activeChatSessionId;
    if (sessionId) void pollJob(state.activeJobId, sessionId);
  }, [initialSnapshot.activeJobSessionId, pollJob, state.activeChatSessionId, state.activeJobId, state.activeJobSessionId]);

  const sendChatMessage = useCallback(async (content: string) => {
    const current = stateRef.current;
    let sessionId = current.activeChatSessionId;
    if (!sessionId) {
      const session = createChatSession(
        current.selectedProvider,
        current.selectedModel,
        current.projectPath,
        current.projectCloudId,
      );
      sessionId = session.id;
      setState(prev => ({
        ...prev,
        chatSessions: [session, ...prev.chatSessions],
        activeChatSessionId: session.id,
        chatMessages: [],
      }));
      await saveCloudSession(session);
    }

    const userMessage: PersistedChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      provider: current.selectedProvider,
      model: current.selectedModel,
      createdAt: new Date().toISOString(),
    };
    appendMessage(sessionId, userMessage);
    update({ aiLoading: true, agentStatus: 'Planning and starting build', activeJobLogs: [] });

    const activeFile = current.openFiles.find(file => file.path === current.activeFile);
    const projectLabel = current.projectPath ?? 'the current workspace';
    const systemContent = [
      `You are Archon, an autonomous coding agent working in ${projectLabel}.`,
      activeFile
        ? `The active file is ${activeFile.path}:\n\`\`\`${activeFile.language}\n${activeFile.content.slice(0, 12000)}\n\`\`\``
        : '',
      'Automatically decide whether planning is needed, then execute the work without asking the user to switch modes, approve the plan, or say continue.',
      'Keep going through implementation and verification. Ask only for a genuine missing decision or authority.',
      'End with [ARCHON_DONE] only when complete or [ARCHON_BLOCKED: reason] for a genuine blocker.',
    ].filter(Boolean).join('\n\n');
    const session = stateRef.current.chatSessions.find(item => item.id === sessionId);
    const messages = [
      { role: 'system' as const, content: systemContent },
      ...(session?.messages ?? []).slice(-30).map(message => ({ role: message.role, content: message.content })),
      { role: 'user' as const, content },
    ];
    const fallbackModels = current.failoverEnabled
      ? current.providers
        .filter(provider => provider.id !== current.selectedProvider && provider.configured && provider.models[0])
        .map(provider => ({ provider: provider.id, model: provider.models[0].id }))
      : [];

    try {
      const job = await ai.createJob(messages, {
        provider: current.selectedProvider,
        model: current.selectedModel,
        apiKey: current.apiKey || undefined,
        reasoningEffort: current.reasoningEffort,
        fallbackModels,
      });
      resumedJobRef.current = job.id;
      update({ activeJobId: job.id, activeJobSessionId: sessionId, activeJobLogs: job.logs });
      await pollJob(job.id, sessionId);
    } catch (jobError) {
      console.warn('Background build unavailable, falling back to a direct request:', jobError);
      try {
        const response = await ai.chat(messages, {
          provider: current.selectedProvider,
          model: current.selectedModel,
          apiKey: current.apiKey,
          reasoningEffort: current.reasoningEffort,
        });
        appendMessage(sessionId, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.content.replace(/\[ARCHON_DONE\]/g, '').trim(),
          provider: response.provider,
          model: response.model,
          createdAt: new Date().toISOString(),
        });
        update({
          aiLoading: false,
          activeJobId: null,
          activeJobSessionId: null,
          creditsConsumed: current.creditsConsumed + response.credit_units,
          agentStatus: 'Task finished',
        });
      } catch (error) {
        appendMessage(sessionId, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Request failed'}`,
          createdAt: new Date().toISOString(),
        });
        update({ aiLoading: false, activeJobId: null, activeJobSessionId: null, agentStatus: 'Task failed' });
      }
    }
  }, [appendMessage, pollJob, update]);

  const stopAgent = useCallback(() => {
    cancelAgentRef.current = true;
    update({ agentStatus: 'Detaching — server build will continue' });
  }, [update]);

  const showDiffPreview = useCallback(async (filePath: string, newContent: string) => {
    try {
      const response = await authenticatedFetch('/api/diff/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, new_content: newContent }),
      });
      const preview = await response.json();
      update({
        diffPreview: {
          path: filePath,
          newContent,
          additions: preview.additions,
          deletions: preview.deletions,
        },
      });
    } catch (error) {
      console.error('Failed to preview diff:', error);
    }
  }, [update]);

  const acceptDiff = useCallback(async () => {
    const current = stateRef.current;
    if (!current.diffPreview) return;
    try {
      await fs.writeFile(current.diffPreview.path, current.diffPreview.newContent);
      update({
        openFiles: current.openFiles.map(file => file.path === current.diffPreview?.path
          ? {
            ...file,
            content: current.diffPreview.newContent,
            originalContent: current.diffPreview.newContent,
            modified: false,
          }
          : file),
        diffPreview: null,
      });
      void refreshGit();
    } catch (error) {
      console.error('Failed to apply diff:', error);
    }
  }, [refreshGit, update]);

  const rejectDiff = useCallback(() => update({ diffPreview: null }), [update]);

  return {
    state,
    update,
    openProject,
    closeProject,
    openFile,
    closeFile,
    updateFileContent,
    saveFile,
    saveAllFiles,
    refreshGit,
    newConversation,
    selectConversation,
    deleteConversation,
    sendChatMessage,
    stopAgent,
    showDiffPreview,
    acceptDiff,
    rejectDiff,
  };
}
