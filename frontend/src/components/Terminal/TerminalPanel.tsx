import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { Monitor } from 'lucide-react';
import 'xterm/css/xterm.css';
import { authenticatedFetch } from '../../lib/supabase';

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

  useEffect(() => {
    if (sessionId) return;

    const createSession = async () => {
      try {
        const res = await authenticatedFetch('/api/term/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_path: projectPath, cols: 120, rows: 24 }),
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

  useEffect(() => {
    if (!terminalRef.current) return;

    const terminal = new Terminal({
      theme: {
        background: '#0c0c12',
        foreground: '#e0e0e8',
        cursor: '#e0e0e8',
        cursorAccent: '#0c0c12',
        selectionBackground: 'rgba(99, 102, 241, 0.25)',
        selectionForeground: '#ffffff',
        black: '#1a1a24',
        red: '#f87171',
        green: '#34d399',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e0e0e8',
        brightBlack: '#6b6b80',
        brightRed: '#fca5a5',
        brightGreen: '#6ee7b7',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#ffffff',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      scrollback: 5000,
      drawBoldTextInBrightColors: true,
      minimumContrastRatio: 1,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.onData((data) => {
      if (sessionId) {
        authenticatedFetch('/api/term/input', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: sessionId, data }),
        }).catch(console.error);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (sessionId) {
        const dims = fitAddon.proposeDimensions();
        if (dims) {
          authenticatedFetch('/api/term/resize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: sessionId, cols: dims.cols, rows: dims.rows }),
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

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      {/* Terminal header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 flex-shrink-0"
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-faint)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <Monitor size={12} style={{ color: 'var(--text-muted)' }} />
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Terminal</span>
        </div>
        <span className="text-[10px] flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: connected ? 'var(--success)' : 'var(--text-muted)' }}
          />
          <span style={{ color: connected ? 'var(--text-muted)' : 'var(--text-muted)' }}>
            {connected ? 'Connected' : 'Connecting...'}
          </span>
        </span>
      </div>
      {/* Terminal body */}
      <div ref={terminalRef} className="flex-1 overflow-hidden" />
    </div>
  );
}
