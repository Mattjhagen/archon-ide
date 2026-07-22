import { useState } from 'react';
import { ArrowRight, Check, ChevronLeft, Eye, EyeOff, KeyRound, LockKeyhole, Sparkles } from 'lucide-react';
import { appearances, type Appearance } from '../../lib/appearance';

export interface SetupResult {
  appearance: Appearance;
  provider: string;
  model: string;
  apiKey: string;
}

interface SetupScreenProps {
  appearance: Appearance;
  onAppearanceChange: (appearance: Appearance) => void;
  onComplete: (result: SetupResult) => void;
}

const providers = [
  { id: 'openai', name: 'OpenAI', detail: 'GPT-5 and GPT-4o', model: 'gpt-4o', placeholder: 'sk-proj-…' },
  { id: 'anthropic', name: 'Anthropic', detail: 'Claude Sonnet 4', model: 'claude-sonnet-4-20250514', placeholder: 'sk-ant-…' },
  { id: 'ollama', name: 'Ollama', detail: 'Models on your machine', model: 'llama3.2', placeholder: 'No key required' },
  { id: 'mock', name: 'Explore demo', detail: 'Try Archon without a key', model: 'mock-responses', placeholder: 'No key required' },
];

export function SetupScreen({ appearance, onAppearanceChange, onComplete }: SetupScreenProps) {
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const selected = providers.find(item => item.id === provider)!;
  const requiresKey = provider === 'openai' || provider === 'anthropic';

  return (
    <main className="setup-shell">
      <div className="setup-glow" />
      <header className="setup-header">
        <div className="brand-mark"><Sparkles size={17} /></div>
        <div><strong>ARCHON</strong><span>YOUR CODE. YOUR MODELS.</span></div>
        <div className="setup-progress"><span className={step >= 0 ? 'active' : ''} /><span className={step >= 1 ? 'active' : ''} /></div>
      </header>

      <section className="setup-content" key={step}>
        {step === 0 ? (
          <>
            <div className="setup-kicker">01 · MAKE IT YOURS</div>
            <h1>Choose your workspace.</h1>
            <p className="setup-lede">Three distinct environments, one serious coding tool. You can switch any time.</p>
            <div className="theme-grid">
              {appearances.map(item => (
                <button key={item.id} className={`theme-choice theme-${item.id} ${appearance === item.id ? 'selected' : ''}`} onClick={() => onAppearanceChange(item.id)}>
                  <div className="theme-preview">
                    <span className="preview-rail" />
                    <span className="preview-code"><i /><i /><i /><i /></span>
                    <span className="preview-panel"><i /><i /><i /></span>
                  </div>
                  <div className="theme-copy"><span className="theme-dot" style={{ background: item.accent }} /><div><strong>{item.name}</strong><p>{item.description}</p></div>{appearance === item.id && <Check size={16} />}</div>
                </button>
              ))}
            </div>
            <button className="setup-primary" onClick={() => setStep(1)}>Continue <ArrowRight size={16} /></button>
          </>
        ) : (
          <>
            <button className="setup-back" onClick={() => setStep(0)}><ChevronLeft size={15} /> Appearance</button>
            <div className="setup-kicker">02 · CONNECT INTELLIGENCE</div>
            <h1>Bring your own model.</h1>
            <p className="setup-lede">Your credential is attached only to requests you send. Archon never persists API keys.</p>
            <div className="provider-grid">
              {providers.map(item => (
                <button key={item.id} className={`provider-choice ${provider === item.id ? 'selected' : ''}`} onClick={() => { setProvider(item.id); setApiKey(''); }}>
                  <span className="provider-monogram">{item.name.slice(0, 1)}</span>
                  <span><strong>{item.name}</strong><small>{item.detail}</small></span>
                  <span className="radio-dot" />
                </button>
              ))}
            </div>
            {requiresKey && (
              <label className="key-field">
                <span><KeyRound size={14} /> {selected.name} API key</span>
                <div><input autoFocus type={showKey ? 'text' : 'password'} value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={selected.placeholder} /><button onClick={() => setShowKey(value => !value)} type="button">{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
              </label>
            )}
            <div className="privacy-note"><LockKeyhole size={15} /><span><strong>Session-only by design.</strong> Refreshing or closing Archon clears your key.</span></div>
            <button className="setup-primary" disabled={requiresKey && !apiKey.trim()} onClick={() => onComplete({ appearance, provider, model: selected.model, apiKey })}>Enter Archon <ArrowRight size={16} /></button>
          </>
        )}
      </section>
      <footer className="setup-footer"><span>Local-first workspace</span><span>Keys never persisted</span><span>Open source</span></footer>
    </main>
  );
}
