import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface TerminalPanelProps {
  projectPath: string;
  sessionId: string | null;
  onSessionCreated: (id: string) => void;
}

export function TerminalPanel({ projectPath, sessionId, onSessionCreated }: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [connected, setConnected] = useState(false);

  // Create terminal session
  useEffect(() => {
    if (sessionId) return;

    const createSession = async () => {
      try {
        const res = await fetch('/api/term/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_path: projectPath,
            cols: 120,
            rows: 24,
          }),
        });
        const data = await res.json();
        if (data.id) {
          onSessionCreated(data.id);
          setConnected(true);
        }
      } catch (e) {
        console.error('Failed to create terminal session:', e);
      }
    };

    createSession();
  }, [projectPath, sessionId, onSessionCreated]);

  // Initialize xterm
  useEffect(() => {
    if (!terminalRef.current) return;

    const terminal = new Terminal({
      theme: {
        background: '#09090b',
        foreground: '#fafafa',
        cursor: '#fafafa',
        cursorAccent: '#09090b',
        selectionBackground: 'rgba(59, 130, 246, 0.3)',
        black: '#18181b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#fafafa',
        brightBlack: '#71717a',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#ffffff',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 13,
      lineHeight: 1.3,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Handle user input → send to backend
    terminal.onData((data) => {
      if (sessionId) {
        fetch('/api/term/input', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: sessionId, data }),
        }).catch(console.error);
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (sessionId) {
        const dims = fitAddon.proposeDimensions();
        if (dims) {
          fetch('/api/term/resize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: sessionId,
              cols: dims.cols,
              rows: dims.rows,
            }),
          }).catch(console.error);
        }
      }
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      xtermRef.current = null;
    };
  }, [sessionId]);

  // Poll for terminal output (simplified approach for prototype)
  useEffect(() => {
    if (!sessionId || !xtermRef.current) return;

    // In a production version, this would use WebSocket or SSE
    // For the prototype, we skip real-time polling to avoid complexity
  }, [sessionId]);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-3 py-1 bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
        <span className="text-xs text-zinc-400 font-medium">Terminal</span>
        <span className="text-[10px] text-zinc-600">
          {connected ? '● Connected' : '○ Connecting...'}
        </span>
      </div>
      {/* Terminal body */}
      <div ref={terminalRef} className="flex-1 overflow-hidden" />
    </div>
  );
}
