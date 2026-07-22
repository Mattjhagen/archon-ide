import { useState, useRef, useEffect } from 'react';
import { Send, Cpu, Copy, Check, ChevronDown } from 'lucide-react';
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
  messages,
  loading,
  onSend,
  providers,
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  width,
  activeFilePath,
}: AiChatPanelProps) {
  const [input, setInput] = useState('');
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const currentProvider = providers.find(p => p.id === selectedProvider);
  const currentModels = currentProvider?.models ?? [];
  const selectedModelName = currentModels.find(m => m.id === selectedModel)?.name ?? selectedModel;

  return (
    <div
      className="bg-zinc-900 border-l border-zinc-800 flex flex-col h-full"
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Cpu size={14} className="text-blue-400" />
          <span className="text-xs font-medium text-zinc-300">AI Assistant</span>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowProviderMenu(!showProviderMenu)}
            className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800"
          >
            {selectedModelName}
            <ChevronDown size={10} />
          </button>
          {showProviderMenu && (
            <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 py-1 min-w-[200px]">
              {providers.map(provider => (
                <div key={provider.id}>
                  <div className="px-3 py-1 text-xs text-zinc-500 font-medium">
                    {provider.name}
                    {provider.configured ? (
                      <span className="ml-1 text-green-400">●</span>
                    ) : (
                      <span className="ml-1 text-zinc-600">○</span>
                    )}
                  </div>
                  {provider.models.map(model => (
                    <button
                      key={model.id}
                      onClick={() => {
                        onProviderChange(provider.id);
                        onModelChange(model.id);
                        setShowProviderMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-700 ${
                        selectedProvider === provider.id && selectedModel === model.id
                          ? 'text-blue-400 bg-zinc-700/50'
                          : 'text-zinc-300'
                      }`}
                    >
                      {model.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active file indicator */}
      {activeFilePath && (
        <div className="px-3 py-1.5 border-b border-zinc-800/50 bg-zinc-800/30 flex-shrink-0">
          <span className="text-[10px] text-zinc-500">
            Context: <span className="text-zinc-400">{activeFilePath.split('/').pop()}</span>
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto px-3 py-2 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <Cpu size={32} className="mx-auto mb-3 text-zinc-600" />
              <p className="text-sm text-zinc-400">Ask me anything about your code</p>
              <p className="text-xs text-zinc-600 mt-1">
                I can explain, edit, debug, and generate code
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[95%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600/20 text-blue-100 border border-blue-600/30'
                  : 'bg-zinc-800 text-zinc-200 border border-zinc-700'
              }`}
            >
              <div className="markdown-content">
                {msg.content.split('\n').map((line, j) => {
                  // Simple markdown rendering
                  if (line.startsWith('```')) {
                    return <div key={j} className="font-mono text-[11px] bg-zinc-900 rounded p-2 my-1 overflow-x-auto">{line.slice(3)}</div>;
                  }
                  if (line.startsWith('## ')) {
                    return <h2 key={j} className="text-sm font-bold mt-2 mb-1">{line.slice(3)}</h2>;
                  }
                  if (line.startsWith('- ') || line.startsWith('* ')) {
                    return <div key={j} className="ml-3">{line}</div>;
                  }
                  if (line.startsWith('```typescript') || line.startsWith('```javascript') || line.startsWith('```python')) {
                    return <div key={j} className="font-mono text-[11px] bg-zinc-900 rounded px-2 py-0.5 text-zinc-400">{line}</div>;
                  }
                  return <div key={j}>{line || '\u00A0'}</div>;
                })}
              </div>
              {msg.role === 'assistant' && (
                <div className="flex justify-end mt-1">
                  <button
                    onClick={() => handleCopy(msg.content, i)}
                    className="text-zinc-500 hover:text-zinc-300 p-0.5"
                  >
                    {copiedIndex === i ? <Check size={10} /> : <Copy size={10} />}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs">
              <div className="flex items-center gap-2 text-zinc-400">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-zinc-800 flex-shrink-0">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your code..."
            rows={2}
            className="flex-1 text-xs resize-none bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 focus:border-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="btn-primary self-end px-3 py-2"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
