import { useState, useRef, useEffect } from 'react';
import { Send, Cpu, Copy, Check, ChevronDown, Sparkles, User } from 'lucide-react';
import type { ProviderInfo } from '../../types';

interface AiChatPanelProps {
  messages: { role: 'user' | 'assistant'; content: string }[];
  loading: boolean;
  onSend: (message: string) => void;
  providers: ProviderInfo[];
  selectedProvider: string;
  selectedModel: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  width: number;
  activeFilePath: string | null;
}

export function AiChatPanel({
  messages, loading, onSend, providers, selectedProvider, selectedModel,
  onProviderChange, onModelChange, width, activeFilePath,
}: AiChatPanelProps) {
  const [input, setInput] = useState('');
  const [showProviderMenu, setShowProviderMenu] = useState(false);
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

  return (
    <div className="flex flex-col h-full" style={{ width, background: 'var(--bg-base)', borderLeft: '1px solid var(--border-faint)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-faint)' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)', boxShadow: '0 2px 8px rgba(139, 92, 246, 0.25)' }}>
            <Sparkles size={12} className="text-white" />
          </div>
          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>AI Assistant</span>
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

      {/* Context indicator */}
      {activeFilePath && (
        <div className="px-3 py-1.5 flex-shrink-0" style={{ background: 'var(--accent-subtle)', borderBottom: '1px solid var(--border-faint)' }}>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Context: <span style={{ color: 'var(--accent-hover)' }}>{activeFilePath.split('/').pop()}</span>
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
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>I can explain, edit, debug, and generate code</p>
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
                {msg.role === 'assistant' && (
                  <div className="flex justify-end mt-1.5">
                    <button onClick={() => handleCopy(msg.content, i)} className="p-1 rounded-md" style={{ color: 'var(--text-muted)', transition: 'color var(--t-fast)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                      {copiedIndex === i ? <Check size={11} style={{ color: 'var(--success)' }} /> : <Copy size={11} />}
                    </button>
                  </div>
                )}
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
        <div className="flex gap-2 p-2 rounded-xl" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', transition: 'border-color var(--t-fast), box-shadow var(--t-fast)' }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-muted)'; }}
          onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none'; } }}
        >
          <textarea ref={undefined} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Ask about your code..." rows={2} className="flex-1 text-[12px] resize-none border-none outline-none"
            style={{ background: 'transparent', color: 'var(--text-primary)', fontFamily: 'inherit' }} />
          <button onClick={handleSend} disabled={!input.trim() || loading} className="btn-primary self-end p-2.5 rounded-xl" style={{ opacity: input.trim() && !loading ? 1 : 0.3 }}>
            <Send size={14} />
          </button>
        </div>
        <div className="text-center mt-1.5">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Enter to send · Shift+Enter for new line</span>
        </div>
      </div>
    </div>
  );
}
