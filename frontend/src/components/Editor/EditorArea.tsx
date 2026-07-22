import { useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { X } from 'lucide-react';
import type { OpenFile } from '../../types';

interface EditorAreaProps {
  openFiles: OpenFile[];
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  onCloseFile: (path: string) => void;
  onContentChange: (path: string, content: string) => void;
  onSave: (path: string) => void;
  onShowDiff: (path: string, content: string) => void;
}

export function EditorArea({ openFiles, activeFile, onSelectFile, onCloseFile, onContentChange, onSave }: EditorAreaProps) {
  const editorRef = useRef<any>(null);

  const handleMount = useCallback((editor: any) => {
    editorRef.current = editor;
    editor.addAction({ id: 'save', label: 'Save', keybindings: [2048 | 49], run: () => { if (activeFile) onSave(activeFile); } });
  }, [activeFile, onSave]);

  const active = openFiles.find(f => f.path === activeFile);
  const lang: Record<string, string> = { typescript: 'typescript', javascript: 'javascript', python: 'python', rust: 'rust', go: 'go', html: 'html', css: 'css', json: 'json', yaml: 'yaml', markdown: 'markdown', shell: 'shell' };

  if (!openFiles.length) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg-void)' }}>
        <div className="text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No files open</p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>Open a file from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tabs */}
      <div className="flex flex-shrink-0 overflow-x-auto" style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-faint)' }}>
        {openFiles.map(f => {
          const name = f.path.split('/').pop() ?? f.path;
          const active_ = f.path === activeFile;
          return (
            <div
              key={f.path}
              className="flex items-center gap-1.5 px-3 py-2 text-[11px] cursor-pointer group min-w-0 select-none"
              style={{
                background: active_ ? 'var(--bg-void)' : 'transparent',
                color: active_ ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: active_ ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                borderRight: '1px solid var(--border-faint)',
                transition: 'all var(--t-fast)',
              }}
              onClick={() => onSelectFile(f.path)}
              onMouseEnter={e => { if (!active_) { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
              onMouseLeave={e => { if (!active_) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
            >
              {f.modified && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--warning)' }} />}
              <span className="truncate max-w-[120px]">{name}</span>
              <button
                onClick={ev => { ev.stopPropagation(); onCloseFile(f.path); }}
                className="ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100"
                style={{ color: 'var(--text-muted)', transition: 'all var(--t-fast)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              ><X size={11} /></button>
            </div>
          );
        })}
      </div>
      {/* Editor */}
      {active && (
        <div className="flex-1 min-h-0" style={{ background: 'var(--bg-void)' }}>
          <Editor
            key={active.path}
            height="100%"
            language={lang[active.language] ?? 'plaintext'}
            value={active.content}
            theme="vs-dark"
            onChange={v => { if (v !== undefined) onContentChange(active.path, v); }}
            onMount={handleMount}
            options={{
              fontSize: 13.5,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontLigatures: true,
              minimap: { enabled: true, maxColumn: 80, scale: 1 },
              scrollBeyondLastLine: false,
              renderLineHighlight: 'all',
              bracketPairColorization: { enabled: true },
              guides: { bracketPairs: true, indentation: true },
              padding: { top: 16, bottom: 16 },
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              cursorStyle: 'line',
              cursorWidth: 2,
              wordWrap: 'off',
              automaticLayout: true,
              tabSize: 2,
              formatOnPaste: true,
              suggestOnTriggerCharacters: true,
              lineHeight: 1.7,
              letterSpacing: 0.3,
              renderWhitespace: 'selection',
              overviewRulerBorder: false,
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              scrollbar: { verticalScrollbarSize: 5, horizontalScrollbarSize: 5, useShadows: false },
            }}
          />
        </div>
      )}
    </div>
  );
}
