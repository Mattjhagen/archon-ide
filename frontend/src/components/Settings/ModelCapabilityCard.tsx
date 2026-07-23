import { BrainCircuit, CheckCircle2, Clock3, Gauge, Sparkles } from 'lucide-react';
import type { ReasoningEffort } from '../../types';
import { effortEstimate, modelProfile } from '../../lib/modelProfiles';

interface ModelCapabilityCardProps {
  provider: string;
  model: string;
  effort: ReasoningEffort;
  onEffortChange: (effort: ReasoningEffort) => void;
}

export function ModelCapabilityCard({ provider, model, effort, onEffortChange }: ModelCapabilityCardProps) {
  const profile = modelProfile(provider, model);
  const estimate = effortEstimate(effort);

  return (
    <aside className="model-capability-card" aria-live="polite">
      <div className="model-capability-title"><Sparkles size={13} /><span>Selected model profile</span></div>
      <div className="model-capability-head"><div><strong>{profile.bestFor}</strong><p>{profile.description}</p></div><span className={`model-pace ${profile.pace.toLowerCase()}`}><Clock3 size={10} />{profile.pace}</span></div>
      <div className="model-capability-chips">
        {profile.capabilities.map(capability => <span key={capability.label} className={capability.state}><CheckCircle2 size={9} />{capability.label}</span>)}
      </div>
      <div className="model-effort-estimate"><BrainCircuit size={13} /><span><strong>{estimate.label} reasoning · {estimate.multiplier}× credits</strong><small>{estimate.detail}. Provider token usage can vary.</small></span><Gauge size={13} /></div>
      <div className="model-effort-options" role="group" aria-label="Reasoning effort">
        {(['low', 'medium', 'high'] as ReasoningEffort[]).map(option => (
          <button key={option} className={effort === option ? 'selected' : ''} onClick={() => onEffortChange(option)}>{option}</button>
        ))}
      </div>
      <p className="model-capability-note">“Agent tools” becomes available after the secure task runtime is enabled. Archon will show its actual task and tool status rather than infer it from the model.</p>
    </aside>
  );
}
