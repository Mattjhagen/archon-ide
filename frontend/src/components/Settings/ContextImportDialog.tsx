import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, LoaderCircle, ShieldCheck, Upload, X } from 'lucide-react';
import { contextImportLimits, parseConversationImport, type ImportedConversation } from '../../lib/contextImport';

interface ContextImportDialogProps {
  onClose: () => void;
}

const MAX_FILE_BYTES = 1_500_000;

export function ContextImportDialog({ onClose }: ContextImportDialogProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<ImportedConversation | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const chooseFile = () => fileInput.current?.click();
  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setDraft(null);
    setFileName(file.name);
    if (file.size > MAX_FILE_BYTES) {
      setError('Choose an export under 1.5 MB. Large histories will be supported through the secure task context service.');
      return;
    }
    setLoading(true);
    try {
      const text = await file.text();
      setDraft(parseConversationImport(text, file.name));
    } catch {
      setError('Archon could not read that export. Use UTF-8 JSON, Markdown, or text.');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="context-import-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="context-import-dialog" role="dialog" aria-modal="true" aria-labelledby="context-import-title" onMouseDown={event => event.stopPropagation()}>
        <header>
          <div><span className="settings-eyebrow"><FileText size={12} /> Local context review</span><h3 id="context-import-title">Prepare a conversation safely.</h3></div>
          <button onClick={onClose} aria-label="Close conversation import"><X size={15} /></button>
        </header>
        <p className="context-import-lede">Choose a ChatGPT-style JSON export, Claude or Gemini export, Markdown, or text. This file is parsed only in this browser and is not uploaded or saved.</p>

        <input ref={fileInput} className="sr-only" type="file" accept=".json,.md,.mdx,.txt,application/json,text/plain,text/markdown" onChange={onFileChange} />
        <button className="context-import-drop" onClick={chooseFile} disabled={loading}>
          {loading ? <LoaderCircle size={18} className="spin" /> : <Upload size={18} />}
          <span><strong>{loading ? 'Reading export…' : 'Choose a conversation export'}</strong><small>JSON, Markdown, or text · up to 1.5 MB</small></span>
        </button>

        {error && <div className="context-import-error" role="alert"><AlertTriangle size={14} />{error}</div>}
        {draft && <div className="context-import-result">
          <div className="context-import-summary"><CheckCircle2 size={16} /><div><strong>{draft.title}</strong><span>{draft.source} · {draft.messages.length} messages · {draft.characterCount.toLocaleString()} characters</span></div></div>
          {draft.warnings.length > 0 && <div className="context-import-warnings">{draft.warnings.map(warning => <span key={warning}><AlertTriangle size={11} />{warning}</span>)}</div>}
          <pre>{draft.preview || 'No readable text is available for preview.'}</pre>
        </div>}

        <footer>
          <span><ShieldCheck size={13} /> Parsed locally · content limit {contextImportLimits.maxCharacters.toLocaleString()} characters</span>
          <button className="btn-primary" disabled>Attach when task context is ready</button>
        </footer>
      </section>
    </div>
  );
}
