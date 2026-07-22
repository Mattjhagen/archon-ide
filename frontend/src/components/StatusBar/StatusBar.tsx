import { FolderOpen, Terminal, PanelLeft, MessageSquare, Settings } from 'lucide-react';
import type { AppState } from '../../hooks/useAppState';
import { detectLanguage } from '../../lib/utils';

interface StatusBarProps {
  state: AppState;
  onOpenSettings?: () => void;
  onToggleTerminal?: () => void;
  onToggleSidebar?: () => void;
  onToggleAi?: () => void;
}

export function StatusBar({ state, onOpenSettings, onToggleTerminal, onToggleSidebar, onToggleAi }: StatusBarProps) {
  return (
    <div className="h-6 bg-blue-600 text-white flex items-center px-3 text-xs flex-shrink-0 select-none">
      {/* Left section */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button onClick={onToggleSidebar} className="flex items-center gap-1 hover:bg-blue-700 px-1.5 py-0.5 rounded" title="Toggle Sidebar (Ctrl+B)">
            <PanelLeft size={12} />
          </button>
        )}
        <span className="flex items-center gap-1">
          <FolderOpen size={11} />
          {state.projectPath ?? 'No project'}
        </span>
        {state.gitStatus && state.gitStatus.branch !== 'none' && (
          <span className="flex items-center gap-1 opacity-90">
            ⑂ {state.gitStatus.branch}
            {state.gitStatus.ahead > 0 && ` ↑${state.gitStatus.ahead}`}
            {state.gitStatus.behind > 0 && ` ↓${state.gitStatus.behind}`}
          </span>
        )}
      </div>

      {/* Center */}
      <div className="flex-1" />

      {/* Right section */}
      <div className="flex items-center gap-3">
        {state.activeFile && (
          <span className="opacity-80">
            {detectLanguage(state.activeFile)}
          </span>
        )}
        <span className="opacity-70">
          {state.selectedProvider}/{state.selectedModel}
        </span>
        {onToggleTerminal && (
          <button onClick={onToggleTerminal} className="flex items-center gap-1 hover:bg-blue-700 px-1.5 py-0.5 rounded" title="Toggle Terminal (Ctrl+`)">
            <Terminal size={11} />
          </button>
        )}
        {onToggleAi && (
          <button onClick={onToggleAi} className="flex items-center gap-1 hover:bg-blue-700 px-1.5 py-0.5 rounded" title="Toggle AI Panel (Ctrl+E)">
            <MessageSquare size={11} />
          </button>
        )}
        {onOpenSettings && (
          <button onClick={onOpenSettings} className="flex items-center gap-1 hover:bg-blue-700 px-1.5 py-0.5 rounded" title="Settings">
            <Settings size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
