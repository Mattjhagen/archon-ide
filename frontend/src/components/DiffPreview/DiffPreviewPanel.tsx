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
          body: JSON.stringify({
            path: diffPreview.path,
            new_content: diffPreview.newContent,
          }),
        });
        const data = await res.json();

        const lines: DiffLine[] = [];
        let oldLine = 1;
        let newLine = 1;

        for (const hunk of data.hunks ?? []) {
          for (const line of hunk.content.split('\n')) {
            if (line.startsWith('+')) {
              lines.push({
                type: 'add',
                content: line.slice(1),
                newLineNum: newLine++,
              });
            } else if (line.startsWith('-')) {
              lines.push({
                type: 'remove',
                content: line.slice(1),
                oldLineNum: oldLine++,
              });
            } else {
              lines.push({
                type: 'context',
                content: line.slice(1),
                oldLineNum: oldLine++,
                newLineNum: newLine++,
              });
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
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileDiff size={14} className="text-blue-400" />
          <span className="text-xs font-medium text-zinc-200">Changes Preview</span>
          <span className="text-xs text-zinc-500 font-mono">{filePath.split('/').pop()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-green-400">+{diffPreview.additions}</span>
          <span className="text-xs text-red-400">-{diffPreview.deletions}</span>
          <div className="flex gap-1 ml-3">
            <button
              onClick={onAccept}
              className="btn-primary text-xs flex items-center gap-1 px-3 py-1"
            >
              <Check size={12} /> Accept
            </button>
            <button
              onClick={onReject}
              className="btn-ghost text-xs flex items-center gap-1 px-3 py-1 bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30"
            >
              <X size={12} /> Reject
            </button>
          </div>
        </div>
      </div>

      {/* Diff lines */}
      <div className="flex-1 overflow-auto font-mono text-xs">
        {diffLines.map((line, i) => (
          <div
            key={i}
            className={`flex ${
              line.type === 'add'
                ? 'bg-green-950/30 text-green-300'
                : line.type === 'remove'
                ? 'bg-red-950/30 text-red-300'
                : 'text-zinc-400'
            }`}
          >
            <span className="w-12 text-right pr-2 text-zinc-600 select-none flex-shrink-0">
              {line.oldLineNum ?? ''}
            </span>
            <span className="w-12 text-right pr-2 text-zinc-600 select-none flex-shrink-0">
              {line.newLineNum ?? ''}
            </span>
            <span className="w-6 text-center select-none flex-shrink-0">
              {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
            </span>
            <span className="flex-1 whitespace-pre-wrap px-2">
              {line.content}
            </span>
          </div>
        ))}
        {diffLines.length === 0 && (
          <div className="flex items-center justify-center h-32 text-zinc-500">
            Loading diff...
          </div>
        )}
      </div>
    </div>
  );
}
