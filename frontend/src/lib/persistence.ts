import { supabase } from './supabase';
import type { ReasoningEffort } from '../types';
import type { Appearance } from './appearance';

const SNAPSHOT_KEY = 'archon.web.snapshot.v2';

export interface PersistedChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  provider?: string;
  model?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  projectPath: string | null;
  projectId: string | null;
  provider: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messages: PersistedChatMessage[];
}

export interface AppPreferences {
  appearance: Appearance;
  selectedProvider: string;
  selectedModel: string;
  reasoningEffort: ReasoningEffort;
  failoverEnabled: boolean;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  terminalVisible: boolean;
  terminalHeight: number;
  aiPanelVisible: boolean;
  aiPanelWidth: number;
  aiPanelMode: 'chat' | 'tasks';
  lastProjectPath: string | null;
  profileAvatarUrl: string;
}

export interface LocalSnapshot {
  version: 2;
  preferences: AppPreferences;
  activeSessionId: string | null;
  sessions: ChatSession[];
  activeJobId: string | null;
  activeJobSessionId: string | null;
}

export const defaultPreferences: AppPreferences = {
  appearance: 'obsidian',
  selectedProvider: 'openai',
  selectedModel: 'gpt-5.6-terra',
  reasoningEffort: 'medium',
  failoverEnabled: true,
  sidebarWidth: 260,
  sidebarCollapsed: false,
  terminalVisible: false,
  terminalHeight: 200,
  aiPanelVisible: true,
  aiPanelWidth: 430,
  aiPanelMode: 'chat',
  lastProjectPath: null,
  profileAvatarUrl: '',
};

export function loadLocalSnapshot(): LocalSnapshot {
  try {
    const parsed = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? '') as Partial<LocalSnapshot>;
    return {
      version: 2,
      preferences: { ...defaultPreferences, ...(parsed.preferences ?? {}) },
      activeSessionId: parsed.activeSessionId ?? null,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      activeJobId: parsed.activeJobId ?? null,
      activeJobSessionId: parsed.activeJobSessionId ?? null,
    };
  } catch {
    return {
      version: 2,
      preferences: defaultPreferences,
      activeSessionId: null,
      sessions: [],
      activeJobId: null,
      activeJobSessionId: null,
    };
  }
}

export function saveLocalSnapshot(snapshot: LocalSnapshot) {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function createChatSession(
  provider: string,
  model: string,
  projectPath: string | null,
  projectId: string | null = null,
): ChatSession {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: projectPath ? `New chat · ${projectPath.split('/').filter(Boolean).pop() ?? 'Project'}` : 'New conversation',
    projectPath,
    projectId,
    provider,
    model,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function titleForMessage(content: string) {
  const title = content.replace(/\s+/g, ' ').trim();
  return title.length > 54 ? `${title.slice(0, 51)}…` : title || 'New conversation';
}

export async function ensureCloudProject(projectPath: string): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;
  const name = projectPath.split('/').filter(Boolean).pop() ?? projectPath;

  const { data: existing } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', user.id)
    .eq('web_path', projectPath)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: user.id, name, description: `Web workspace: ${projectPath}`, web_path: projectPath, status: 'active' })
    .select('id')
    .single();
  if (error) {
    console.warn('Could not link project to cloud memory:', error.message);
    return null;
  }
  return data.id as string;
}

export async function loadCloudMemory(): Promise<{
  preferences: Partial<AppPreferences>;
  sessions: ChatSession[];
}> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { preferences: {}, sessions: [] };

  const [{ data: preferenceRow }, { data: sessionRows, error: sessionError }] = await Promise.all([
    supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('chat_sessions')
      .select('id,title,provider,model,project_id,project_path,created_at,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50),
  ]);

  if (sessionError) throw sessionError;
  const rows = sessionRows ?? [];
  const sessionIds = rows.map(row => row.id as string);
  const { data: messageRows, error: messageError } = sessionIds.length
    ? await supabase
      .from('chat_messages')
      .select('id,session_id,role,content,provider,model,created_at')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: true })
    : { data: [], error: null };
  if (messageError) throw messageError;

  const messagesBySession = new Map<string, PersistedChatMessage[]>();
  for (const row of messageRows ?? []) {
    if (row.role !== 'user' && row.role !== 'assistant') continue;
    const current = messagesBySession.get(row.session_id as string) ?? [];
    current.push({
      id: row.id as string,
      role: row.role,
      content: row.content as string,
      provider: row.provider ?? undefined,
      model: row.model ?? undefined,
      createdAt: row.created_at as string,
    });
    messagesBySession.set(row.session_id as string, current);
  }

  const settings = (preferenceRow?.settings ?? {}) as Partial<AppPreferences>;
  return {
    preferences: {
      ...settings,
      appearance: (preferenceRow?.appearance as Appearance | undefined) ?? settings.appearance,
      selectedProvider: (preferenceRow?.preferred_provider as string | undefined) ?? settings.selectedProvider,
      selectedModel: (preferenceRow?.preferred_model as string | undefined) ?? settings.selectedModel,
      reasoningEffort: (preferenceRow?.reasoning_effort as ReasoningEffort | undefined) ?? settings.reasoningEffort,
      lastProjectPath: (preferenceRow?.last_project_path as string | null | undefined) ?? settings.lastProjectPath,
      profileAvatarUrl: (preferenceRow?.profile_avatar_url as string | undefined) ?? settings.profileAvatarUrl,
    },
    sessions: rows.map(row => ({
      id: row.id as string,
      title: row.title as string,
      provider: (row.provider as string | null) ?? 'openai',
      model: (row.model as string | null) ?? 'gpt-5.6-terra',
      projectId: (row.project_id as string | null) ?? null,
      projectPath: (row.project_path as string | null) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      messages: messagesBySession.get(row.id as string) ?? [],
    })),
  };
}

export async function saveCloudPreferences(preferences: AppPreferences) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return;
  const { error } = await supabase.from('user_preferences').upsert({
    user_id: user.id,
    appearance: preferences.appearance,
    preferred_provider: preferences.selectedProvider,
    preferred_model: preferences.selectedModel,
    reasoning_effort: preferences.reasoningEffort,
    last_project_path: preferences.lastProjectPath,
    profile_avatar_url: preferences.profileAvatarUrl || null,
    settings: preferences,
    updated_at: new Date().toISOString(),
  });
  if (error) console.warn('Could not sync preferences:', error.message);
}

export async function saveCloudSession(session: ChatSession) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return;
  const { error } = await supabase.from('chat_sessions').upsert({
    id: session.id,
    user_id: user.id,
    title: session.title,
    provider: session.provider,
    model: session.model,
    project_id: session.projectId,
    project_path: session.projectPath,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  });
  if (error) console.warn('Could not sync conversation:', error.message);
}

export async function saveCloudMessage(session: ChatSession, message: PersistedChatMessage) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return;
  await saveCloudSession(session);
  const { error } = await supabase.from('chat_messages').upsert({
    id: message.id,
    user_id: user.id,
    session_id: session.id,
    project_id: session.projectId,
    role: message.role,
    content: message.content,
    provider: message.provider ?? session.provider,
    model: message.model ?? session.model,
    created_at: message.createdAt,
  });
  if (error) console.warn('Could not sync message:', error.message);
}

export async function deleteCloudSession(sessionId: string) {
  const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionId);
  if (error) console.warn('Could not delete cloud conversation:', error.message);
}

export function mergeSessions(local: ChatSession[], cloud: ChatSession[]) {
  const merged = new Map<string, ChatSession>();
  for (const session of [...local, ...cloud]) {
    const current = merged.get(session.id);
    if (!current || new Date(session.updatedAt) >= new Date(current.updatedAt)) {
      merged.set(session.id, session);
    }
  }
  return [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
