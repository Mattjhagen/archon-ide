import { X, Key, Cpu } from 'lucide-react';
import type { ProviderInfo } from '../../types';

interface SettingsModalProps {
  providers: ProviderInfo[];
  selectedProvider: string;
  selectedModel: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  onClose: () => void;
}

export function SettingsModal({
  providers,
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  onClose,
}: SettingsModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Settings</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-5 max-h-[60vh] overflow-auto">
          {/* Model Selection */}
          <div>
            <h3 className="text-xs font-medium text-zinc-300 mb-3">Model Provider</h3>
            <div className="space-y-2">
              {providers.map(provider => (
                <div key={provider.id} className="border border-zinc-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-zinc-200">{provider.name}</span>
                      {provider.configured ? (
                        <span className="px-1.5 py-0.5 text-[10px] bg-green-600/20 text-green-400 rounded">
                          Configured
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 text-[10px] bg-zinc-700 text-zinc-500 rounded">
                          Not configured
                        </span>
                      )}
                    </div>
                    {provider.requires_key && (
                      <Key size={12} className="text-zinc-500" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {provider.models.map(model => (
                      <button
                        key={model.id}
                        onClick={() => {
                          onProviderChange(provider.id);
                          onModelChange(model.id);
                        }}
                        className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                          selectedProvider === provider.id && selectedModel === model.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                        }`}
                      >
                        {model.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* API Keys info */}
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
            <h3 className="text-xs font-medium text-zinc-300 mb-2">API Keys</h3>
            <p className="text-xs text-zinc-500">
              Configure API keys in your <code className="text-zinc-400 bg-zinc-800 px-1 rounded">.env</code> file.
              Keys are never stored in the browser or logged.
            </p>
            <div className="mt-2 space-y-1 text-xs font-mono text-zinc-500">
              <div>OPENAI_API_KEY=sk-...</div>
              <div>ANTHROPIC_API_KEY=sk-ant-...</div>
              <div>OLLAMA_BASE_URL=http://localhost:11434</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 flex justify-end">
          <button onClick={onClose} className="btn-primary text-xs px-4 py-1.5">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
