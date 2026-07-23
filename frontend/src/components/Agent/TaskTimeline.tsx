import type { AgentEvent } from '../../types/agent';
import { EVENT_KIND_ICON } from '../../types/agent';

interface TaskTimelineProps {
  events: AgentEvent[];
}

export function TaskTimeline({ events }: TaskTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
        No events yet
      </div>
    );
  }

  return (
    <div className="space-y-1 px-2 py-2">
      {events.map((ev) => (
        <div
          key={ev.id}
          className="flex items-start gap-2 px-2 py-1.5 rounded-lg"
          style={{ background: 'var(--bg-surface)' }}
        >
          <span className="text-[10px] flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {EVENT_KIND_ICON[ev.kind] ?? '·'}
          </span>
          <div className="flex-1 min-w-0">
            <p
              className="text-[11px] leading-snug truncate"
              style={{ color: 'var(--text-secondary)' }}
            >
              {ev.summary}
            </p>
            {'preview' in ev.metadata && Boolean(ev.metadata.preview) && (
              <pre
                className="text-[10px] mt-1 whitespace-pre-wrap break-words"
                style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}
              >
                {String(ev.metadata.preview).slice(0, 300)}
              </pre>
            )}
          </div>
          <span className="text-[9px] flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>
            #{ev.sequence}
          </span>
        </div>
      ))}
    </div>
  );
}
