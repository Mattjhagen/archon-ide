import { useMemo, useState } from 'react';
import { Check, ChevronRight, Import, LockKeyhole, PlugZap, Search } from 'lucide-react';
import { integrationCategories, integrations, type IntegrationCategory } from '../../lib/integrations';
import { ContextImportDialog } from './ContextImportDialog';

type CategoryFilter = 'all' | IntegrationCategory;

export function IntegrationsPanel() {
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  const [showContextImport, setShowContextImport] = useState(false);
  const filtered = useMemo(() => integrations.filter(item => {
    const categoryMatch = category === 'all' || item.category === category;
    const search = `${item.name} ${item.description} ${item.capabilities.join(' ')}`.toLowerCase();
    return categoryMatch && search.includes(query.trim().toLowerCase());
  }), [category, query]);

  return (
    <section className="integration-panel">
      <div className="integration-hero">
        <div>
          <span className="settings-eyebrow"><PlugZap size={12} /> Tool network</span>
          <h3>Give Archon the right tools.</h3>
          <p>Connections are scoped per user. Every consequential action will be visible, reviewable, and revocable.</p>
        </div>
        <div className="integration-security"><LockKeyhole size={14} /><span>OAuth-ready<br /><small>No shared browser secrets</small></span></div>
      </div>

      <div className="integration-toolbar">
        <div className="integration-filters">
          {integrationCategories.map(item => (
            <button key={item.id} className={category === item.id ? 'active' : ''} onClick={() => setCategory(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <label className="integration-search"><Search size={12} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a connector" /></label>
      </div>

      <div className="integration-grid">
        {filtered.map(item => {
          const foundationReady = item.availability === 'available';
          const canReviewImport = item.id === 'context-import';
          return (
            <article className="integration-card" key={item.id}>
              <div className="integration-card-top">
                <div className="integration-mark" style={{ '--connector-accent': item.accent } as React.CSSProperties}>{item.monogram}</div>
                <div className={`integration-badge ${item.availability}`}>
                  {foundationReady ? <><Check size={9} /> Foundation ready</> : item.availability === 'next' ? 'Up next' : 'Planned'}
                </div>
              </div>
              <h4>{item.name}</h4>
              <p>{item.description}</p>
              <div className="integration-capabilities">
                {item.capabilities.map(capability => <span key={capability}>{capability}</span>)}
              </div>
              <button className="integration-action" disabled={!canReviewImport} onClick={() => canReviewImport && setShowContextImport(true)}>
                {item.auth === 'import' ? <Import size={12} /> : <PlugZap size={12} />}
                {canReviewImport ? 'Review local export' : foundationReady ? 'Secure access in build' : item.availability === 'next' ? 'Coming next' : 'On roadmap'}
                {canReviewImport && <ChevronRight size={12} />}
              </button>
            </article>
          );
        })}
      </div>
      {filtered.length === 0 && <div className="integration-empty">No connectors match that search.</div>}

      <div className="integration-note">
        “Foundation ready” means the product already uses this service or has an adapter boundary. Repository/project authorization and agent tool access remain disabled until the secure server-side runtime is merged.
      </div>
      {showContextImport && <ContextImportDialog onClose={() => setShowContextImport(false)} />}
    </section>
  );
}
