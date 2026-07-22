import { useState, useCallback, useEffect } from 'react';
import { useAppState } from './hooks/useAppState';
import { Sidebar } from './components/Layout/Sidebar';
import { EditorArea } from './components/Editor/EditorArea';
import { AiChatPanel } from './components/AiChat/AiChatPanel';
import { TerminalPanel } from './components/Terminal/TerminalPanel';
import { StatusBar } from './components/StatusBar/StatusBar';
import { WelcomeScreen } from './components/Layout/WelcomeScreen';
import { DiffPreviewPanel } from './components/DiffPreview/DiffPreviewPanel';
import { SettingsModal } from './components/Settings/SettingsModal';

function App() {
  const app = useAppState();
  const [showSettings, setShowSettings] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's') {
        e.preventDefault();
        if (app.state.activeFile) app.saveFile(app.state.activeFile);
      }
      if (mod && e.key === 'Shift+P') {
        e.preventDefault();
        // Command palette placeholder
      }
      if (mod && e.key === '`') {
        e.preventDefault();
        app.update({ terminalVisible: !app.state.terminalVisible });
      }
      if (mod && e.key === 'b') {
        e.preventDefault();
        app.update({ sidebarCollapsed: !app.state.sidebarCollapsed });
      }
      if (mod && e.key === 'e') {
        e.preventDefault();
        app.update({ aiPanelVisible: !app.state.aiPanelVisible });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [app]);

  const handleFolderOpen = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.addEventListener('change', () => {
      const files = input.files;
      if (files && files.length > 0) {
        const path = (files[0] as any).path ?? files[0].webkitRelativePath.split('/')[0];
        // For web: use the first file's path to infer project root
        // For electron/tauri: would use the native path
        const projectPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : path;
        app.openProject(projectPath);
      }
    });
    input.click();
  }, [app]);

  const handlePathInput = useCallback(() => {
    const path = prompt('Enter project path:');
    if (path) app.openProject(path);
  }, [app]);

  // Sidebar resize
  const handleSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = app.state.sidebarWidth;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      app.update({ sidebarWidth: Math.max(180, Math.min(500, startWidth + delta)) });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [app]);

  // AI panel resize
  const handleAiResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = app.state.aiPanelWidth;

    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      app.update({ aiPanelWidth: Math.max(280, Math.min(600, startWidth + delta)) });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [app]);

  // Terminal resize
  const handleTerminalResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = app.state.terminalHeight;

    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      app.update({ terminalHeight: Math.max(100, Math.min(500, startHeight + delta)) });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [app]);

  if (!app.state.projectPath) {
    return (
      <div className="h-screen w-screen bg-zinc-950 text-zinc-200 flex flex-col">
        <WelcomeScreen
          onOpenFolder={handleFolderOpen}
          onOpenPath={handlePathInput}
        />
        <StatusBar state={app.state} onOpenSettings={() => setShowSettings(true)} />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-200 flex flex-col overflow-hidden">
      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        {!app.state.sidebarCollapsed && (
          <>
            <Sidebar
              state={app.state}
              onOpenFile={app.openFile}
              onRefreshGit={app.refreshGit}
              onUpdate={app.update}
              width={app.state.sidebarWidth}
            />
            <div
              className="w-px bg-zinc-700 cursor-col-resize hover:bg-blue-500 transition-colors flex-shrink-0"
              onMouseDown={handleSidebarResize}
            />
          </>
        )}

        {/* Center + bottom area */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Editor area */}
          <div className="flex-1 min-h-0 flex flex-col">
            {app.state.diffPreview ? (
              <DiffPreviewPanel
                diffPreview={app.state.diffPreview}
                onAccept={app.acceptDiff}
                onReject={app.rejectDiff}
                filePath={app.state.diffPreview.path}
              />
            ) : (
              <EditorArea
                openFiles={app.state.openFiles}
                activeFile={app.state.activeFile}
                onSelectFile={(p) => app.update({ activeFile: p })}
                onCloseFile={app.closeFile}
                onContentChange={app.updateFileContent}
                onSave={app.saveFile}
                onShowDiff={(path, content) => app.showDiffPreview(path, content)}
              />
            )}
          </div>

          {/* Terminal resize handle */}
          {app.state.terminalVisible && (
            <div
              className="h-1 bg-zinc-700 cursor-row-resize hover:bg-blue-500 transition-colors flex-shrink-0"
              onMouseDown={handleTerminalResize}
            />
          )}

          {/* Terminal */}
          {app.state.terminalVisible && (
            <div style={{ height: app.state.terminalHeight }} className="flex-shrink-0">
              <TerminalPanel
                projectPath={app.state.projectPath}
                sessionId={app.state.terminalSessionId}
                onSessionCreated={(id) => app.update({ terminalSessionId: id })}
              />
            </div>
          )}
        </div>

        {/* AI panel resize handle */}
        {app.state.aiPanelVisible && (
          <div
            className="w-px bg-zinc-700 cursor-col-resize hover:bg-blue-500 transition-colors flex-shrink-0"
            onMouseDown={handleAiResize}
          />
        )}

        {/* AI Panel */}
        {app.state.aiPanelVisible && (
          <AiChatPanel
            messages={app.state.chatMessages}
            loading={app.state.aiLoading}
            onSend={app.sendChatMessage}
            providers={app.state.providers}
            selectedProvider={app.state.selectedProvider}
            selectedModel={app.state.selectedModel}
            onProviderChange={(p) => app.update({ selectedProvider: p })}
            onModelChange={(m) => app.update({ selectedModel: m })}
            width={app.state.aiPanelWidth}
            activeFilePath={app.state.activeFile}
          />
        )}
      </div>

      {/* Status Bar */}
      <StatusBar
        state={app.state}
        onOpenSettings={() => setShowSettings(true)}
        onToggleTerminal={() => app.update({ terminalVisible: !app.state.terminalVisible })}
        onToggleSidebar={() => app.update({ sidebarCollapsed: !app.state.sidebarCollapsed })}
        onToggleAi={() => app.update({ aiPanelVisible: !app.state.aiPanelVisible })}
      />

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          providers={app.state.providers}
          selectedProvider={app.state.selectedProvider}
          selectedModel={app.state.selectedModel}
          onProviderChange={(p) => app.update({ selectedProvider: p })}
          onModelChange={(m) => app.update({ selectedModel: m })}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
