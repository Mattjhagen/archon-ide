import { useState, useRef, useEffect } from 'react';
import { Send, Cpu, Copy, Check, ChevronDown, Sparkles, BrainCircuit, Square, History, MessageSquarePlus, Trash2, Cloud, CloudOff, ListTree } from 'lucide-react';
import type { AiJobLog, ProviderInfo, ReasoningEffort } from '../../types';
import type { ChatSession, PersistedChatMessage } from '../../lib/persistence';

interface AiChatPanelProps {
  messages: PersistedChatMessage[];
  sessions: ChatSession[];
  activeSessionId: string | null;
  loading: boolean;
  onSend: (message: string) => void;
  providers: ProviderInfo[];
  selectedProvider: string;
  selectedModel: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  width: number;
  activeFilePath: string | null;
  reasoningEffort: ReasoningEffort;
  creditsConsumed: number;
  onReasoningEffortChange: (effort: ReasoningEffort) => void;
  agentStatus: string;
  projectPath: string | null;
  memoryState: 'local' | 'syncing' | 'synced' | 'offline';
  jobLogs: AiJobLog[];
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onStop: () => void;
}

export function AiChatPanel({
  messages, sessions, activeSessionId, loading, onSend, providers, selectedProvider, selectedModel,
  onProviderChange, onModelChange, width, activeFilePath, reasoningEffort,
  creditsConsumed, onReasoningEffortChange, agentStatus, projectPath, memoryState,
  jobLogs, onNewConversation, onSelectConversation, onDeleteConversation, onStop,
}: AiChatPanelProps) {
  const [input, setInput] = useState('');
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [showReasoningMenu, setShowReasoningMenu] = useState(false);
  const [showConversationMenu, setShowConversationMenu] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const currentProvider = providers.find(p => p.id === selectedProvider);
  const selectedModelName = currentProvider?.models.find(m => m.id === selectedModel)?.name ?? selectedModel;
  const reasoningOptions: { id: ReasoningEffort; label: string; detail: string; multiplier: number }[] = [
    { id: 'low', label: 'Low', detail: 'Fast, focused work', multiplier: 1 },
    { id: 'medium', label: 'Medium', detail: 'Balanced agent work', multiplier: 2 },
    { id: 'high', label: 'High', detail: 'Deep, long-horizon reasoning', multiplier: 4 },
  ];
  const currentReasoning = reasoningOptions.find(option => option.id === reasoningEffort)!;
  const activeSession = sessions.find(session => session.id === activeSessionId);
  const quickPrompts = [
    'Review this project and identify the highest-impact improvements',
    'Find and fix the most likely bug in the active file',
    'Add tests for the code I am currently viewing',
    'Continue the last unfinished build and verify it',
  ];

  return (
    <div className="flex flex-col h-full" style={{ width, background: 'var(--bg-base)', borderLeft: '1px solid var(--border-faint)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-faint)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)', boxShadow: '0 2px 8px rgba(139, 92, 246, 0.25)' }}>
            <Sparkles size={12} className="text-white" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-semibold block truncate" style={{ color: 'var(--text-primary)' }}>{activeSession?.title ?? 'AI Assistant'}</span>
            <span className="text-[9px] block truncate" style={{ color: 'var(--text-muted)' }}>{projectPath?.split('/').filter(Boolean).pop() ?? 'General workspace'}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              onClick={() => setShowConversationMenu(!showConversationMenu)}
              className="p-1.5 rounded-md"
              title="Conversation history"
              aria-label="Conversation history"
              style={{ color: 'var(--text-tertiary)', background: showConversationMenu ? 'var(--bg-hover)' : 'transparent' }}
            >
              <History size={13} />
            </button>
            {showConversationMenu && (
              <div className="absolute right-0 top-full mt-1 w-[300px] overflow-hidden" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', zIndex: 70 }}>
                <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border-faint)' }}>
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Conversations</span>
                  <button onClick={() => { onNewConversation(); setShowConversationMenu(false); }} className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px]" style={{ color: 'var(--accent-hover)', background: 'var(--accent-subtle)' }}>
                    <MessageSquarePlus size={10} /> New
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto p-1">
                  {sessions.map(session => (
                    <div key={session.id} className="group flex items-center gap-1 rounded-lg" style={{ background: session.id === activeSessionId ? 'var(--accent-subtle)' : 'transparent' }}>
                      <button onClick={() => { onSelectConversation(session.id); setShowConversationMenu(false); }} className="flex-1 min-w-0 px-2.5 py-2 text-left">
                        <span className="block truncate text-[10px] font-medium" style={{ color: session.id === activeSessionId ? 'var(--accent-hover)' : 'var(--text-secondary)' }}>{session.title}</span>
                        <span className="block truncate text-[8px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{session.projectPath?.split('/').filter(Boolean).pop() ?? 'General'} · {session.model}</span>
                      </button>
                      <button onClick={() => onDeleteConversation(session.id)} className="p-1.5 mr-1 opacity-0 group-hover:opacity-100" aria-label={`Delete ${session.title}`} style={{ color: 'var(--danger)' }}>
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowReasoningMenu(!showReasoningMenu)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px]"
              style={{ color: 'var(--text-tertiary)', background: 'var(--bg-raised)', border: '1px solid var(--border-faint)' }}
            >
              <BrainCircuit size={11} style={{ color: 'var(--accent-hover)' }} />
              {currentReasoning.label} · {currentReasoning.multiplier}×
              <ChevronDown size={9} />
            </button>
            {showReasoningMenu && (
              <div className="absolute right-0 top-full mt-1 p-1 min-w-[230px]" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', zIndex: 60 }}>
                {reasoningOptions.map(option => (
                  <button
                    key={option.id}
                    onClick={() => { onReasoningEffortChange(option.id); setShowReasoningMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg"
                    style={{ background: option.id === reasoningEffort ? 'var(--accent-subtle)' : 'transparent', color: option.id === reasoningEffort ? 'var(--accent-hover)' : 'var(--text-secondary)' }}
                  >
                    <span className="w-8 text-[11px] font-semibold">{option.label}</span>
                    <span className="flex-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{option.detail}</span>
                    <span className="text-[10px] font-mono">{option.multiplier}×</span>
                  </button>
                ))}
                <div className="px-3 py-2 text-[9px]" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-faint)' }}>
                  Higher effort permits more thinking and tool work. Actual provider tokens still vary.
                </div>
              </div>
            )}
          </div>
          <div className="relative">
          <button
            onClick={() => setShowProviderMenu(!showProviderMenu)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px]"
            style={{ color: 'var(--text-tertiary)', transition: 'all var(--t-fast)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
          >
            {selectedModelName} <ChevronDown size={10} />
          </button>
          {showProviderMenu && (
            <div className="absolute right-0 top-full mt-1 py-1 min-w-[220px]" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', zIndex: 50, animation: 'fadeInUp 0.2s var(--ease) both' }}>
              {providers.map(provider => (
                <div key={provider.id}>
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                    {provider.name}
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: provider.configured ? 'var(--success)' : 'var(--text-muted)' }} />
                  </div>
                  {provider.models.map(model => {
                    const sel = selectedProvider === provider.id && selectedModel === model.id;
                    return (
                      <button key={model.id} onClick={() => { onProviderChange(provider.id); onModelChange(model.id); setShowProviderMenu(false); }}
                        className="w-full text-left px-3 py-1.5 text-[12px]"
                        style={{ color: sel ? 'var(--accent-hover)' : 'var(--text-secondary)', background: sel ? 'var(--accent-subtle)' : 'transparent', borderRadius: 0 }}
                        onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent'; }}
                      >{model.name}</button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Context indicator */}
      {(activeFilePath || projectPath) && (
        <div className="px-3 py-1.5 flex-shrink-0 flex items-center justify-between gap-2" style={{ background: 'var(--accent-subtle)', borderBottom: '1px solid var(--border-faint)' }}>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Context: <span style={{ color: 'var(--accent-hover)' }}>{activeFilePath?.split('/').pop() ?? projectPath?.split('/').filter(Boolean).pop()}</span>
          </span>
          <span className="flex items-center gap-1 text-[9px]" style={{ color: memoryState === 'synced' ? 'var(--success)' : 'var(--text-muted)' }}>
            {memoryState === 'synced' ? <Cloud size={10} /> : <CloudOff size={10} />}
            {memoryState === 'synced' ? 'Cloud + local' : memoryState === 'syncing' ? 'Syncing' : 'Local memory'}
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto px-3 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-faint)' }}>
                <Cpu size={22} style={{ color: 'var(--accent)' }} />
              </div>
              <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Ask me anything</p>
              <p className="text-[11px] mb-4" style={{ color: 'var(--text-muted)' }}>I can plan, build, verify, and keep working in the background</p>
              <div className="grid gap-1.5 w-full max-w-[330px]">
                {quickPrompts.map(prompt => (
                  <button key={prompt} onClick={() => onSend(prompt)} className="px-3 py-2 rounded-lg text-left text-[10px]" style={{ color: 'var(--text-secondary)', background: 'var(--bg-raised)', border: '1px solid var(--border-faint)' }}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`} style={{ animation: 'fadeInUp 0.3s var(--ease) both' }}>
            <div className="max-w-[95%]">
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-faint)' }}>
                    <Sparkles size={10} style={{ color: 'var(--accent)' }} />
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Archon</span>
                </div>
              )}
              <div
                className="px-3.5 py-2.5 text-[12px] leading-relaxed"
                style={{
                  background: msg.role === 'user' ? 'var(--accent-muted)' : 'var(--bg-surface)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(139, 92, 246, 0.12)' : 'var(--border-faint)'}`,
                  color: msg.role === 'user' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderRadius: msg.role === 'user' ? 'var(--r-xl) var(--r-xl) var(--r-xs) var(--r-xl)' : 'var(--r-xl) var(--r-xl) var(--r-xl) var(--r-xs)',
                }}
              >
                <div className="markdown-content">
                  {msg.content.split('\n').map((line, j) => {
                    if (line.startsWith('```')) return <div key={j} className="text-[11px] rounded-lg px-3 py-2 my-1 overflow-x-auto" style={{ background: 'var(--bg-void)', border: '1px solid var(--border-faint)', fontFamily: "'JetBrains Mono', monospace" }}>{line.slice(3)}</div>;
                    if (line.startsWith('## ')) return <h2 key={j} className="text-[13px] font-bold mt-2 mb-1" style={{ color: 'var(--text-primary)' }}>{line.slice(3)}</h2>;
                    if (line.startsWith('- ') || line.startsWith('* ')) return <div key={j} className="ml-3">{line}</div>;
                    if (line.startsWith('```typescript') || line.startsWith('```javascript') || line.startsWith('```python')) return <div key={j} className="text-[11px] rounded-lg px-2 py-0.5" style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>{line}</div>;
                    return <div key={j}>{line || '\u00A0'}</div>;
                  })}
                </div>
                <div className="flex justify-end mt-1.5">
                  <button onClick={() => handleCopy(msg.content, i)} className="flex items-center gap-1 p-1 rounded-md text-[9px]" style={{ color: 'var(--text-muted)', transition: 'color var(--t-fast)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                    {copiedIndex === i ? <><Check size={11} style={{ color: 'var(--success)' }} /> Copied</> : <><Copy size={11} /> Copy</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start" style={{ animation: 'fadeIn 0.3s var(--ease) both' }}>
            <div className="flex items-center gap-1.5 px-4 py-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-faint)', borderRadius: 'var(--r-xl) var(--r-xl) var(--r-xl) var(--r-xs)' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)', animation: 'pulse-dot 1.2s ease-in-out infinite 0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)', animation: 'pulse-dot 1.2s ease-in-out infinite 200ms' }} />
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)', animation: 'pulse-dot 1.2s ease-in-out infinite 400ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border-faint)' }}>
        {jobLogs.length > 0 && (
          <div className="mb-2 rounded-lg overflow-hidden" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-faint)' }}>
            <button onClick={() => setShowActivity(!showActivity)} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left">
              <ListTree size={11} style={{ color: 'var(--accent-hover)' }} />
              <span className="flex-1 text-[9px]" style={{ color: 'var(--text-secondary)' }}>Build activity · {jobLogs.length} events</span>
              <ChevronDown size={9} style={{ color: 'var(--text-muted)', transform: showActivity ? 'rotate(180deg)' : undefined }} />
            </button>
            {showActivity && (
              <div className="max-h-28 overflow-y-auto px-2.5 pb-2 space-y-1">
                {jobLogs.map(log => (
                  <div key={log.id} className="flex gap-2 text-[9px]">
                    <span style={{ color: 'var(--text-muted)' }}>#{log.sequence}</span>
                    <span style={{ color: log.kind === 'error' ? 'var(--danger)' : 'var(--text-tertiary)' }}>{log.summary}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--accent-hover)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)', animation: 'pulse-dot 1.2s ease-in-out infinite' }} />
              {agentStatus}
            </span>
            <button onClick={onStop} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px]" style={{ color: 'var(--danger)', background: 'var(--bg-raised)', border: '1px solid var(--border-faint)' }}>
              <Square size={9} fill="currentColor" /> Stop
            </button>
          </div>
        )}
        <div className="flex gap-2 p-2 rounded-xl" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', transition: 'border-color var(--t-fast), box-shadow var(--t-fast)' }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-muted)'; }}
          onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none'; } }}
        >
          <textarea ref={undefined} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Ask about your code... Type @ to attach files" rows={2} className="flex-1 text-[12px] resize-none border-none outline-none"
            style={{ background: 'transparent', color: 'var(--text-primary)', fontFamily: 'inherit' }} />
          <button onClick={handleSend} disabled={!input.trim() || loading} className="btn-primary self-end p-2.5 rounded-xl" style={{ opacity: input.trim() && !loading ? 1 : 0.3 }}>
            <Send size={14} />
          </button>
        </div>
        <div className="text-center mt-1.5">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Enter to send · Shift+Enter for new line · Type @ for Context · {creditsConsumed} credits used</span>
        </div>
      </div>
    </div>
  );
}
