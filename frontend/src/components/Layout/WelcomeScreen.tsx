import { FolderOpen, Terminal, Cpu } from 'lucide-react';

interface WelcomeScreenProps {
  onOpenFolder: () => void;
  onOpenPath: () => void;
}

export function WelcomeScreen({ onOpenFolder, onOpenPath }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-lg">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6">
            <Cpu size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Archon IDE</h1>
          <p className="text-zinc-400 text-lg">AI-powered coding assistant</p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={onOpenFolder}
            className="w-full flex items-center gap-3 px-6 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 hover:border-blue-500 transition-all text-left group"
          >
            <FolderOpen size={20} className="text-blue-400 group-hover:text-blue-300" />
            <div>
              <div className="font-medium text-white">Open Folder</div>
              <div className="text-xs text-zinc-400">Browse and select a project directory</div>
            </div>
          </button>

          <button
            onClick={onOpenPath}
            className="w-full flex items-center gap-3 px-6 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 hover:border-blue-500 transition-all text-left group"
          >
            <Terminal size={20} className="text-green-400 group-hover:text-green-300" />
            <div>
              <div className="font-medium text-white">Open Path</div>
              <div className="text-xs text-zinc-400">Type a filesystem path directly</div>
            </div>
          </button>
        </div>

        {/* Keyboard shortcuts */}
        <div className="mt-10 text-xs text-zinc-500 space-y-1">
          <p><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700">Ctrl+S</kbd> Save &nbsp; <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700">Ctrl+B</kbd> Sidebar &nbsp; <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700">Ctrl+`</kbd> Terminal</p>
        </div>
      </div>
    </div>
  );
}
