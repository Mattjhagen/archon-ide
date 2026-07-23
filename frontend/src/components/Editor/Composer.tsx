import { useState } from 'react';
import { Send, CheckCircle2, Play, SquareTerminal } from 'lucide-react';

export function Composer() {
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleGeneratePlan = () => {
    // Simulated generation of an implementation plan based on prompt
    setPlan(`### Implementation Plan
1. Create new feature file.
2. Update existing layout.
3. Apply styling.

Review and approve to apply these changes across multiple files.`);
  };

  const handleExecute = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      setPlan(null);
      setPrompt('');
      alert('Changes applied successfully!');
    }, 2000);
  };

  return (
    <div className="absolute top-4 right-4 w-96 flex flex-col shadow-2xl rounded-xl z-50 overflow-hidden" 
         style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)' }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-faint)', background: 'var(--bg-surface)' }}>
        <SquareTerminal size={14} style={{ color: 'var(--accent)' }} />
        <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>Composer (Plan Mode)</span>
      </div>
      
      <div className="p-4 flex flex-col gap-3">
        <textarea 
          className="w-full text-[12px] p-2 rounded-lg resize-none"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe a complex feature or multi-file refactor..."
          style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', outline: 'none' }}
        />
        
        {!plan && (
          <button 
            onClick={handleGeneratePlan}
            disabled={!prompt.trim()}
            className="self-end px-3 py-1.5 rounded-lg flex items-center gap-2 text-[11px] font-medium transition-opacity"
            style={{ background: 'var(--accent)', color: '#fff', opacity: prompt.trim() ? 1 : 0.5 }}
          >
            <Send size={12} /> Generate Plan
          </button>
        )}
        
        {plan && (
          <div className="flex flex-col gap-3 animation-fadeIn">
            <div className="p-3 rounded-lg text-[11px]" style={{ background: 'var(--bg-raised)', border: '1px dashed var(--accent)', color: 'var(--text-secondary)' }}>
              {plan.split('\n').map((line, i) => (
                <div key={i} className={line.startsWith('#') ? 'font-bold text-white mb-1' : ''}>{line}</div>
              ))}
            </div>
            
            <button 
              onClick={handleExecute}
              disabled={isExecuting}
              className="self-end px-3 py-1.5 rounded-lg flex items-center gap-2 text-[11px] font-medium"
              style={{ background: 'var(--success)', color: '#fff' }}
            >
              {isExecuting ? <Play size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} 
              {isExecuting ? 'Applying Edits...' : 'Approve & Execute'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
