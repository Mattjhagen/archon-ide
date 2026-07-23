import { useState, useEffect, useCallback } from 'react';
import { Brain, Trash2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { memoryApi, KIND_LABEL, KIND_COLOR } from '../../lib/memoryApi';
import type { MemoryEntry } from '../../lib/memoryApi';

interface WorkspaceMemoryProps {
  workspacePath: string;
}

export function WorkspaceMemory({ workspacePath }: WorkspaceMemoryProps) {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await memoryApi.getMemory(workspacePath);
      setEntries(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load memory');
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  useEffect(() => {
    load();
  }, [load]);

  const handleClear = async () => {
    try {
      await memoryApi.clearMemory(workspacePath);
      setEntries([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear memory');
    }
  };

  return (
    <div
      className="flex-shrink-0"
      style={{ borderTop: '1px solid var(--border-faint)' }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2"
        style={{ color: 'var(--text-secondary)' }}
      >
        <Brain size={12} style={{ color: 'var(--accent)' }} />
        <span className="text-[11px] font-semibold flex-1 text-left">Workspace Memory</span>
        {entries.length > 0 && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
          >
            {entries.length}
          </span>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); load(); }}
            className="p-0.5 rounded"
            style={{ color: 'var(--text-muted)' }}
            title="Refresh"
          >
            <RefreshCw size={9} className={loading ? 'animate-spin' : ''} />
          </button>
          {entries.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
              className="p-0.5 rounded"
              style={{ color: 'var(--text-muted)' }}
              title="Clear memory"
            >
              <Trash2 size={9} />
            </button>
          )}
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div
          className="overflow-y-auto"
          style={{ maxHeight: '200px' }}
        >
          {error && (
            <p className="px-3 py-2 text-[10px]" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}

          {!loading && entries.length === 0 && !error && (
            <p className="px-3 py-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              No memory yet. Completed tasks will be remembered here.
            </p>
          )}

          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-2 px-3 py-1.5"
              style={{ borderTop: '1px solid var(--border-faint)' }}
            >
              <span
                className="text-[9px] font-semibold px-1 py-0.5 rounded flex-shrink-0 mt-0.5"
                style={{
                  background: 'var(--bg-raised)',
                  color: KIND_COLOR[entry.kind],
                  minWidth: '32px',
                  textAlign: 'center',
                }}
              >
                {KIND_LABEL[entry.kind]}
              </span>
              <p
                className="text-[10px] leading-relaxed flex-1 min-w-0"
                style={{ color: 'var(--text-secondary)' }}
              >
                {entry.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
