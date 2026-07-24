import { useEffect, useState } from 'react';
import {
  X,
  Key,
  Cpu,
  ExternalLink,
  Palette,
  ShieldCheck,
  Boxes,
  BrainCircuit,
  UserRound,
  Info,
  Cloud,
  CloudOff,
  CreditCard,
  ChevronDown,
  LogOut,
  Trash2,
  BadgeCheck,
  Upload,
  GitBranch,
} from 'lucide-react';
import type { ProviderInfo, ReasoningEffort } from '../../types';
import { appearances, type Appearance } from '../../lib/appearance';
import { supabase } from '../../lib/supabase';
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
  failoverEnabled: boolean;
  onFailoverChange: (enabled: boolean) => void;
  memoryState: 'local' | 'syncing' | 'synced' | 'offline';
  profileAvatarUrl: string;
  onProfileAvatarChange: (url: string) => void;
  onClose: () => void;
}

type SettingsTab = 'models' | 'integrations' | 'appearance' | 'account' | 'about';

const licenses = [
  ['React', 'MIT'],
  ['Supabase JS', 'MIT'],
  ['Monaco Editor React', 'MIT'],
  ['Lucide React', 'ISC'],
  ['xterm.js', 'MIT'],
  ['Vite', 'MIT'],
];

export function SettingsModal({
  providers,
  selectedProvider,
  selectedModel,
  reasoningEffort,
  apiKey,
  appearance,
  onProviderChange,
  onModelChange,
  onReasoningEffortChange,
  onAppearanceChange,
  onApiKeyChange,
  failoverEnabled,
  onFailoverChange,
  memoryState,
  profileAvatarUrl,
  onProfileAvatarChange,
  onClose,
}: SettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>('models');
  const [email, setEmail] = useState('');
  const [avatarDraft, setAvatarDraft] = useState(profileAvatarUrl);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? '');
      if (!profileAvatarUrl) {
        const remoteAvatar = data.user?.user_metadata?.avatar_url as string | undefined;
        if (remoteAvatar) {
          setAvatarDraft(remoteAvatar);
          onProfileAvatarChange(remoteAvatar);
        }
      }
    });
  }, [onProfileAvatarChange, profileAvatarUrl]);

  const saveProfile = async () => {
    const next = avatarDraft.trim();
    const { error } = await supabase.auth.updateUser({ data: { avatar_url: next || null } });
    if (error) {
      setAccountMessage(error.message);
      return;
    }
    onProfileAvatarChange(next);
    setAccountMessage('Profile saved and synced.');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const deleteAccount = async () => {
    const typed = window.prompt('This permanently deletes your Relay account, projects, messages, and settings. Type DELETE to continue.');
    if (typed !== 'DELETE') return;
    const { error } = await supabase.rpc('delete_current_user');
    if (error) {
      setAccountMessage(error.message);
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 settings-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={event => event.stopPropagation()}>
        <header className="settings-header">
          <div className="settings-title">
            <div className="settings-logo"><Cpu size={14} /></div>
            <div><h2>Archon settings</h2><span>Models, memory, appearance, and account</span></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="settings-sync-status">
              {memoryState === 'synced' ? <Cloud size={11} /> : <CloudOff size={11} />}
              {memoryState === 'synced' ? 'Cloud + local memory' : memoryState === 'syncing' ? 'Syncing memory' : 'Local memory'}
            </span>
            <button onClick={onClose} className="settings-close" aria-label="Close settings"><X size={16} /></button>
          </div>
        </header>

        <nav className="settings-tabs" aria-label="Settings sections">
          <button className={tab === 'models' ? 'active' : ''} onClick={() => setTab('models')}><BrainCircuit size={13} /> Models</button>
          <button className={tab === 'integrations' ? 'active' : ''} onClick={() => setTab('integrations')}><Boxes size={13} /> Integrations <span>8</span></button>
          <button className={tab === 'appearance' ? 'active' : ''} onClick={() => setTab('appearance')}><Palette size={13} /> Appearance</button>
          <button className={tab === 'account' ? 'active' : ''} onClick={() => setTab('account')}><UserRound size={13} /> Account</button>
          <button className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}><Info size={13} /> About</button>
        </nav>

        <div className="settings-content">
          {tab === 'models' && (
            <section className="settings-section">
              <div className="settings-section-heading">
                <span className="settings-eyebrow"><BrainCircuit size={12} /> Model routing</span>
                <h3>Choose the intelligence for each task.</h3>
                <p>The selected model, reasoning effort, and automatic handoff order now follow you between devices.</p>
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
              <div className="settings-toggle-card">
                <div><GitBranch size={14} /><span><strong>Seamless model handoff</strong><small>If a provider reaches a credit or rate limit, continue with the next configured model.</small></span></div>
                <button className={failoverEnabled ? 'toggle-on' : ''} onClick={() => onFailoverChange(!failoverEnabled)} aria-pressed={failoverEnabled}><i /></button>
              </div>
              <div className="credential-card">
                <div><Key size={14} /><span><strong>Session-only API key</strong><small>Sent with model requests and cleared when this tab closes.</small></span></div>
                <input type="password" value={apiKey} onChange={event => onApiKeyChange(event.target.value)} placeholder={selectedProvider === 'anthropic' ? 'sk-ant-…' : selectedProvider === 'gemini' ? 'AIza…' : 'sk-proj-…'} />
                <div className="credential-status"><ShieldCheck size={12} /> Never written to Archon storage</div>
              </div>
              <div className="billing-later-card">
                <CreditCard size={15} />
                <span><strong>Relay credits</strong><small>In-app credit purchases are reserved for a later release.</small></span>
                <button disabled>Coming later</button>
              </div>
            </section>
          )}

          {tab === 'integrations' && <IntegrationsPanel />}

          {tab === 'appearance' && (
            <section className="settings-section">
              <div className="settings-section-heading">
                <span className="settings-eyebrow"><Palette size={12} /> Workspace appearance</span>
                <h3>Make the environment feel like yours.</h3>
                <p>Dark remains the default. Light, luminous, and liquid glass appearances apply immediately.</p>
              </div>
              <div className="appearance-settings-grid">
                {appearances.map(item => (
                  <button key={item.id} className={appearance === item.id ? 'selected' : ''} onClick={() => onAppearanceChange(item.id)}>
                    <span className="appearance-swatch" style={{ background: item.accent }} />
                    <span><strong>{item.name}</strong><small>{item.description}</small></span>
                    <i />
                  </button>
                ))}
              </div>
            </section>
          )}

          {tab === 'account' && (
            <section className="settings-section">
              <div className="settings-section-heading">
                <span className="settings-eyebrow"><UserRound size={12} /> Profile and memory</span>
                <h3>Your Relay identity.</h3>
                <p>Profile details sync through Supabase. Conversations also keep an encrypted-by-platform cloud copy plus a local offline copy.</p>
              </div>
              <div className="profile-card">
                <div className="profile-avatar">
                  {avatarDraft ? <img src={avatarDraft} alt="" /> : <UserRound size={25} />}
                </div>
                <div className="profile-fields">
                  <strong>{email || 'Signed-in user'}</strong>
                  <label>
                    <span>Profile picture URL</span>
                    <div><input type="url" value={avatarDraft} onChange={event => setAvatarDraft(event.target.value)} placeholder="https://…" /><button onClick={saveProfile}><Upload size={11} /> Save</button></div>
                  </label>
                  {accountMessage && <p>{accountMessage}</p>}
                </div>
              </div>
              <div className="memory-card">
                <div><BadgeCheck size={15} /><span><strong>Two-layer memory</strong><small>Local recovery works offline; Supabase sync restores sessions on other devices.</small></span></div>
                <span className={memoryState === 'synced' ? 'synced' : ''}>{memoryState === 'synced' ? 'Synced' : 'Local only'}</span>
              </div>
              <div className="danger-zone">
                <button className="danger-zone-header" onClick={() => setDangerOpen(!dangerOpen)}>
                  <span><strong>Danger Zone</strong><small>Sign out or permanently remove your account.</small></span>
                  <ChevronDown size={14} style={{ transform: dangerOpen ? 'rotate(180deg)' : undefined }} />
                </button>
                {dangerOpen && (
                  <div className="danger-zone-actions">
                    <button onClick={signOut}><LogOut size={12} /> Sign out</button>
                    <button className="delete" onClick={deleteAccount}><Trash2 size={12} /> Delete account</button>
                  </div>
                )}
              </div>
            </section>
          )}

          {tab === 'about' && (
            <section className="settings-section">
              <div className="settings-section-heading">
                <span className="settings-eyebrow"><Info size={12} /> About Archon</span>
                <h3>Built for uninterrupted work.</h3>
                <p>Archon is part of Relay and combines your projects, AI providers, conversations, and build activity in one workspace.</p>
              </div>
              <div className="about-links">
                <a href="https://relayapp.pro/privacy" target="_blank" rel="noopener noreferrer">Privacy policy <ExternalLink size={11} /></a>
                <a href="https://github.com/Mattjhagen/archon-ide" target="_blank" rel="noopener noreferrer">Source repository <ExternalLink size={11} /></a>
              </div>
              <div className="licenses-card">
                <div><strong>Open-source licenses</strong><span>Archon IDE web · version 0.1.0</span></div>
                {licenses.map(([name, license]) => <div key={name}><span>{name}</span><code>{license}</code></div>)}
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
