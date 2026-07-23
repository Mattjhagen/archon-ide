import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Square, RefreshCw, ChevronDown, BrainCircuit, Zap } from 'lucide-react';
import type { AgentTask, AgentEvent, ReasoningEffort } from '../../types/agent';
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_COLOR,
  REASONING_LABEL,
  isActiveStatus,
} from '../../types/agent';
import type { ProviderInfo } from '../../types';
import { agentApi } from '../../lib/agentApi';
import { TaskTimeline } from './TaskTimeline';
import { WorkspaceMemory } from './WorkspaceMemory';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaskPanelProps {
  width: number;
  projectPath: string | null;
  providers: ProviderInfo[];
  selectedProvider: string;
  selectedModel: string;
  apiKey: string;
  reasoningEffort: ReasoningEffort;
  onProviderChange: (p: string) => void;
  onModelChange: (m: string) => void;
  onReasoningEffortChange: (e: ReasoningEffort) => void;
}

// ─── Polling interval when a task is running ─────────────────────────────────

const POLL_MS = 2_000;

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskPanel({
  width,
  projectPath,
  providers,
  selectedProvider,
  selectedModel,
  apiKey,
  reasoningEffort,
  onProviderChange,
  onModelChange,
  onReasoningEffortChange,
}: TaskPanelProps) {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [request, setRequest] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [showReasoningMenu, setShowReasoningMenu] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null;

  // ── Data fetching ───────────────────────────────────────────────────────────

  const refreshTasks = useCallback(async () => {
    try {
      const list = await agentApi.listTasks();
      setTasks(list);
    } catch {
      // Silently ignore on background refresh
    }
  }, []);

  const refreshEvents = useCallback(async (taskId: string) => {
    try {
      const evs = await agentApi.getTaskEvents(taskId);
      setEvents(evs);
    } catch {
      // Silently ignore on background refresh
    }
  }, []);

  const refreshSelected = useCallback(async (taskId: string) => {
    try {
      const task = await agentApi.getTask(taskId);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? task : t)));
      await refreshEvents(taskId);
    } catch {
      // Silently ignore on background refresh
    }
  }, [refreshEvents]);

  // Initial load
  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  // Scroll events to bottom on new entries
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  // Start/stop polling when the selected task changes or its status changes
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (selectedId && selectedTask && isActiveStatus(selectedTask.status)) {
      pollRef.current = setInterval(() => {
        refreshSelected(selectedId);
      }, POLL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedId, selectedTask?.status, refreshSelected]);

  // ── Task creation ───────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!title.trim() || !request.trim()) return;
    if (!projectPath) {
      setError('Open a project first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const task = await agentApi.createTask({
        title: title.trim(),
        request: request.trim(),
        provider: selectedProvider,
        model: selectedModel,
        reasoning_effort: reasoningEffort,
        api_key: apiKey || undefined,
        workspace_path: projectPath,
      });
      setTasks((prev) => [task, ...prev]);
      setSelectedId(task.id);
      setEvents([]);
      setTitle('');
      setRequest('');
      setComposerOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (taskId: string) => {
    try {
      await agentApi.cancelTask(taskId);
      await refreshSelected(taskId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    }
  };

  const handleSelectTask = async (taskId: string) => {
    setSelectedId(taskId);
    try {
      const evs = await agentApi.getTaskEvents(taskId);
      setEvents(evs);
    } catch {
      setEvents([]);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const currentProvider = providers.find((p) => p.id === selectedProvider);
  const selectedModelName =
    currentProvider?.models.find((m) => m.id === selectedModel)?.name ?? selectedModel;

  const reasoningOptions: { id: ReasoningEffort; label: string }[] = [
    { id: 'low', label: 'Low · 1× — fast, focused' },
    { id: 'medium', label: 'Medium · 2× — balanced' },
    { id: 'high', label: 'High · 4× — deep reasoning' },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col h-full"
      style={{
        width,
        background: 'var(--bg-base)',
        borderLeft: '1px solid var(--border-faint)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-faint)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #059669, #0891b2)',
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
            }}
          >
            <Zap size={12} className="text-white" />
          </div>
          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Agent Tasks
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Reasoning effort picker */}
          <div className="relative">
            <button
              onClick={() => setShowReasoningMenu(!showReasoningMenu)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px]"
              style={{
                color: 'var(--text-tertiary)',
                background: 'var(--bg-raised)',
                border: '1px solid var(--border-faint)',
              }}
            >
              <BrainCircuit size={11} style={{ color: 'var(--accent-hover)' }} />
              {REASONING_LABEL[reasoningEffort]}
              <ChevronDown size={9} />
            </button>
            {showReasoningMenu && (
              <div
                className="absolute right-0 top-full mt-1 p-1 min-w-[200px]"
                style={{
                  background: 'var(--bg-overlay)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--r-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 60,
                }}
              >
                {reasoningOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      onReasoningEffortChange(opt.id);
                      setShowReasoningMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[11px] rounded-lg"
                    style={{
                      background:
                        opt.id === reasoningEffort ? 'var(--accent-subtle)' : 'transparent',
                      color:
                        opt.id === reasoningEffort
                          ? 'var(--accent-hover)'
                          : 'var(--text-secondary)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Provider picker */}
          <div className="relative">
            <button
              onClick={() => setShowProviderMenu(!showProviderMenu)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px]"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {selectedModelName} <ChevronDown size={10} />
            </button>
            {showProviderMenu && (
              <div
                className="absolute right-0 top-full mt-1 py-1 min-w-[200px]"
                style={{
                  background: 'var(--bg-overlay)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--r-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 50,
                }}
              >
                {providers.map((prov) => (
                  <div key={prov.id}>
                    <div
                      className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-2"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {prov.name}
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: prov.configured ? 'var(--success)' : 'var(--text-muted)',
                        }}
                      />
                    </div>
                    {prov.models.map((m) => {
                      const sel = selectedProvider === prov.id && selectedModel === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            onProviderChange(prov.id);
                            onModelChange(m.id);
                            setShowProviderMenu(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-[12px]"
                          style={{
                            color: sel ? 'var(--accent-hover)' : 'var(--text-secondary)',
                            background: sel ? 'var(--accent-subtle)' : 'transparent',
                          }}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={refreshTasks}
            className="p-1 rounded-md"
            style={{ color: 'var(--text-muted)' }}
            title="Refresh task list"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="px-3 py-2 text-[11px] flex-shrink-0"
          style={{ background: 'var(--danger)', color: 'white', cursor: 'pointer' }}
          onClick={() => setError(null)}
        >
          {error} — click to dismiss
        </div>
      )}

      {/* Main content — split: task list + detail */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Task list (left column) */}
        <div
          className="flex flex-col w-40 flex-shrink-0 overflow-y-auto"
          style={{ borderRight: '1px solid var(--border-faint)' }}
        >
          {/* New task button */}
          <button
            onClick={() => {
              setComposerOpen(true);
              setSelectedId(null);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium flex-shrink-0"
            style={{
              color: 'var(--accent)',
              borderBottom: '1px solid var(--border-faint)',
            }}
          >
            + New task
          </button>

          {tasks.length === 0 && (
            <div
              className="px-3 py-3 text-[10px]"
              style={{ color: 'var(--text-muted)' }}
            >
              No tasks yet
            </div>
          )}

          {tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => handleSelectTask(task.id)}
              className="w-full text-left px-3 py-2"
              style={{
                background:
                  selectedId === task.id ? 'var(--accent-subtle)' : 'transparent',
                borderBottom: '1px solid var(--border-faint)',
              }}
            >
              <p
                className="text-[11px] font-medium truncate"
                style={{
                  color:
                    selectedId === task.id
                      ? 'var(--accent-hover)'
                      : 'var(--text-secondary)',
                }}
              >
                {task.title}
              </p>
              <span
                className="text-[9px]"
                style={{ color: TASK_STATUS_COLOR[task.status] }}
              >
                {TASK_STATUS_LABEL[task.status]}
              </span>
            </button>
          ))}
        </div>

        {/* Right panel — composer or task detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Composer */}
          {composerOpen && (
            <div
              className="flex flex-col p-3 gap-2 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border-faint)' }}
            >
              <p
                className="text-[11px] font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                New autonomous task
              </p>
              <input
                type="text"
                placeholder="Title (e.g. Fix auth bug)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg text-[12px]"
                style={{
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <textarea
                placeholder="Describe the task in detail…"
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                rows={5}
                className="w-full px-2.5 py-1.5 rounded-lg text-[12px] resize-none"
                style={{
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              {!projectPath && (
                <p className="text-[10px]" style={{ color: 'var(--danger)' }}>
                  Open a project before starting a task.
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setComposerOpen(false);
                    setError(null);
                  }}
                  className="px-3 py-1.5 rounded-lg text-[11px]"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-raised)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !title.trim() || !request.trim() || !projectPath}
                  className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]"
                  style={{
                    opacity:
                      submitting || !title.trim() || !request.trim() || !projectPath
                        ? 0.4
                        : 1,
                  }}
                >
                  <Send size={11} />
                  {submitting ? 'Starting…' : 'Start task'}
                </button>
              </div>
            </div>
          )}

          {/* Task detail */}
          {selectedTask && !composerOpen ? (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Task header */}
              <div
                className="px-3 py-2.5 flex-shrink-0"
                style={{ borderBottom: '1px solid var(--border-faint)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className="text-[12px] font-semibold truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {selectedTask.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: TASK_STATUS_COLOR[selectedTask.status] }}
                      >
                        {TASK_STATUS_LABEL[selectedTask.status]}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {selectedTask.current_step}/{selectedTask.max_steps} steps ·{' '}
                        {selectedTask.credits_used}/{selectedTask.credit_limit} credits
                      </span>
                    </div>
                  </div>

                  {/* Stop button for active tasks */}
                  {isActiveStatus(selectedTask.status) &&
                    selectedTask.status !== 'cancelling' && (
                      <button
                        onClick={() => handleCancel(selectedTask.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] flex-shrink-0"
                        style={{
                          color: 'var(--danger)',
                          background: 'var(--bg-raised)',
                          border: '1px solid var(--border-faint)',
                        }}
                      >
                        <Square size={9} fill="currentColor" /> Stop
                      </button>
                    )}
                </div>

                {/* Error message for failed/blocked tasks */}
                {selectedTask.error_message && (
                  <div
                    className="mt-2 px-2 py-1.5 rounded-lg text-[10px]"
                    style={{
                      background: 'var(--danger-subtle, rgba(239,68,68,0.08))',
                      color: 'var(--danger)',
                    }}
                  >
                    {selectedTask.error_message}
                  </div>
                )}

                {/* Progress bar */}
                {isActiveStatus(selectedTask.status) && selectedTask.max_steps > 0 && (
                  <div
                    className="mt-2 h-1 rounded-full overflow-hidden"
                    style={{ background: 'var(--bg-raised)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (selectedTask.current_step / selectedTask.max_steps) * 100
                        )}%`,
                        background: 'var(--accent)',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Request */}
              <div
                className="px-3 py-2 flex-shrink-0 text-[10px]"
                style={{
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--border-faint)',
                  maxHeight: '4rem',
                  overflow: 'hidden',
                }}
              >
                {selectedTask.request}
              </div>

              {/* Events */}
              <div className="flex-1 overflow-y-auto">
                <TaskTimeline events={events} />
                <div ref={eventsEndRef} />
              </div>

              {/* Workspace memory */}
              {projectPath && <WorkspaceMemory workspacePath={projectPath} />}
            </div>
          ) : (
            !composerOpen && (
              <div
                className="flex-1 flex items-center justify-center text-center px-4"
              >
                <div>
                  <div
                    className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-3"
                    style={{
                      background: 'var(--accent-subtle)',
                      border: '1px solid var(--border-faint)',
                    }}
                  >
                    <Zap size={18} style={{ color: 'var(--accent)' }} />
                  </div>
                  <p className="text-[12px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Agent Tasks
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Give Archon a complex coding task.
                    <br />
                    It will plan, inspect, edit, and verify.
                  </p>
                  <button
                    onClick={() => setComposerOpen(true)}
                    className="btn-primary mt-3 px-3 py-1.5 rounded-lg text-[11px]"
                  >
                    + New task
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
