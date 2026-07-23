import { useState } from 'react';
import { X, Key, Cpu, ExternalLink, Palette, ShieldCheck, Boxes, BrainCircuit } from 'lucide-react';
import type { ProviderInfo } from '../../types';
import type { ReasoningEffort } from '../../types';
import { appearances, type Appearance } from '../../lib/appearance';
import { IntegrationsPanel } from './IntegrationsPanel';
import { ModelCapabilityCard } from './ModelCapabilityCard';

interface SettingsModalProps {
  providers: ProviderInfo[];
  selectedProvider: string;
  selectedModel: string;
  reasoningEffort: ReasoningEffort;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  onReasoningEffortChange: (effort: ReasoningEffort) => void;
  apiKey: string;
  appearance: Appearance;
  onAppearanceChange: (appearance: Appearance) => void;
  onApiKeyChange: (key: string) => void;
  onClose: () => void;
}

type SettingsTab = 'models' | 'integrations' | 'appearance';

export function SettingsModal({
  providers, selectedProvider, selectedModel, reasoningEffort, apiKey, appearance, onProviderChange, onModelChange, onReasoningEffortChange, onAppearanceChange, onApiKeyChange, onClose,
}: SettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>('models');

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 settings-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={event => event.stopPropagation()}>
        <header className="settings-header">
          <div className="settings-title">
            <div className="settings-logo"><Cpu size={14} /></div>
            <div><h2>Archon settings</h2><span>Models, tools, and workspace preferences</span></div>
          </div>
          <button onClick={onClose} className="settings-close" aria-label="Close settings"><X size={16} /></button>
        </header>

        <nav className="settings-tabs" aria-label="Settings sections">
          <button className={tab === 'models' ? 'active' : ''} onClick={() => setTab('models')}><BrainCircuit size={13} /> Models</button>
          <button className={tab === 'integrations' ? 'active' : ''} onClick={() => setTab('integrations')}><Boxes size={13} /> Integrations <span>8</span></button>
          <button className={tab === 'appearance' ? 'active' : ''} onClick={() => setTab('appearance')}><Palette size={13} /> Appearance</button>
        </nav>

        <div className="settings-content">
          {tab === 'models' && (
            <section className="settings-section">
              <div className="settings-section-heading">
                <span className="settings-eyebrow"><BrainCircuit size={12} /> Model routing</span>
                <h3>Choose the intelligence for each task.</h3>
                <p>Your selected model uses the shared Low, Medium, and High reasoning controls in the agent panel.</p>
              </div>
              <div className="provider-settings-list">
                {providers.map(provider => (
                  <div key={provider.id} className="provider-settings-card">
                    <div className="provider-settings-head">
                      <div>
                        <strong>{provider.name}</strong>
                        <span className={provider.configured ? 'configured' : ''}>{provider.configured ? 'Server configured' : provider.requires_key ? 'Bring your own key' : 'Local connection'}</span>
                      </div>
                      {provider.requires_key && <Key size={12} />}
                    </div>
                    <div className="provider-models">
                      {provider.models.map(model => {
                        const selected = selectedProvider === provider.id && selectedModel === model.id;
                        return <button key={model.id} className={selected ? 'selected' : ''} onClick={() => { onProviderChange(provider.id); onModelChange(model.id); }}>{model.name}</button>;
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <ModelCapabilityCard provider={selectedProvider} model={selectedModel} effort={reasoningEffort} onEffortChange={onReasoningEffortChange} />
              <div className="credential-card">
                <div><Key size={14} /><span><strong>Session-only API key</strong><small>Sent with model requests and cleared when this tab closes.</small></span></div>
                <input type="password" value={apiKey} onChange={event => onApiKeyChange(event.target.value)} placeholder={selectedProvider === 'anthropic' ? 'sk-ant-…' : selectedProvider === 'gemini' ? 'AIza…' : 'sk-proj-…'} />
                <div className="credential-status"><ShieldCheck size={12} /> Never written to Archon storage</div>
              </div>
            </section>
          )}

          {tab === 'integrations' && <IntegrationsPanel />}

          {tab === 'appearance' && (
            <section className="settings-section">
              <div className="settings-section-heading">
                <span className="settings-eyebrow"><Palette size={12} /> Workspace appearance</span>
                <h3>Make the environment feel like yours.</h3>
                <p>Appearance is stored locally in this browser and can be changed at any time.</p>
              </div>
              <div className="appearance-settings-grid">
                {appearances.map(item => (
                  <button key={item.id} className={appearance === item.id ? 'selected' : ''} onClick={() => onAppearanceChange(item.id)}>
                    <span className="appearance-swatch" style={{ background: item.accent }} />
                    <span><strong>{item.name}</strong><small>{item.id === 'obsidian' ? 'Graphite and violet' : item.id === 'luminous' ? 'Midnight and cyan' : 'Warm light canvas'}</small></span>
                    <i />
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <footer className="settings-footer">
          <a href="https://relayapp.pro/" target="_blank" rel="noopener noreferrer"><span>Part of</span><strong>Relay</strong><ExternalLink size={10} /></a>
          <div><span>Changes apply immediately</span><button onClick={onClose} className="btn-primary">Done</button></div>
        </footer>
      </div>
    </div>
  );
}
