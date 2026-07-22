import { X, Key, Cpu, ExternalLink, Palette, ShieldCheck } from 'lucide-react';
import type { ProviderInfo } from '../../types';
import { appearances, type Appearance } from '../../lib/appearance';

interface SettingsModalProps {
  providers: ProviderInfo[];
  selectedProvider: string;
  selectedModel: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  apiKey: string;
  appearance: Appearance;
  onAppearanceChange: (appearance: Appearance) => void;
  onApiKeyChange: (key: string) => void;
  onClose: () => void;
}

export function SettingsModal({
  providers, selectedProvider, selectedModel, apiKey, appearance, onProviderChange, onModelChange, onAppearanceChange, onApiKeyChange, onClose,
}: SettingsModalProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s var(--ease) both' }}
      onClick={onClose}>
      <div className="w-full max-w-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--r-2xl)', boxShadow: 'var(--shadow-xl)', animation: 'fadeInScale 0.25s var(--ease) both' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-faint)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
              <Cpu size={14} className="text-white" />
            </div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Settings</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)', transition: 'all var(--t-fast)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-auto">
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}><Palette size={12} /> Appearance</h3>
            <div className="settings-themes">
              {appearances.map(item => <button key={item.id} className={appearance === item.id ? 'selected' : ''} onClick={() => onAppearanceChange(item.id)}><span style={{ background: item.accent }} />{item.name}</button>)}
            </div>
          </div>
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Model Provider</h3>
            <div className="space-y-2.5">
              {providers.map(provider => (
                <div key={provider.id} className="rounded-xl p-3.5" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{provider.name}</span>
                      {provider.configured ? (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full" style={{ background: 'var(--success-muted)', color: 'var(--success)' }}>Configured</span>
                      ) : (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>Not configured</span>
                      )}
                    </div>
                    {provider.requires_key && <Key size={12} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {provider.models.map(model => {
                      const sel = selectedProvider === provider.id && selectedModel === model.id;
                      return (
                        <button key={model.id} onClick={() => { onProviderChange(provider.id); onModelChange(model.id); }}
                          className="px-3 py-1.5 text-[11px] font-medium rounded-lg"
                          style={{ background: sel ? 'var(--accent)' : 'var(--bg-overlay)', color: sel ? 'white' : 'var(--text-tertiary)', border: `1px solid ${sel ? 'var(--accent)' : 'var(--border-subtle)'}`, transition: 'all var(--t-fast)' }}
                          onMouseEnter={e => { if (!sel) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                          onMouseLeave={e => { if (!sel) { e.currentTarget.style.background = 'var(--bg-overlay)'; e.currentTarget.style.color = 'var(--text-tertiary)'; } }}
                        >{model.name}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-subtle)' }}>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>API Keys</h3>
            <p className="text-[12px] mb-3" style={{ color: 'var(--text-tertiary)' }}>
              Add a key for this session. It is sent only with your model request and is never persisted.
            </p>
            <input type="password" value={apiKey} onChange={event => onApiKeyChange(event.target.value)} placeholder={selectedProvider === 'anthropic' ? 'sk-ant-…' : 'sk-proj-…'} className="w-full" />
            <div className="mt-2 flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--success)' }}><ShieldCheck size={12} /> Session-only credential</div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-faint)' }}>
          <a href="http://relayapp.pro/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] group"
            style={{ color: 'var(--text-muted)', transition: 'color var(--t-fast)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-hover)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
            <span>Part of</span>
            <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Relay</span>
            <ExternalLink size={10} className="opacity-0 group-hover:opacity-100" style={{ transition: 'opacity var(--t-fast)' }} />
          </a>
          <button onClick={onClose} className="btn-primary text-[12px] px-5 py-2">Done</button>
        </div>
      </div>
    </div>
  );
}
