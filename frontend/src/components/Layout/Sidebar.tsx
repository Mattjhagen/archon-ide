import { useState, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, File, Folder, FolderOpen,
  GitBranch, RefreshCw, Search, FileText,
  Image, FileCode, GitCommitHorizontal, Circle
} from 'lucide-react';
import type { AppState } from '../../hooks/useAppState';
import type { TreeNode } from '../../types';

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
      className="flex flex-col flex-shrink-0 h-full"
      style={{ width, background: 'var(--bg-base)', borderRight: '1px solid var(--border-faint)' }}
    >
      <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid var(--border-faint)' }}>
        <TabBtn active={state.sidebarPanel === 'files'} onClick={() => onUpdate({ sidebarPanel: 'files' })} icon={<Folder size={13} />} label="Files" />
        <TabBtn active={state.sidebarPanel === 'git'} onClick={() => onUpdate({ sidebarPanel: 'git' })} icon={<GitBranch size={13} />} label="Git" badge={state.gitStatus?.files.length} />
        <TabBtn active={state.sidebarPanel === 'search'} onClick={() => onUpdate({ sidebarPanel: 'search' })} icon={<Search size={13} />} label="Search" />
      </div>
      <div className="flex-1 overflow-auto">
        {state.sidebarPanel === 'files' && <FileTree tree={state.projectTree} onOpenFile={onOpenFile} />}
        {state.sidebarPanel === 'git' && <GitPanel status={state.gitStatus} log={state.gitLog} onRefresh={onRefreshGit} />}
        {state.sidebarPanel === 'search' && <SearchPanel projectPath={state.projectPath} onOpenFile={onOpenFile} />}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium select-none"
      style={{
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        background: active ? 'var(--bg-surface)' : 'transparent',
        borderBottom: active ? '1.5px solid var(--accent)' : '1.5px solid transparent',
        transition: 'all var(--t-fast)',
        borderRadius: 0,
      }}
    >
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span
          className="ml-1 px-1.5 py-px text-[9px] font-semibold rounded-full"
          style={{ background: 'var(--accent-muted)', color: 'var(--accent-hover)' }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/* ============ File Tree ============ */

function FileTree({ tree, onOpenFile }: { tree: TreeNode | null; onOpenFile: (path: string) => void }) {
  if (!tree) return <div className="p-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>No files loaded</div>;
  return (
    <div className="py-1">
      {tree.children.map(c => <FileTreeNode key={c.path} node={c} onOpenFile={onOpenFile} depth={0} />)}
    </div>
  );
}

function FileTreeNode({ node, onOpenFile, depth }: { node: TreeNode; onOpenFile: (p: string) => void; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const toggle = () => node.is_dir ? setExpanded(!expanded) : onOpenFile(node.path);

  return (
    <div>
      <div
        className="flex items-center gap-1.5 cursor-pointer select-none group"
        style={{ paddingLeft: depth * 14 + 10, paddingRight: 8, paddingTop: 3, paddingBottom: 3, transition: 'background var(--t-fast)' }}
        onClick={toggle}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {node.is_dir ? (
          <span style={{ color: 'var(--text-muted)' }}>{expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
        ) : <span className="w-2.5" />}
        {node.is_dir ? (
          expanded ? <FolderOpen size={14} style={{ color: '#818cf8', flexShrink: 0 }} /> : <Folder size={14} style={{ color: '#818cf8', flexShrink: 0 }} />
        ) : <FileIcon name={node.name} />}
        <span className="truncate text-[12px]" style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >{node.name}</span>
      </div>
      {node.is_dir && expanded && node.children.map(c => <FileTreeNode key={c.path} node={c} onOpenFile={onOpenFile} depth={depth + 1} />)}
    </div>
  );
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const c = 'w-3.5 h-3.5 flex-shrink-0';
  const colors: Record<string, string> = { ts: '#60a5fa', tsx: '#60a5fa', js: '#fbbf24', jsx: '#fbbf24', py: '#34d399', rs: '#fb923c', go: '#22d3ee', json: '#fbbf24', md: '#a78bfa', css: '#f472b6', scss: '#f472b6', html: '#fb923c' };
  if (colors[ext]) return <FileCode className={c} style={{ color: colors[ext] }} />;
  if (['png', 'jpg', 'svg'].includes(ext)) return <Image className={c} style={{ color: '#c084fc' }} />;
  if (['txt', 'log'].includes(ext)) return <FileText className={c} style={{ color: 'var(--text-muted)' }} />;
  return <File size={14} className={c} style={{ color: 'var(--text-muted)' }} />;
}

/* ============ Git Panel ============ */

function GitPanel({ status, log, onRefresh }: { status: AppState['gitStatus']; log: AppState['gitLog']; onRefresh: () => void }) {
  if (!status) return (
    <div className="p-4 text-center">
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>No git repository detected</p>
      <button onClick={onRefresh} className="btn-ghost text-xs"><RefreshCw size={11} className="inline mr-1" /> Refresh</button>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-faint)' }}>
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Source Control</span>
        <button onClick={onRefresh} className="btn-ghost p-1"><RefreshCw size={11} /></button>
      </div>
      {status.files.length > 0 && (
        <div style={{ borderBottom: '1px solid var(--border-faint)' }}>
          <div className="px-3 py-1.5 text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Changes ({status.files.length})</div>
          {status.files.map(f => (
            <div key={f.path} className="flex items-center gap-2 px-3 py-1 text-xs cursor-pointer"
              style={{ transition: 'background var(--t-fast)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Circle size={6} fill={f.status === 'new' ? 'var(--success)' : f.status === 'modified' ? 'var(--warning)' : f.status === 'deleted' ? 'var(--error)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
              <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{f.path}</span>
              <span className="ml-auto text-[10px] font-mono font-semibold"
                style={{ color: f.status === 'new' ? 'var(--success)' : f.status === 'modified' ? 'var(--warning)' : f.status === 'deleted' ? 'var(--error)' : 'var(--text-muted)' }}>
                {f.status === 'new' ? 'A' : f.status === 'modified' ? 'M' : 'D'}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <div className="px-3 py-1.5 text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Recent Commits</div>
        {log.length > 0 ? log.map(e => (
          <div key={e.hash} className="px-3 py-2 text-xs cursor-pointer"
            style={{ transition: 'background var(--t-fast)' }}
            onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
            <div className="flex items-center gap-2">
              <GitCommitHorizontal size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span className="font-mono text-[11px]" style={{ color: 'var(--accent-hover)' }}>{e.hash.slice(0, 7)}</span>
            </div>
            <div className="mt-0.5 pl-[14px] truncate" style={{ color: 'var(--text-secondary)' }}>{e.message}</div>
            <div className="mt-0.5 pl-[14px]" style={{ color: 'var(--text-muted)' }}>{e.author} · {e.date}</div>
          </div>
        )) : <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>No commits yet</div>}
      </div>
    </div>
  );
}

/* ============ Search Panel ============ */

function SearchPanel({ projectPath, onOpenFile }: { projectPath: string | null; onOpenFile: (p: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ path: string; line: number; content: string }[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!projectPath || !query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch('/api/fs/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ root: projectPath, query }) });
      setResults(await res.json());
    } catch (e) { console.error('Search failed:', e); }
    setSearching(false);
  }, [projectPath, query]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border-faint)' }}>
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search in project..." className="w-full text-xs" />
      </div>
      <div className="flex-1 overflow-auto">
        {searching && <div className="px-3 py-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>Searching...</div>}
        {!searching && results.length === 0 && query && <div className="px-3 py-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>No results found</div>}
        {results.map((r, i) => (
          <div key={i} className="px-3 py-2 text-xs cursor-pointer"
            style={{ borderBottom: '1px solid var(--border-faint)', transition: 'background var(--t-fast)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => onOpenFile(`${projectPath}/${r.path}`)}>
            <div className="font-mono text-[11px]"><span style={{ color: 'var(--accent-hover)' }}>{r.path}</span><span style={{ color: 'var(--text-muted)' }}>:{r.line}</span></div>
            <div className="truncate mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>{r.content.trim()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
