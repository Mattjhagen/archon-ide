import { FolderOpen, Terminal, Cpu, Sparkles, ArrowRight, ExternalLink } from 'lucide-react';

interface WelcomeScreenProps {
  onOpenFolder: () => void;
  onOpenPath: () => void;
}

export function WelcomeScreen({ onOpenFolder, onOpenPath }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex items-center justify-center anim-fade-in" style={{ background: 'var(--bg-void)' }}>
      <div className="text-center max-w-lg px-8" style={{ animation: 'fadeInUp 0.7s var(--ease) both' }}>
        {/* Animated logo */}
        <div className="mb-12" style={{ animation: 'float 6s ease-in-out infinite' }}>
          <div
            className="w-24 h-24 mx-auto rounded-3xl flex items-center justify-center relative"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 40%, #3b82f6 100%)',
              boxShadow: '0 0 60px rgba(139, 92, 246, 0.3), 0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
              animation: 'gradientShift 4s ease infinite',
              backgroundSize: '200% 200%',
            }}
          >
            <Cpu size={42} className="text-white" strokeWidth={1.5} />
            <div
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg-void)', boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)' }}
            >
              <Sparkles size={12} style={{ color: '#a78bfa' }} />
            </div>
          </div>
        </div>

        {/* Title */}
        <h1
          className="text-4xl font-bold mb-3 tracking-tight"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.8) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Archon
        </h1>
        <p className="text-base mb-14" style={{ color: 'var(--text-tertiary)' }}>
          AI-powered coding assistant
        </p>

        {/* Action cards */}
        <div className="space-y-3 max-w-sm mx-auto">
          <ActionCard
            onClick={onOpenFolder}
            icon={<FolderOpen size={20} />}
            label="Open Local Folder"
            description="Browse local directory (Cloud sync available after secure workspace provisioning)"
            gradient="linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(99, 102, 241, 0.04))"
            borderColor="rgba(139, 92, 246, 0.15)"
            iconColor="#a78bfa"
            hoverBorder="rgba(139, 92, 246, 0.4)"
          />
          <ActionCard
            onClick={onOpenPath}
            icon={<Terminal size={20} />}
            label="Open Path"
            description="Type a filesystem path directly"
            gradient="linear-gradient(135deg, rgba(52, 211, 153, 0.06), rgba(52, 211, 153, 0.02))"
            borderColor="rgba(52, 211, 153, 0.12)"
            iconColor="#34d399"
            hoverBorder="rgba(52, 211, 153, 0.35)"
          />
        </div>

        {/* Keyboard shortcuts */}
        <div className="mt-14 flex items-center justify-center gap-4 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1.5"><kbd>Ctrl+S</kbd> Save</span>
          <span style={{ color: 'var(--border-default)' }}>·</span>
          <span className="flex items-center gap-1.5"><kbd>Ctrl+B</kbd> Sidebar</span>
          <span style={{ color: 'var(--border-default)' }}>·</span>
          <span className="flex items-center gap-1.5"><kbd>Ctrl+`</kbd> Terminal</span>
        </div>

        {/* Relay link */}
        <div className="mt-6 text-center">
          <a href="http://relayapp.pro/" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] group"
            style={{ color: 'var(--text-muted)', transition: 'color var(--t-fast)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-hover)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
            Part of the <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Relay</span> ecosystem
            <ExternalLink size={10} className="opacity-0 group-hover:opacity-100" style={{ transition: 'opacity var(--t-fast)' }} />
          </a>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  onClick, icon, label, description, gradient, borderColor, iconColor, hoverBorder,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
  gradient: string;
  borderColor: string;
  iconColor: string;
  hoverBorder: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`${label}: ${description}`}
      className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      style={{
        background: gradient,
        border: `1px solid ${borderColor}`,
        transition: 'all 0.25s var(--ease)',
        borderRadius: 'var(--r-xl)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = hoverBorder;
        e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px ${hoverBorder}`;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = borderColor;
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ color: iconColor }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</div>
        <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</div>
      </div>
      <ArrowRight
        size={16}
        className="flex-shrink-0"
        style={{
          color: 'var(--text-muted)',
          opacity: 0,
          transition: 'all 0.25s var(--ease)',
          transform: 'translateX(-8px)',
        }}
        ref={(el) => {
          if (el) {
            const parent = el.closest('button');
            parent?.addEventListener('mouseenter', () => { el.style.opacity = '1'; el.style.transform = 'translateX(0)'; });
            parent?.addEventListener('mouseleave', () => { el.style.opacity = '0'; el.style.transform = 'translateX(-8px)'; });
          }
        }}
      />
    </button>
  );
}
