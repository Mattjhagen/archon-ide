import { useState, useCallback, useEffect } from 'react';
import { useAppState } from './hooks/useAppState';
import { Sidebar } from './components/Layout/Sidebar';
import { EditorArea } from './components/Editor/EditorArea';
import { AiChatPanel } from './components/AiChat/AiChatPanel';
import { TaskPanel } from './components/Agent/TaskPanel';
import { TerminalPanel } from './components/Terminal/TerminalPanel';
import { StatusBar } from './components/StatusBar/StatusBar';
import { WelcomeScreen } from './components/Layout/WelcomeScreen';
import { DiffPreviewPanel } from './components/DiffPreview/DiffPreviewPanel';
import { SettingsModal } from './components/Settings/SettingsModal';
import { SetupScreen, type SetupResult } from './components/Setup/SetupScreen';
import { TaskPanel } from './components/Agent/TaskPanel';
import { applyAppearance, savedAppearance, type Appearance } from './lib/appearance';

type AiPanelMode = 'chat' | 'tasks';

function App() {
  const app = useAppState();
  const [showSettings, setShowSettings] = useState(false);
  const [aiSurface, setAiSurface] = useState<'tasks' | 'chat'>('tasks');
  const [appearance, setAppearance] = useState<Appearance>(savedAppearance);
  const [setupComplete, setSetupComplete] = useState(() => localStorage.getItem('archon.setupComplete') === 'true');
  const [aiPanelMode, setAiPanelMode] = useState<AiPanelMode>('chat');

  useEffect(() => applyAppearance(appearance), [appearance]);

  const completeSetup = useCallback((result: SetupResult) => {
    setAppearance(result.appearance);
    app.update({ selectedProvider: result.provider, selectedModel: result.model, apiKey: result.apiKey });
    localStorage.setItem('archon.setupComplete', 'true');
    setSetupComplete(true);
  }, [app]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's') {
        e.preventDefault();
        if (app.state.activeFile) app.saveFile(app.state.activeFile);
      }
      if (mod && e.key === 'Shift+P') {
        e.preventDefault();
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

  if (!setupComplete) {
    return <SetupScreen appearance={appearance} onAppearanceChange={setAppearance} onComplete={completeSetup} />;
  }

  if (!app.state.projectPath) {
    return (
      <div
        className="h-screen w-screen flex flex-col"
        style={{ background: 'var(--bg-void)', color: 'var(--text-primary)' }}
      >
        <WelcomeScreen onOpenFolder={handleFolderOpen} onOpenPath={handlePathInput} />
        <StatusBar state={app.state} onOpenSettings={() => setShowSettings(true)} />
        {showSettings && (
          <SettingsModal
            providers={app.state.providers}
            selectedProvider={app.state.selectedProvider}
            selectedModel={app.state.selectedModel}
            reasoningEffort={app.state.reasoningEffort}
            apiKey={app.state.apiKey}
            appearance={appearance}
            onAppearanceChange={setAppearance}
            onApiKeyChange={(apiKey) => app.update({ apiKey })}
            onProviderChange={(p) => app.update({ selectedProvider: p })}
            onModelChange={(m) => app.update({ selectedModel: m })}
            onReasoningEffortChange={(reasoningEffort) => app.update({ reasoningEffort })}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ background: 'var(--bg-void)', color: 'var(--text-primary)' }}
    >
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
            <div className="resize-col" onMouseDown={handleSidebarResize} />
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
            <div className="resize-row" onMouseDown={handleTerminalResize} />
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
          <div className="resize-col" onMouseDown={handleAiResize} />
        )}

        {/* AI Panel — Chat or Tasks */}
        {app.state.aiPanelVisible && (
          <div
            className="flex flex-col flex-shrink-0 overflow-hidden"
            style={{ width: app.state.aiPanelWidth }}
          >
            {/* Mode tab bar */}
            <div
              className="flex items-center gap-0.5 px-2 py-1 flex-shrink-0"
              style={{
                borderBottom: '1px solid var(--border-faint)',
                background: 'var(--bg-base)',
              }}
            >
              {(['chat', 'tasks'] as AiPanelMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setAiPanelMode(mode)}
                  className="px-3 py-1 rounded-md text-[11px] font-medium capitalize"
                  style={{
                    background: aiPanelMode === mode ? 'var(--accent-subtle)' : 'transparent',
                    color:
                      aiPanelMode === mode ? 'var(--accent-hover)' : 'var(--text-muted)',
                  }}
                >
                  {mode === 'tasks' ? 'Agent Tasks' : 'Chat'}
                </button>
              ))}
            </div>

            {aiPanelMode === 'chat' ? (
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
                reasoningEffort={app.state.reasoningEffort}
                creditsConsumed={app.state.creditsConsumed}
                onReasoningEffortChange={(reasoningEffort) => app.update({ reasoningEffort })}
                agentStatus={app.state.agentStatus}
                onStop={app.stopAgent}
              />
            ) : (
              <TaskPanel
                width={app.state.aiPanelWidth}
                projectPath={app.state.projectPath}
                providers={app.state.providers}
                selectedProvider={app.state.selectedProvider}
                selectedModel={app.state.selectedModel}
                apiKey={app.state.apiKey}
                reasoningEffort={app.state.reasoningEffort}
                onProviderChange={(p) => app.update({ selectedProvider: p })}
                onModelChange={(m) => app.update({ selectedModel: m })}
                onReasoningEffortChange={(reasoningEffort) => app.update({ reasoningEffort })}
              />
            )}
          </div>
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
          reasoningEffort={app.state.reasoningEffort}
          apiKey={app.state.apiKey}
          appearance={appearance}
          onAppearanceChange={setAppearance}
          onApiKeyChange={(apiKey) => app.update({ apiKey })}
          onProviderChange={(p) => app.update({ selectedProvider: p })}
          onModelChange={(m) => app.update({ selectedModel: m })}
          onReasoningEffortChange={(reasoningEffort) => app.update({ reasoningEffort })}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
