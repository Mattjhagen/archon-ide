import { useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { X, Save } from 'lucide-react';
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

export function EditorArea({
  openFiles,
  activeFile,
  onSelectFile,
  onCloseFile,
  onContentChange,
  onSave,
  onShowDiff,
}: EditorAreaProps) {
  const editorRef = useRef<any>(null);

  const handleEditorMount = useCallback((editor: any) => {
    editorRef.current = editor;
    // Add save shortcut to Monaco
    editor.addAction({
      id: 'save-file',
      label: 'Save File',
      keybindings: [2048 | 49], // Ctrl+S
      run: () => {
        if (activeFile) onSave(activeFile);
      },
    });
  }, [activeFile, onSave]);

  const activeFileData = openFiles.find(f => f.path === activeFile);
  const languageMap: Record<string, string> = {
    typescript: 'typescript',
    javascript: 'javascript',
    python: 'python',
    rust: 'rust',
    go: 'go',
    html: 'html',
    css: 'css',
    json: 'json',
    yaml: 'yaml',
    markdown: 'markdown',
    shell: 'shell',
    dockerfile: 'dockerfile',
  };

  if (openFiles.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950 text-zinc-500">
        <div className="text-center">
          <p className="text-sm">No files open</p>
          <p className="text-xs mt-1">Open a file from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tab bar */}
      <div className="flex bg-zinc-900 border-b border-zinc-800 overflow-x-auto flex-shrink-0">
        {openFiles.map(file => {
          const name = file.path.split('/').pop() ?? file.path;
          const isActive = file.path === activeFile;
          return (
            <div
              key={file.path}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-zinc-800 min-w-0 group ${
                isActive
                  ? 'bg-zinc-950 text-white border-t-2 border-t-blue-500'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
              onClick={() => onSelectFile(file.path)}
            >
              {file.modified && (
                <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
              )}
              <span className="truncate max-w-[120px]">{name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseFile(file.path);
                }}
                className="ml-1 opacity-0 group-hover:opacity-100 hover:text-white p-0.5"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Editor */}
      {activeFileData && (
        <div className="flex-1 min-h-0">
          <Editor
            key={activeFileData.path}
            height="100%"
            language={languageMap[activeFileData.language] ?? 'plaintext'}
            value={activeFileData.content}
            theme="vs-dark"
            onChange={(value) => {
              if (value !== undefined) {
                onContentChange(activeFileData.path, value);
              }
            }}
            onMount={handleEditorMount}
            options={{
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              minimap: { enabled: true, maxColumn: 80 },
              scrollBeyondLastLine: false,
              renderLineHighlight: 'gutter',
              bracketPairColorization: { enabled: true },
              guides: { bracketPairs: true },
              padding: { top: 8 },
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              wordWrap: 'off',
              automaticLayout: true,
              tabSize: 2,
              formatOnPaste: true,
              suggestOnTriggerCharacters: true,
            }}
          />
        </div>
      )}
    </div>
  );
}
