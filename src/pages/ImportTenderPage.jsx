import { useState } from 'react';
import { apiFetch } from '../lib/apiClient';
import { bhutanToday } from '../lib/today';

// Creates a project from a won tender: the owner uploads the bid's
// BOQ_Pricing.xlsx from the tender dashboard, checks the preview
// (POST /api/projects/import-boq), then confirms (POST /api/projects/from-boq).

function money(n) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n ?? 0);
}
function qty(n) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(n ?? 0);
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-sm)', minWidth: 0 }}>
      {label}
      {children}
    </label>
  );
}

function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <div className="ticket" style={{ borderColor: 'var(--color-brick)', padding: 'var(--space-3) var(--space-4)' }}>
      <p style={{ color: 'var(--color-brick)', margin: 0 }}>{message}</p>
    </div>
  );
}

function SectionPreview({ section }) {
  const [open, setOpen] = useState(false);
  const total = section.items.reduce((t, i) => t + i.amount, 0);
  return (
    <div className="ticket ticket--sunken" style={{ padding: 'var(--space-3) var(--space-4)' }}>
      <button onClick={() => setOpen(!open)} aria-expanded={open}
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', width: '100%' }}>
        <span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{open ? '▾' : '▸'} {section.name}</span>
        <span className="numeric" style={{ whiteSpace: 'nowrap', color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>
          {section.items.length} line{section.items.length === 1 ? '' : 's'} · Nu. {money(total)}
        </span>
      </button>
      {open && (
        <ol style={{ margin: 'var(--space-3) 0 0', paddingLeft: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {section.items.map((i) => (
            <li key={i.line_no} value={i.line_no} style={{ fontSize: 'var(--text-sm)' }}>
              <span style={{ overflowWrap: 'anywhere' }}>{i.description}</span>
              <br />
              <span className="numeric" style={{ color: i.rate === 0 ? 'var(--color-brick)' : 'var(--color-aggregate)' }}>
                {qty(i.quantity)} {i.unit} × Nu. {money(i.rate)} = Nu. {money(i.amount)}{i.rate === 0 ? ' (no rate)' : ''}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function ImportTenderPage({ onCreated, onCancel }) {
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name: '', location: '', start_date: bhutanToday(), target_end_date: '', tender_ref: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function readFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReading(true);
    setError(null);
    setPreview(null);
    setFileName(file.name);
    try {
      const body = new FormData();
      body.append('file', file);
      const result = await apiFetch('/api/projects/import-boq', { method: 'POST', body });
      setPreview(result);
      setForm((f) => ({ ...f, name: result.title || f.name, tender_ref: result.tender_ref || f.tender_ref }));
    } catch (err) {
      setError(err.message);
    } finally {
      setReading(false);
      e.target.value = '';
    }
  }

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const project = await apiFetch('/api/projects/from-boq', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          location: form.location.trim() || null,
          start_date: form.start_date || null,
          target_end_date: form.target_end_date || null,
          tender_ref: form.tender_ref.trim() || null,
          sections: preview.sections.map((s) => ({
            name: s.name,
            items: s.items.map(({ description, unit, quantity, rate }) => ({ description, unit, quantity, rate })),
          })),
        },
      });
      onCreated(project.id);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  const unpriced = preview ? preview.sections.reduce((n, s) => n + s.items.filter((i) => i.rate === 0).length, 0) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div><button onClick={onCancel} style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)' }}>← Back</button></div>
      <h1 style={{ margin: 0 }}>New project from a won tender</h1>
      <ol style={{ margin: 0, paddingLeft: 'var(--space-5)', color: 'var(--color-aggregate)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <li>In the tender dashboard, open the tender's documents and download its <strong>BOQ_Pricing.xlsx</strong> (the one with the rates you bid).</li>
        <li>Upload it here and check the BOQ.</li>
        <li>Fill in the dates and create the project. You'll be its Company Owner; add your team under Admin.</li>
      </ol>

      <label className="ticket" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'flex-start', cursor: 'pointer', padding: 'var(--space-4)' }}>
        <span style={{ fontWeight: 600 }}>{reading ? 'Reading…' : preview ? `Loaded ${fileName}. Choose another file` : 'Choose the BOQ file (.xlsx)'}</span>
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={readFile} disabled={reading} />
      </label>
      <ErrorBox message={error} />

      {preview && (
        <>
          <div className="ticket ticket--accent-survey" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <p style={{ margin: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>{preview.title || 'Untitled BOQ'}</p>
            <p className="numeric" style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)' }}>
              {[preview.tender_ref && `NIT ${preview.tender_ref}`, preview.bidder && `bidder ${preview.bidder}`].filter(Boolean).join(' · ')}
            </p>
            <p className="numeric" style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
              Nu. {money(preview.total)}
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400, color: 'var(--color-aggregate)' }}>
                {' '}· {preview.item_count} lines in {preview.sections.length} section{preview.sections.length === 1 ? '' : 's'}
                {preview.gst_registered ? ' · before 5% GST' : ''}
              </span>
            </p>
          </div>

          {preview.warnings.length > 0 && (
            <div className="ticket ticket--accent-brick" style={{ padding: 'var(--space-4)' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {unpriced > 0 ? `${unpriced} line${unpriced === 1 ? ' has' : 's have'} no rate` : 'Check these lines'}
              </p>
              <p style={{ margin: '4px 0 var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)' }}>
                They'll be created at Nu. 0, which understates the budget. Better: enter the rates you bid in the spreadsheet and upload it again.
              </p>
              <ul style={{ margin: 0, paddingLeft: 'var(--space-5)', fontSize: 'var(--text-sm)' }}>
                {preview.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="ledger-header" style={{ margin: 'var(--space-2) 0 0' }}><h3>BOQ</h3><span className="ledger-header-note">Tap a section to see its lines</span></div>
          {preview.sections.map((s) => <SectionPreview key={s.name} section={s} />)}

          <div className="ledger-header" style={{ margin: 'var(--space-2) 0 0' }}><h3>Project</h3></div>
          <Field label="Project name *"><input value={form.name} onChange={set('name')} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
            <Field label="Location"><input value={form.location} onChange={set('location')} placeholder="e.g. Bukay, Samtse" /></Field>
            <Field label="Tender / NIT no."><input value={form.tender_ref} onChange={set('tender_ref')} /></Field>
            <Field label="Start date"><input type="date" value={form.start_date} onChange={set('start_date')} /></Field>
            <Field label="Target completion"><input type="date" value={form.target_end_date} min={form.start_date || undefined} onChange={set('target_end_date')} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button className="primary" disabled={creating || !form.name.trim()} onClick={create}>
              {creating ? 'Creating…' : `Create project (Nu. ${money(preview.total)})`}
            </button>
            <button onClick={onCancel}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
