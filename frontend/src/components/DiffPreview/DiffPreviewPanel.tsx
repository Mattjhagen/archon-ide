import { useEffect, useState } from 'react';
import { Check, X, FileDiff } from 'lucide-react';

interface DiffPreviewProps {
  diffPreview: {
    path: string;
    newContent: string;
    additions: number;
    deletions: number;
  };
  onAccept: () => void;
  onReject: () => void;
  filePath: string;
}

interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

export function DiffPreviewPanel({ diffPreview, onAccept, onReject, filePath }: DiffPreviewProps) {
  const [diffLines, setDiffLines] = useState<DiffLine[]>([]);

  useEffect(() => {
    const generateDiff = async () => {
      try {
        const res = await fetch('/api/diff/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: diffPreview.path, new_content: diffPreview.newContent }),
        });
        const data = await res.json();

        const lines: DiffLine[] = [];
        let oldLine = 1;
        let newLine = 1;

        for (const hunk of data.hunks ?? []) {
          for (const line of hunk.content.split('\n')) {
            if (line.startsWith('+')) {
              lines.push({ type: 'add', content: line.slice(1), newLineNum: newLine++ });
            } else if (line.startsWith('-')) {
              lines.push({ type: 'remove', content: line.slice(1), oldLineNum: oldLine++ });
            } else {
              lines.push({ type: 'context', content: line.slice(1), oldLineNum: oldLine++, newLineNum: newLine++ });
            }
          }
        }

        setDiffLines(lines);
      } catch (e) {
        console.error('Failed to generate diff:', e);
      }
    };

    generateDiff();
  }, [diffPreview]);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
        style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-faint)' }}
      >
        <div className="flex items-center gap-2.5">
          <FileDiff size={14} style={{ color: 'var(--accent)' }} />
          <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>Changes Preview</span>
          <span className="text-[11px] px-2 py-0.5 rounded-lg" style={{ color: 'var(--text-tertiary)', background: 'var(--bg-raised)', border: '1px solid var(--border-faint)', fontFamily: "'JetBrains Mono', monospace" }}>
            {filePath.split('/').pop()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium" style={{ color: 'var(--success)', fontFamily: "'JetBrains Mono', monospace" }}>+{diffPreview.additions}</span>
            <span className="text-[11px] font-medium" style={{ color: 'var(--error)', fontFamily: "'JetBrains Mono', monospace" }}>-{diffPreview.deletions}</span>
          </div>
          <div className="flex gap-1.5">
            <button onClick={onAccept} className="btn-primary text-[11px] font-medium flex items-center gap-1.5 px-3 py-1.5">
              <Check size={12} /> Accept
            </button>
            <button onClick={onReject} className="btn-danger text-[11px] font-medium flex items-center gap-1.5 px-3 py-1.5">
              <X size={12} /> Reject
            </button>
          </div>
        </div>
      </div>

      {/* Diff lines */}
      <div className="flex-1 overflow-auto text-[12px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        {diffLines.map((line, i) => (
          <div key={i} className="flex">
            <span className="w-12 text-right pr-2 select-none flex-shrink-0" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
              {line.oldLineNum ?? ''}
            </span>
            <span className="w-12 text-right pr-2 select-none flex-shrink-0" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
              {line.newLineNum ?? ''}
            </span>
            <span className="w-6 text-center select-none flex-shrink-0 font-semibold"
              style={{ color: line.type === 'add' ? 'var(--success)' : line.type === 'remove' ? 'var(--error)' : 'transparent' }}>
              {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
            </span>
            <span className="flex-1 whitespace-pre-wrap px-2 py-px"
              style={{
                background: line.type === 'add' ? 'var(--success-muted)' : line.type === 'remove' ? 'var(--error-muted)' : 'transparent',
                color: line.type === 'add' ? 'var(--success)' : line.type === 'remove' ? 'var(--error)' : 'var(--text-tertiary)',
              }}>
              {line.content}
            </span>
          </div>
        ))}
        {diffLines.length === 0 && (
          <div className="flex items-center justify-center h-32" style={{ color: 'var(--text-muted)' }}>
            Loading diff...
          </div>
        )}
      </div>
    </div>
  );
}
