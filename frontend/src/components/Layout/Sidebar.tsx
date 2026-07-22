import { useState, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, File, Folder, FolderOpen,
  GitBranch, RefreshCw, Search, Code, FileText, Settings,
  Image, Box, FileCode
} from 'lucide-react';
import type { AppState } from '../../hooks/useAppState';
import type { TreeNode, SidebarPanel } from '../../types';

interface SidebarProps {
  state: AppState;
  onOpenFile: (path: string) => void;
  onRefreshGit: () => void;
  onUpdate: (patch: Partial<AppState>) => void;
  width: number;
}

export function Sidebar({ state, onOpenFile, onRefreshGit, onUpdate, width }: SidebarProps) {
  return (
    <div
      className="bg-zinc-900 border-r border-zinc-800 flex flex-col flex-shrink-0 h-full"
      style={{ width }}
    >
      {/* Panel tabs */}
      <div className="flex border-b border-zinc-800">
        <TabButton
          active={state.sidebarPanel === 'files'}
          onClick={() => onUpdate({ sidebarPanel: 'files' })}
          icon={<Folder size={14} />}
          label="Files"
        />
        <TabButton
          active={state.sidebarPanel === 'git'}
          onClick={() => onUpdate({ sidebarPanel: 'git' })}
          icon={<GitBranch size={14} />}
          label="Git"
          badge={state.gitStatus?.files.length}
        />
        <TabButton
          active={state.sidebarPanel === 'search'}
          onClick={() => onUpdate({ sidebarPanel: 'search' })}
          icon={<Search size={14} />}
          label="Search"
        />
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-auto">
        {state.sidebarPanel === 'files' && (
          <FileTree
            tree={state.projectTree}
            onOpenFile={onOpenFile}
          />
        )}
        {state.sidebarPanel === 'git' && (
          <GitPanel
            status={state.gitStatus}
            log={state.gitLog}
            onRefresh={onRefreshGit}
            projectPath={state.projectPath}
          />
        )}
        {state.sidebarPanel === 'search' && (
          <SearchPanel
            projectPath={state.projectPath}
            onOpenFile={onOpenFile}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active, onClick, icon, label, badge
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors border-b-2 ${
        active
          ? 'border-blue-500 text-white bg-zinc-800'
          : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
      }`}
    >
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-blue-600 text-white rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}

// ============================================
// File Tree
// ============================================

function FileTree({ tree, onOpenFile }: { tree: TreeNode | null; onOpenFile: (path: string) => void }) {
  if (!tree) {
    return (
      <div className="p-4 text-zinc-500 text-xs text-center">
        No files loaded
      </div>
    );
  }

  return (
    <div className="py-1">
      {tree.children.map(child => (
        <FileTreeNode key={child.path} node={child} onOpenFile={onOpenFile} depth={0} />
      ))}
    </div>
  );
}

function FileTreeNode({
  node, onOpenFile, depth
}: {
  node: TreeNode;
  onOpenFile: (path: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 1);

  const handleClick = () => {
    if (node.is_dir) {
      setExpanded(!expanded);
    } else {
      onOpenFile(node.path);
    }
  };

  const icon = node.is_dir ? (
    expanded ? <FolderOpen size={14} className="text-blue-400 flex-shrink-0" /> : <Folder size={14} className="text-blue-400 flex-shrink-0" />
  ) : (
    <FileIcon name={node.name} />
  );

  return (
    <div>
      <div
        className="flex items-center gap-1 py-[3px] px-2 hover:bg-zinc-800 cursor-pointer group text-xs select-none"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {node.is_dir && (
          <span className="text-zinc-500 flex-shrink-0">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
        {!node.is_dir && <span className="w-3" />}
        {icon}
        <span className="truncate text-zinc-300 group-hover:text-white">
          {node.name}
        </span>
      </div>
      {node.is_dir && expanded && (
        <div>
          {node.children.map(child => (
            <FileTreeNode key={child.path} node={child} onOpenFile={onOpenFile} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const iconClass = 'w-3.5 h-3.5 flex-shrink-0';

  if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) return <FileCode className={`${iconClass} text-yellow-400`} />;
  if (['py'].includes(ext)) return <FileCode className={`${iconClass} text-green-400`} />;
  if (['rs'].includes(ext)) return <FileCode className={`${iconClass} text-orange-400`} />;
  if (['go'].includes(ext)) return <FileCode className={`${iconClass} text-cyan-400`} />;
  if (['json'].includes(ext)) return <FileText className={`${iconClass} text-yellow-300`} />;
  if (['md'].includes(ext)) return <FileText className={`${iconClass} text-blue-300`} />;
  if (['css', 'scss'].includes(ext)) return <FileCode className={`${iconClass} text-pink-400`} />;
  if (['html'].includes(ext)) return <FileCode className={`${iconClass} text-orange-300`} />;
  if (['png', 'jpg', 'gif', 'svg'].includes(ext)) return <Image className={`${iconClass} text-purple-400`} />;
  return <File size={14} className={`${iconClass} text-zinc-400`} />;
}

// ============================================
// Git Panel
// ============================================

function GitPanel({
  status, log, onRefresh, projectPath
}: {
  status: AppState['gitStatus'];
  log: AppState['gitLog'];
  onRefresh: () => void;
  projectPath: string | null;
}) {
  if (!status) {
    return (
      <div className="p-4 text-center">
        <p className="text-zinc-500 text-xs mb-3">No git repository detected</p>
        <button onClick={onRefresh} className="btn-ghost text-xs">
          <RefreshCw size={12} className="inline mr-1" /> Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-xs font-medium text-zinc-300">Source Control</span>
        <button onClick={onRefresh} className="btn-ghost p-1">
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Changed files */}
      {status.files.length > 0 && (
        <div className="border-b border-zinc-800">
          <div className="px-3 py-1 text-xs text-zinc-400 font-medium">
            Changes ({status.files.length})
          </div>
          {status.files.map(f => (
            <div
              key={f.path}
              className="flex items-center gap-2 px-3 py-1 text-xs hover:bg-zinc-800 cursor-pointer"
            >
              <span className={`font-mono ${
                f.status === 'new' ? 'text-green-400' :
                f.status === 'modified' ? 'text-yellow-400' :
                f.status === 'deleted' ? 'text-red-400' :
                'text-zinc-400'
              }`}>
                {f.staged ? '●' : '○'}
              </span>
              <span className="text-zinc-300 truncate">{f.path}</span>
              <span className={`ml-auto flex-shrink-0 ${
                f.status === 'new' ? 'text-green-400' :
                f.status === 'modified' ? 'text-yellow-400' :
                f.status === 'deleted' ? 'text-red-400' :
                'text-zinc-500'
              }`}>
                {f.status === 'new' ? 'A' : f.status === 'modified' ? 'M' : f.status === 'deleted' ? 'D' : '?'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Recent commits */}
      <div className="flex-1 overflow-auto">
        <div className="px-3 py-1 text-xs text-zinc-400 font-medium">
          Recent Commits
        </div>
        {log.map(entry => (
          <div key={entry.hash} className="px-3 py-1.5 text-xs hover:bg-zinc-800">
            <div className="flex items-center gap-2">
              <span className="font-mono text-zinc-500">{entry.hash}</span>
              <span className="text-zinc-300 truncate">{entry.message}</span>
            </div>
            <div className="text-zinc-500 mt-0.5">
              {entry.author} · {entry.date}
            </div>
          </div>
        ))}
        {log.length === 0 && (
          <div className="px-3 py-2 text-zinc-500 text-xs">No commits yet</div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Search Panel
// ============================================

function SearchPanel({
  projectPath, onOpenFile
}: {
  projectPath: string | null;
  onOpenFile: (path: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ path: string; line: number; content: string }[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!projectPath || !query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch('/api/fs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectPath, query }),
      });
      const data = await res.json();
      setResults(data);
    } catch (e) {
      console.error('Search failed:', e);
    }
    setSearching(false);
  }, [projectPath, query]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-zinc-800">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search in project..."
          className="w-full text-xs"
        />
      </div>
      <div className="flex-1 overflow-auto">
        {searching && (
          <div className="px-3 py-4 text-center text-zinc-500 text-xs">Searching...</div>
        )}
        {!searching && results.length === 0 && query && (
          <div className="px-3 py-4 text-center text-zinc-500 text-xs">No results found</div>
        )}
        {results.map((r, i) => (
          <div
            key={i}
            className="px-3 py-1.5 text-xs hover:bg-zinc-800 cursor-pointer border-b border-zinc-800/50"
            onClick={() => onOpenFile(`${projectPath}/${r.path}`)}
          >
            <div className="text-zinc-300 font-mono">{r.path}:{r.line}</div>
            <div className="text-zinc-500 truncate mt-0.5">{r.content.trim()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
