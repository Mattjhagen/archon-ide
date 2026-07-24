import { FolderOpen, Terminal, PanelLeft, MessageSquare, Settings, GitBranch, ExternalLink } from 'lucide-react';
import type { AppState } from '../../hooks/useAppState';
import { detectLanguage } from '../../lib/utils';

interface StatusBarProps {
  state: AppState;
  onOpenSettings?: () => void;
  onToggleTerminal?: () => void;
  onToggleSidebar?: () => void;
  onToggleAi?: () => void;
  onCloseProject?: () => void;
}

export function StatusBar({ state, onOpenSettings, onToggleTerminal, onToggleSidebar, onToggleAi, onCloseProject }: StatusBarProps) {
  return (
    <div
      className="status-bar h-[26px] text-white flex items-center px-2 text-[11px] flex-shrink-0 select-none"
      style={{
        background: 'linear-gradient(180deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 -1px 4px rgba(0,0,0,0.3)',
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-1">
        {onToggleSidebar && (
          <SBBtn onClick={onToggleSidebar} title="Toggle Sidebar (Ctrl+B)"><PanelLeft size={12} /></SBBtn>
        )}
        <button onClick={onCloseProject} disabled={!onCloseProject} className="flex items-center gap-1 px-1.5 py-0.5 opacity-80" title={onCloseProject ? 'Back to projects' : undefined}>
          <FolderOpen size={10} />
          <span className="max-w-[200px] truncate text-[11px]">{state.projectPath?.split('/').pop() ?? 'No project'}</span>
        </button>
        {state.gitStatus && state.gitStatus.branch !== 'none' && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 opacity-75">
            <GitBranch size={10} />
            <span>{state.gitStatus.branch}</span>
            {state.gitStatus.ahead > 0 && <span className="opacity-80">↑{state.gitStatus.ahead}</span>}
            {state.gitStatus.behind > 0 && <span className="opacity-80">↓{state.gitStatus.behind}</span>}
          </span>
        )}
        {state.gitStatus && state.gitStatus.files.length > 0 && (
          <span className="px-1.5 py-0.5 opacity-75">⊕{state.gitStatus.files.length}</span>
        )}
      </div>

      <div className="flex-1" />

      {/* Right */}
      <div className="flex items-center gap-0.5">
        {state.activeFile && (
          <span className="px-1.5 py-0.5 opacity-70 text-[10px]">{detectLanguage(state.activeFile)}</span>
        )}
        <span className="px-1.5 py-0.5 opacity-50 text-[10px]">{state.selectedModel}</span>
        {onToggleTerminal && <SBBtn onClick={onToggleTerminal} title="Toggle Terminal (Ctrl+`)"><Terminal size={11} /></SBBtn>}
        {onToggleAi && <SBBtn onClick={onToggleAi} title="Toggle AI Panel (Ctrl+E)"><MessageSquare size={11} /></SBBtn>}
        {onOpenSettings && <SBBtn onClick={onOpenSettings} title="Settings"><Settings size={11} /></SBBtn>}
        <a href="http://relayapp.pro/" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
          style={{ color: 'white', opacity: 0.6, transition: 'opacity var(--t-fast)' }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = 'transparent'; }}
          title="Relay — Your AI Development Platform">
          Relay <ExternalLink size={8} />
        </a>
      </div>
    </div>
  );
}

function SBBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} className="flex items-center justify-center px-1.5 py-0.5 rounded"
      style={{ color: 'white', opacity: 0.85, transition: 'all var(--t-fast)', background: 'transparent', borderRadius: 'var(--r-xs)' }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.background = 'transparent'; }}>
      {children}
    </button>
  );
}
