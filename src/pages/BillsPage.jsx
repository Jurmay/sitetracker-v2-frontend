import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../lib/apiClient';
import { bhutanToday } from '../lib/today';

// Client running bills (RA bills). Amounts are worked out by the
// database from the quantities and the project's billing terms; this
// page only shows them and sends quantities, certificates and payments.

// Status values come from client_bills.status.
const STATUS = {
  draft: { label: 'Draft', color: 'var(--color-aggregate)' },
  submitted: { label: 'With client', color: 'var(--color-primary-deep)' },
  certified: { label: 'Certified', color: 'var(--color-primary-deep)' },
  paid: { label: 'Paid', color: 'var(--color-survey-deep)' },
  cancelled: { label: 'Cancelled', color: 'var(--color-brick)' },
};

function money(n) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0);
}
function qty(n) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(n ?? 0);
}
function pct(n) {
  return `${Number(n ?? 0)}%`;
}
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function StatusPill({ status }) {
  const s = STATUS[status] ?? STATUS.draft;
  return (
    <span style={{
      display: 'inline-block', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap',
      color: s.color, border: `1.5px solid ${s.color}`,
    }}>
      {s.label}
    </span>
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

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-sm)', minWidth: 0 }}>
      {label}
      {children}
    </label>
  );
}

function SumRow({ label, value, strong, minus }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', fontWeight: strong ? 700 : 400 }}>
      <span>{label}</span>
      <span className="numeric" style={{ whiteSpace: 'nowrap' }}>{minus ? `(${money(value)})` : money(value)}</span>
    </div>
  );
}

// ---------------------------------------------------------------- list

function BillList({ bills, canManage, onOpen, onNew, onTerms }) {
  const live = bills.filter((b) => b.status !== 'cancelled' && b.status !== 'draft');
  const billed = live.reduce((t, b) => t + b.gross_amount, 0);
  const received = live.reduce((t, b) => t + b.paid_amount, 0);
  const due = live.reduce((t, b) => t + (b.balance_due ?? 0), 0);
  const waiting = bills.filter((b) => b.status === 'submitted').length;
  const hasDraft = bills.some((b) => b.status === 'draft');

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Client bills</h1>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {canManage && <button onClick={onTerms}>Billing terms</button>}
          {canManage && !hasDraft && <button className="primary" onClick={onNew}>New running bill</button>}
        </div>
      </div>
      <p className="numeric" style={{ color: 'var(--color-aggregate)', margin: 'var(--space-2) 0 var(--space-5)' }}>
        Billed Nu. {money(billed)} · received Nu. {money(received)}
        {due > 0 && <span style={{ color: 'var(--color-primary-deep)', fontWeight: 600 }}> · Nu. {money(due)} due from client</span>}
        {waiting > 0 && ` · ${waiting} waiting for certificate`}
      </p>

      {bills.length === 0 && (
        <div className="ticket"><p style={{ margin: 0, color: 'var(--color-aggregate)' }}>No bills yet. Start RA-01 when there is measured work to bill.</p></div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {bills.map((b) => (
          <button key={b.bill_id} className="ticket" onClick={() => onOpen(b.bill_id)}
            style={{ textAlign: 'left', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'flex-start', width: '100%' }}>
              <div style={{ minWidth: 0 }}>
                <p className="numeric" style={{ margin: 0, fontWeight: 700 }}>{b.bill_ref}{b.is_final ? ' (final)' : ''}</p>
                <p style={{ margin: '2px 0 0', color: 'var(--color-aggregate)', fontWeight: 400 }}>Work up to {formatDate(b.period_to)}</p>
              </div>
              <StatusPill status={b.status} />
            </div>
            <p className="numeric" style={{ margin: 0, fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--color-aggregate)' }}>
              Value Nu. {money(b.gross_amount)} · net Nu. {money(b.net_amount)}
              {b.certified_amount != null && ` · certified Nu. ${money(b.certified_amount)}`}
              {b.balance_due > 0 && ` · Nu. ${money(b.balance_due)} due`}
            </p>
          </button>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- terms

function TermsForm({ projectId, onDone }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/api/billing/terms', { params: { project_id: projectId } })
      .then((t) => setForm(Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v ?? '']))))
      .catch((err) => setError(err.message));
  }, [projectId]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setSaving(true);
    setError(null);
    const num = (v) => Number(v || 0);
    try {
      await apiFetch(`/api/billing/terms?project_id=${encodeURIComponent(projectId)}`, {
        method: 'PUT',
        body: {
          client_name: form.client_name.trim() || null,
          client_address: form.client_address.trim() || null,
          retention_pct: num(form.retention_pct),
          retention_limit_pct: form.retention_limit_pct === '' ? null : num(form.retention_limit_pct),
          tds_pct: num(form.tds_pct),
          mobilisation_advance: num(form.mobilisation_advance),
          advance_recovery_pct: num(form.advance_recovery_pct),
        },
      });
      onDone();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (!form) return error ? <ErrorBox message={error} /> : <p style={{ color: 'var(--color-aggregate)' }}>Loading terms…</p>;
  const numberInput = (k, props = {}) => (
    <input type="number" min="0" step="any" inputMode="decimal" value={form[k]} onChange={set(k)} {...props} />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div><button onClick={onDone} style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)' }}>← All bills</button></div>
      <h1 style={{ margin: 0 }}>Billing terms</h1>
      <p style={{ margin: 0, color: 'var(--color-aggregate)' }}>
        From the contract. Used for draft and new bills; bills already submitted keep their amounts.
        BOQ rates already include GST, so no GST is added.
      </p>
      <div className="ticket" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
          <Field label="Client (employer)"><input value={form.client_name} onChange={set('client_name')} placeholder="e.g. Regional Office DoST" /></Field>
          <Field label="Client address"><input value={form.client_address} onChange={set('client_address')} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3)' }}>
          <Field label="Retention (% of each bill)">{numberInput('retention_pct', { max: 100 })}</Field>
          <Field label="Retention limit (% of contract, optional)">{numberInput('retention_limit_pct', { max: 100, placeholder: 'no limit' })}</Field>
          <Field label="TDS (%)">{numberInput('tds_pct', { max: 100 })}</Field>
          <Field label="Mobilisation advance received (Nu.)">{numberInput('mobilisation_advance')}</Field>
          <Field label="Advance recovery (% of each bill)">{numberInput('advance_recovery_pct', { max: 100 })}</Field>
        </div>
        <ErrorBox message={error} />
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="primary" disabled={saving} onClick={save}>Save terms</button>
          <button onClick={onDone}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- new bill

function NewBillForm({ projectId, onCreated, onCancel }) {
  const today = bhutanToday();
  const [periodTo, setPeriodTo] = useState(today);
  const [billDate, setBillDate] = useState(today);
  const [prefill, setPrefill] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function create() {
    setSaving(true);
    setError(null);
    try {
      const bill = await apiFetch('/api/billing/bills', {
        method: 'POST', body: { project_id: projectId, period_to: periodTo, bill_date: billDate, prefill },
      });
      onCreated(bill.bill_id);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div><button onClick={onCancel} style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)' }}>← All bills</button></div>
      <h1 style={{ margin: 0 }}>New running bill</h1>
      <div className="ticket" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
          <Field label="Work measured up to"><input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} /></Field>
          <Field label="Bill date"><input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} /></Field>
        </div>
        <label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
          <input type="checkbox" checked={prefill} onChange={(e) => setPrefill(e.target.checked)} style={{ width: 'auto', flexShrink: 0 }} />
          Fill in quantities from site progress not billed yet (you can change them)
        </label>
        <ErrorBox message={error} />
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="primary" disabled={saving} onClick={create}>Start bill</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- detail

function QuantityEditor({ billId, sheet, onSaved }) {
  const [values, setValues] = useState(() => Object.fromEntries(sheet.map((r) => [r.boq_item_id, r.this_quantity ? String(r.this_quantity) : ''])));
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const changed = sheet.filter((r) => Number(values[r.boq_item_id] || 0) !== Number(r.this_quantity));
  const rows = showAll ? sheet : sheet.filter((r) =>
    r.this_quantity > 0 || r.measured_quantity > r.previous_quantity || values[r.boq_item_id] !== (r.this_quantity ? String(r.this_quantity) : ''));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/billing/bills/${billId}/lines`, {
        method: 'PUT',
        body: { lines: changed.map((r) => ({ boq_item_id: r.boq_item_id, quantity: Number(values[r.boq_item_id] || 0) })) },
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  let lastSection = null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)' }}>
          {showAll ? `All ${sheet.length} BOQ items` : 'Items with work to bill'} · enter the quantity for this bill
        </p>
        <button onClick={() => setShowAll(!showAll)} style={{ padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)' }}>
          {showAll ? 'Only items with work' : 'Show all BOQ items'}
        </button>
      </div>
      {rows.length === 0 && (
        <div className="ticket"><p style={{ margin: 0, color: 'var(--color-aggregate)' }}>No measured work left to bill. Use “Show all BOQ items” to bill something else.</p></div>
      )}
      {rows.map((r) => {
        const header = r.section_name !== lastSection ? r.section_name : null;
        lastSection = r.section_name;
        const left = r.boq_quantity - r.previous_quantity;
        return (
          <div key={r.boq_item_id}>
            {header && <p style={{ margin: 'var(--space-3) 0 var(--space-2)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>{header}</p>}
            <div className="ticket" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.description}</p>
              <p className="numeric" style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-aggregate)' }}>
                BOQ {qty(r.boq_quantity)} {r.unit} @ Nu. {money(r.rate)} · billed before {qty(r.previous_quantity)} · measured {qty(r.measured_quantity)}
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 1 160px' }}>
                  <Field label={`This bill (${r.unit})`}>
                    <input type="number" min="0" max={left} step="any" inputMode="decimal" value={values[r.boq_item_id]}
                      onChange={(e) => setValues({ ...values, [r.boq_item_id]: e.target.value })} />
                  </Field>
                </div>
                <span className="numeric" style={{ fontSize: 'var(--text-sm)', paddingBottom: 'var(--space-2)' }}>
                  Nu. {money(Number(values[r.boq_item_id] || 0) * r.rate)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      <ErrorBox message={error} />
      {changed.length > 0 && (
        <div style={{ position: 'sticky', bottom: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)' }}>
          <button className="primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : `Save ${changed.length} change${changed.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
    </div>
  );
}

function BillDetail({ billId, canManage, canPay, onBack, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState(null);  // 'certify' | 'cancel' | 'pay' | 'deduction'
  const [form, setForm] = useState({});

  const load = useCallback(() => {
    apiFetch(`/api/billing/bills/${billId}`).then(setDetail).catch((err) => setError(err.message));
  }, [billId]);
  useEffect(() => { load(); }, [load]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function call(path, { method = 'POST', body } = {}) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/billing/bills/${billId}${path}`, { method, body });
      setPanel(null);
      setForm({});
      load();
      onChanged();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete draft ${detail.bill.bill_ref}?`)) return;
    if (await call('', { method: 'DELETE' })) onBack();
  }

  async function downloadPdf() {
    try {
      const blob = await apiFetch(`/api/billing/bills/${billId}/pdf`, { raw: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${detail.bill.bill_ref}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!detail) {
    return error ? <ErrorBox message={error} /> : <p style={{ color: 'var(--color-aggregate)' }}>Loading bill…</p>;
  }
  const { bill, sheet, deductions, payments } = detail;
  const draft = bill.status === 'draft';
  const billed = sheet.filter((r) => r.this_quantity > 0);
  const open = (name, initial = {}) => { setPanel(name); setForm(initial); setError(null); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div><button onClick={onBack} style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)' }}>← All bills</button></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="numeric" style={{ margin: 0 }}>{bill.bill_ref}{bill.is_final ? ' (final)' : ''}</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-aggregate)' }}>
            Work up to {formatDate(bill.period_to)} · bill date {formatDate(bill.bill_date)}
            {bill.certificate_ref && ` · certificate ${bill.certificate_ref}`}
          </p>
        </div>
        <StatusPill status={bill.status} />
      </div>
      {bill.cancel_reason && <p style={{ margin: 0, color: 'var(--color-brick)' }}>Cancelled: {bill.cancel_reason}</p>}

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <button onClick={downloadPdf}>Download PDF</button>
        {canManage && draft && <button className="primary" disabled={busy || bill.gross_amount <= 0} onClick={() => call('/submit')}>Submit to client</button>}
        {canManage && draft && <button disabled={busy} onClick={remove}>Delete draft</button>}
        {canManage && bill.status === 'submitted' && (
          <button className="primary" onClick={() => open('certify', { certified_amount: String(bill.net_amount), certified_date: bhutanToday(), certificate_ref: '' })}>Record certificate</button>
        )}
        {canManage && bill.status === 'submitted' && <button disabled={busy} onClick={() => call('/recall')}>Recall to draft</button>}
        {canManage && bill.status === 'submitted' && <button onClick={() => open('cancel', { reason: '' })}>Cancel bill</button>}
        {canPay && bill.status === 'certified' && (
          <button className="primary" onClick={() => open('pay', { amount: String(bill.balance_due), received_date: bhutanToday(), reference: '' })}>Record payment</button>
        )}
      </div>

      {panel === 'certify' && (
        <div className="ticket ticket--accent-safety" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
          <h3 style={{ margin: 0 }}>Client's certificate</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3)' }}>
            <Field label="Amount certified for payment (Nu.)"><input type="number" min="0" step="any" inputMode="decimal" value={form.certified_amount} onChange={set('certified_amount')} /></Field>
            <Field label="Certificate date"><input type="date" max={bhutanToday()} value={form.certified_date} onChange={set('certified_date')} /></Field>
            <Field label="Certificate / MB no."><input value={form.certificate_ref} onChange={set('certificate_ref')} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="primary" disabled={busy || !(Number(form.certified_amount) > 0)} onClick={() => call('/certify', {
              body: { certified_amount: Number(form.certified_amount), certified_date: form.certified_date || null, certificate_ref: form.certificate_ref.trim() || null },
            })}>Save certificate</button>
            <button onClick={() => setPanel(null)}>Cancel</button>
          </div>
        </div>
      )}
      {panel === 'cancel' && (
        <div className="ticket ticket--sunken" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', flexWrap: 'wrap', padding: 'var(--space-4)' }}>
          <div style={{ flex: '1 1 220px' }}><Field label="Reason for cancelling *"><input value={form.reason} onChange={set('reason')} /></Field></div>
          <button disabled={busy || !form.reason.trim()} onClick={() => call('/cancel', { body: { reason: form.reason.trim() } })}>Cancel bill</button>
          <button onClick={() => setPanel(null)}>Keep it</button>
        </div>
      )}
      {panel === 'pay' && (
        <div className="ticket ticket--accent-safety" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
          <h3 style={{ margin: 0 }}>Payment received from client</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3)' }}>
            <Field label="Amount (Nu.)"><input type="number" min="0" step="any" inputMode="decimal" value={form.amount} onChange={set('amount')} /></Field>
            <Field label="Received on"><input type="date" max={bhutanToday()} value={form.received_date} onChange={set('received_date')} /></Field>
            <Field label="Cheque / transfer no."><input value={form.reference} onChange={set('reference')} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="primary" disabled={busy || !(Number(form.amount) > 0)} onClick={() => call('/payments', {
              body: { amount: Number(form.amount), received_date: form.received_date || null, reference: form.reference.trim() || null },
            })}>Save payment</button>
            <button onClick={() => setPanel(null)}>Cancel</button>
          </div>
        </div>
      )}
      <ErrorBox message={error} />

      <div className="ticket" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
        <SumRow label="Value of work this bill" value={bill.gross_amount} strong />
        {bill.retention_amount > 0 && <SumRow label={`Retention @ ${pct(bill.retention_pct)}`} value={bill.retention_amount} minus />}
        {bill.tds_amount > 0 && <SumRow label={`TDS @ ${pct(bill.tds_pct)}`} value={bill.tds_amount} minus />}
        {bill.advance_recovery > 0 && <SumRow label="Mobilisation advance recovery" value={bill.advance_recovery} minus />}
        {deductions.map((d) => (
          <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'center' }}>
            <span>
              {d.description}
              {canManage && draft && (
                <button onClick={() => call(`/deductions/${d.id}`, { method: 'DELETE' })} disabled={busy}
                  style={{ marginLeft: 'var(--space-2)', padding: '0 var(--space-2)', fontSize: 'var(--text-xs)' }}>Remove</button>
              )}
            </span>
            <span className="numeric">({money(d.amount)})</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--color-aggregate-light)', paddingTop: 'var(--space-2)' }}>
          <SumRow label="Net payable" value={bill.net_amount} strong />
        </div>
        {bill.certified_amount != null && <SumRow label={`Certified ${formatDate(bill.certified_date)}`} value={bill.certified_amount} />}
        {bill.paid_amount > 0 && <SumRow label="Received" value={bill.paid_amount} />}
        {bill.balance_due > 0 && <SumRow label="Still due" value={bill.balance_due} strong />}
        {canManage && draft && panel !== 'deduction' && (
          <div><button onClick={() => open('deduction', { description: '', amount: '' })} style={{ padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)' }}>Add other deduction</button></div>
        )}
        {panel === 'deduction' && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '2 1 180px' }}><Field label="Deduction"><input value={form.description} onChange={set('description')} placeholder="e.g. Liquidated damages" /></Field></div>
            <div style={{ flex: '1 1 110px' }}><Field label="Amount (Nu.)"><input type="number" min="0" step="any" inputMode="decimal" value={form.amount} onChange={set('amount')} /></Field></div>
            <button disabled={busy || !form.description.trim() || !(Number(form.amount) > 0)}
              onClick={() => call('/deductions', { body: { description: form.description.trim(), amount: Number(form.amount) } })}>Add</button>
            <button onClick={() => setPanel(null)}>Cancel</button>
          </div>
        )}
      </div>

      {canManage && draft && (
        <div className="ticket ticket--sunken" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3)' }}>
            <Field label="Work measured up to">
              <input type="date" defaultValue={bill.period_to} onBlur={(e) => e.target.value && e.target.value !== bill.period_to && call('', { method: 'PATCH', body: { period_to: e.target.value } })} />
            </Field>
            <Field label="Bill date">
              <input type="date" defaultValue={bill.bill_date} onBlur={(e) => e.target.value && e.target.value !== bill.bill_date && call('', { method: 'PATCH', body: { bill_date: e.target.value } })} />
            </Field>
          </div>
          <label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
            <input type="checkbox" checked={bill.is_final} disabled={busy} style={{ width: 'auto', flexShrink: 0 }} onChange={(e) => call('', { method: 'PATCH', body: { is_final: e.target.checked } })} />
            Final bill (recovers all mobilisation advance still outstanding)
          </label>
          <Field label="Notes (printed on the bill)">
            <textarea rows={2} defaultValue={bill.notes ?? ''} onBlur={(e) => e.target.value !== (bill.notes ?? '') && call('', { method: 'PATCH', body: { notes: e.target.value.trim() || null } })} />
          </Field>
        </div>
      )}

      <div className="ledger-header" style={{ margin: 'var(--space-2) 0 0' }}><h3>Items</h3></div>
      {canManage && draft ? (
        <QuantityEditor key={JSON.stringify(sheet.map((r) => r.this_quantity))} billId={billId} sheet={sheet} onSaved={() => { load(); onChanged(); }} />
      ) : (
        billed.map((r) => (
          <div key={r.boq_item_id} className="ticket" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.description}</p>
              <span className="numeric" style={{ whiteSpace: 'nowrap', fontSize: 'var(--text-sm)' }}>Nu. {money(r.this_amount)}</span>
            </div>
            <p className="numeric" style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-aggregate)' }}>
              {r.section_name} · {qty(r.this_quantity)} {r.unit} × Nu. {money(r.rate)} · to date {qty(r.cumulative_quantity)} of {qty(r.boq_quantity)}
            </p>
          </div>
        ))
      )}

      {payments.length > 0 && (
        <>
          <div className="ledger-header" style={{ margin: 'var(--space-2) 0 0' }}><h3>Payments received</h3></div>
          {payments.map((p) => (
            <div key={p.id} className="ticket ticket--sunken" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <span style={{ fontSize: 'var(--text-sm)' }}>
                {formatDate(p.received_date)}
                <span style={{ color: 'var(--color-aggregate)' }}>{p.reference && ` · ${p.reference}`}{p.recorded_by_name && ` · by ${p.recorded_by_name}`}</span>
              </span>
              <span className="numeric" style={{ whiteSpace: 'nowrap' }}>Nu. {money(p.amount)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- retention

const RELEASE_STATUS = {
  claimed: { label: 'Claimed', color: 'var(--color-primary-deep)' },
  received: { label: 'Received', color: 'var(--color-survey-deep)' },
  cancelled: { label: 'Cancelled', color: 'var(--color-brick)' },
};

// Retention the client deducted from certified bills, and claims to get
// it back (often half on completion, the rest after the defects period).
function Retention({ projectId, canManage, canPay, refreshKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState(null); // { kind: 'claim' } | { kind: 'received'|'cancel', id }
  const [form, setForm] = useState({});

  const load = useCallback(() => {
    apiFetch('/api/billing/retention', { params: { project_id: projectId } })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [projectId]);
  useEffect(() => { load(); }, [load, refreshKey]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function call(path, body, done) {
    setBusy(true); setError(null); setSuccess(null);
    try {
      setData(await apiFetch(path, { method: 'POST', body }));
      setSuccess(done); setPanel(null); setForm({});
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf(r) {
    try {
      const blob = await apiFetch(`/api/billing/retention/${r.id}/pdf`, { raw: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${r.release_ref}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!data) return error ? <ErrorBox message={error} /> : null;
  const { position, releases } = data;
  if (position.withheld <= 0 && releases.length === 0) return null;

  return (
    <section aria-labelledby="retention-title" style={{ marginTop: 'var(--space-6)' }}>
      <div className="ledger-header"><h3 id="retention-title">Retention</h3><span className="ledger-header-note">deducted by the client from certified bills</span></div>
      <div className="ticket" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
        <SumRow label="Deducted on certified bills" value={position.withheld} />
        <SumRow label="Received back" value={position.released} minus />
        <div style={{ borderTop: '1px solid var(--color-aggregate-light)', paddingTop: 'var(--space-2)' }}>
          <SumRow label="Still held by the client" value={position.held} strong />
        </div>
        {position.claimed_open > 0 && <SumRow label="Claimed, waiting for payment" value={position.claimed_open} />}
        <SumRow label="Can still be claimed" value={position.available} />
        {canManage && position.available > 0 && panel?.kind !== 'claim' && (
          <div><button className="primary" onClick={() => { setPanel({ kind: 'claim' }); setForm({ amount: String(position.available), stage: '', claim_date: bhutanToday() }); setSuccess(null); }}>Claim retention</button></div>
        )}
        {panel?.kind === 'claim' && (
          <div className="ticket ticket--accent-safety" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3)' }}>
              <Field label={`Amount (Nu., up to ${money(position.available)})`}><input type="number" min="0" max={position.available} step="any" inputMode="decimal" value={form.amount} onChange={set('amount')} /></Field>
              <Field label="Stage"><input value={form.stage} onChange={set('stage')} placeholder="e.g. Half on completion" /></Field>
              <Field label="Date of claim"><input type="date" max={bhutanToday()} value={form.claim_date} onChange={set('claim_date')} /></Field>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <button className="primary" disabled={busy || !(Number(form.amount) > 0)} onClick={() => call('/api/billing/retention', {
                project_id: projectId, amount: Number(form.amount), stage: form.stage.trim() || null, claim_date: form.claim_date || null,
              }, 'Retention claim made. Download the PDF to send to the client.')}>Make claim</button>
              <button onClick={() => setPanel(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      {success && <p role="status" style={{ color: 'var(--color-survey-deep)', fontWeight: 600 }}>{success}</p>}
      <ErrorBox message={error} />

      {releases.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
          {releases.map((r) => {
            const st = RELEASE_STATUS[r.status] ?? RELEASE_STATUS.claimed;
            const open = panel && panel.id === r.id ? panel.kind : null;
            return (
              <div key={r.id} className="ticket" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <p className="numeric" style={{ margin: 0, fontWeight: 700 }}>{r.release_ref} · Nu. {money(r.amount)}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)' }}>
                      {[r.stage, `claimed ${formatDate(r.claim_date)}`, r.received_date && `received ${formatDate(r.received_date)}`, r.received_reference].filter(Boolean).join(' · ')}
                    </p>
                    {r.cancel_reason && <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-brick)' }}>Cancelled: {r.cancel_reason}</p>}
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 4, color: st.color, border: `1.5px solid ${st.color}` }}>{st.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <button onClick={() => downloadPdf(r)} style={{ padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)' }}>Download PDF</button>
                  {canPay && r.status === 'claimed' && !open && (
                    <button className="primary" style={{ padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)' }}
                      onClick={() => { setPanel({ kind: 'received', id: r.id }); setForm({ received_date: bhutanToday(), reference: '' }); }}>Record as received</button>
                  )}
                  {canManage && r.status === 'claimed' && !open && (
                    <button style={{ padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)' }}
                      onClick={() => { setPanel({ kind: 'cancel', id: r.id }); setForm({ reason: '' }); }}>Cancel claim</button>
                  )}
                </div>
                {open === 'received' && (
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 140px' }}><Field label="Received on"><input type="date" max={bhutanToday()} value={form.received_date} onChange={set('received_date')} /></Field></div>
                    <div style={{ flex: '1 1 160px' }}><Field label="Cheque / transfer no."><input value={form.reference} onChange={set('reference')} /></Field></div>
                    <button className="primary" disabled={busy} onClick={() => call(`/api/billing/retention/${r.id}/received`, {
                      received_date: form.received_date || null, reference: form.reference.trim() || null,
                    }, `${r.release_ref} recorded as received.`)}>Save</button>
                    <button onClick={() => setPanel(null)}>Cancel</button>
                  </div>
                )}
                {open === 'cancel' && (
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 220px' }}><Field label="Reason for cancelling *"><input value={form.reason} onChange={set('reason')} /></Field></div>
                    <button disabled={busy || !form.reason.trim()} onClick={() => call(`/api/billing/retention/${r.id}/cancel`, { reason: form.reason.trim() }, `${r.release_ref} cancelled.`)}>Cancel claim</button>
                    <button onClick={() => setPanel(null)}>Keep it</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- page

export function BillsPage({ projectId, canManage, canPay }) {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState({ name: 'list' });

  const load = useCallback(() => {
    apiFetch('/api/billing/bills', { params: { project_id: projectId } })
      .then(setBills)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--space-6) var(--space-5)' }}>
      {view.name === 'list' && (
        <>
          {loading && <p style={{ color: 'var(--color-aggregate)' }}>Loading bills…</p>}
          <ErrorBox message={error} />
          {!loading && !error && (
            <BillList bills={bills} canManage={canManage}
              onOpen={(id) => setView({ name: 'detail', id })} onNew={() => setView({ name: 'new' })}
              onTerms={() => setView({ name: 'terms' })} />
          )}
          {!loading && !error && <Retention projectId={projectId} canManage={canManage} canPay={canPay} refreshKey={bills.length} />}
        </>
      )}
      {view.name === 'terms' && <TermsForm projectId={projectId} onDone={() => setView({ name: 'list' })} />}
      {view.name === 'new' && (
        <NewBillForm projectId={projectId} onCancel={() => setView({ name: 'list' })}
          onCreated={(id) => { load(); setView({ name: 'detail', id }); }} />
      )}
      {view.name === 'detail' && (
        <BillDetail billId={view.id} canManage={canManage} canPay={canPay}
          onBack={() => setView({ name: 'list' })} onChanged={load} />
      )}
    </div>
  );
}
