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
  { id: 'mock', name: 'Explore demo', detail: 'Simulated mock responses (not real analysis)', model: 'mock-responses', placeholder: 'No key required' },
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
        <div className="setup-progress" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={2}>
          <span className={step >= 0 ? 'active' : ''} aria-current={step === 0 ? 'step' : undefined} />
          <span className={step >= 1 ? 'active' : ''} aria-current={step === 1 ? 'step' : undefined} />
        </div>
      </header>

      <section className="setup-content" key={step}>
        {step === 0 ? (
          <>
            <div className="setup-kicker">01 · MAKE IT YOURS</div>
            <h1>Choose your workspace.</h1>
            <p className="setup-lede">Three distinct environments, one serious coding tool. You can switch any time.</p>
            <div className="theme-grid" role="radiogroup" aria-label="Select appearance theme">
              {appearances.map(item => (
                <button key={item.id} role="radio" aria-checked={appearance === item.id} className={`theme-choice theme-${item.id} ${appearance === item.id ? 'selected' : ''} focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500`} onClick={() => onAppearanceChange(item.id)}>
                  <div className="theme-preview" aria-hidden="true">
                    <span className="preview-rail" />
                    <span className="preview-code"><i /><i /><i /><i /></span>
                    <span className="preview-panel"><i /><i /><i /></span>
                  </div>
                  <div className="theme-copy"><span className="theme-dot" style={{ background: item.accent }} aria-hidden="true" /><div><strong>{item.name}</strong><p>{item.description}</p></div>{appearance === item.id && <Check size={16} aria-hidden="true" />}</div>
                </button>
              ))}
            </div>
            <button className="setup-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500" onClick={() => setStep(1)}>Continue <ArrowRight size={16} aria-hidden="true" /></button>
          </>
        ) : (
          <>
            <button className="setup-back focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500" onClick={() => setStep(0)}><ChevronLeft size={15} aria-hidden="true" /> Appearance</button>
            <div className="setup-kicker">02 · CONNECT INTELLIGENCE</div>
            <h1>Bring your own model.</h1>
            <p className="setup-lede">Your credential is attached only to requests you send. Archon never persists API keys.</p>
            <div className="provider-grid" role="radiogroup" aria-label="Select AI provider">
              {providers.map(item => (
                <button key={item.id} role="radio" aria-checked={provider === item.id} className={`provider-choice ${provider === item.id ? 'selected' : ''} focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500`} onClick={() => { setProvider(item.id); setApiKey(''); }}>
                  <span className="provider-monogram" aria-hidden="true">{item.name.slice(0, 1)}</span>
                  <span><strong>{item.name}</strong><small>{item.detail}</small></span>
                  <span className="radio-dot" aria-hidden="true" />
                </button>
              ))}
            </div>
            {requiresKey && (
              <label className="key-field">
                <span><KeyRound size={14} aria-hidden="true" /> {selected.name} API key</span>
                <div><input autoFocus type={showKey ? 'text' : 'password'} value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={selected.placeholder} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500" /><button onClick={() => setShowKey(value => !value)} type="button" aria-label={showKey ? "Hide API key" : "Show API key"} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">{showKey ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}</button></div>
              </label>
            )}
            <div className="privacy-note"><LockKeyhole size={15} aria-hidden="true" /><span><strong>Session-only by design.</strong> Refreshing or closing Archon clears your key.</span></div>
            <button className="setup-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500" disabled={requiresKey && !apiKey.trim()} onClick={() => onComplete({ appearance, provider, model: selected.model, apiKey })}>Enter Archon <ArrowRight size={16} aria-hidden="true" /></button>
          </>
        )}
      </section>
      <footer className="setup-footer"><span>Local-first workspace</span><span>Keys never persisted</span><span>Open source</span></footer>
    </main>
  );
}
