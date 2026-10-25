import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../lib/apiClient';
import { bhutanToday } from '../lib/today';

// Status values come from purchase_orders.status.
const STATUS = {
  draft: { label: 'Draft', color: 'var(--color-aggregate)' },
  issued: { label: 'Issued', color: 'var(--color-primary-deep)' },
  partially_received: { label: 'Part received', color: 'var(--color-primary-deep)' },
  received: { label: 'Received', color: 'var(--color-survey-deep)' },
  cancelled: { label: 'Cancelled', color: 'var(--color-brick)' },
};
const OPEN = new Set(['issued', 'partially_received']);

function money(n) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n ?? 0);
}
function qty(n) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(n ?? 0);
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

// ---------------------------------------------------------------- list

function OrderList({ orders, canManage, onOpen, onNew }) {
  const open = orders.filter((o) => OPEN.has(o.status));
  const openValue = open.reduce((t, o) => t + (o.total_amount - o.received_amount), 0);
  const overdue = orders.filter((o) => o.delivery_overdue).length;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Purchasing</h1>
        {canManage && <button className="primary" onClick={onNew}>New purchase order</button>}
      </div>
      <p style={{ color: 'var(--color-aggregate)', margin: 'var(--space-2) 0 var(--space-5)' }}>
        {open.length} open order{open.length === 1 ? '' : 's'} · Nu. {money(openValue)} still to be delivered
        {overdue > 0 && <span style={{ color: 'var(--color-brick)', fontWeight: 600 }}> · {overdue} delivery overdue</span>}
      </p>

      {orders.length === 0 && (
        <div className="ticket"><p style={{ margin: 0, color: 'var(--color-aggregate)' }}>No purchase orders yet.</p></div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {orders.map((o) => (
          <button key={o.po_id} className="ticket" onClick={() => onOpen(o.po_id)}
            style={{ textAlign: 'left', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'flex-start', width: '100%' }}>
              <div style={{ minWidth: 0 }}>
                <p className="numeric" style={{ margin: 0, fontWeight: 700 }}>{o.po_number}</p>
                <p style={{ margin: '2px 0 0', color: 'var(--color-aggregate)', fontWeight: 400, overflowWrap: 'anywhere' }}>{o.supplier_name}</p>
              </div>
              <StatusPill status={o.status} />
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--color-aggregate-faint)', overflow: 'hidden', width: '100%' }}>
              <div style={{ width: `${Math.min(100, o.pct_received)}%`, height: '100%', background: 'var(--color-survey)' }} />
            </div>
            <p className="numeric" style={{ margin: 0, fontSize: 'var(--text-xs)', fontWeight: 400,
              color: o.delivery_overdue ? 'var(--color-brick)' : 'var(--color-aggregate)' }}>
              Nu. {money(o.total_amount)} · {o.pct_received}% received
              {o.expected_date && ` · due ${formatDate(o.expected_date)}`}{o.delivery_overdue && ' (overdue)'}
            </p>
          </button>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- new PO

function NewSupplierForm({ onAdded, onCancel }) {
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', tpn: '', address: '' });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]));
      onAdded(await apiFetch('/api/purchasing/suppliers', { method: 'POST', body }));
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="ticket ticket--sunken" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
        <Field label="Supplier name *"><input value={form.name} onChange={set('name')} /></Field>
        <Field label="Contact person"><input value={form.contact_person} onChange={set('contact_person')} /></Field>
        <Field label="Phone"><input value={form.phone} onChange={set('phone')} inputMode="tel" /></Field>
        <Field label="TPN"><input value={form.tpn} onChange={set('tpn')} /></Field>
      </div>
      <Field label="Address"><input value={form.address} onChange={set('address')} /></Field>
      <ErrorBox message={error} />
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button className="primary" disabled={saving || !form.name.trim()} onClick={save}>Add supplier</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

const EMPTY_LINE = { description: '', unit: '', quantity: '', rate: '', boq_item_id: '' };

function NewOrderForm({ projectId, onCreated, onCancel }) {
  const [suppliers, setSuppliers] = useState([]);
  const [boqItems, setBoqItems] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [expectedDate, setExpectedDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/api/purchasing/suppliers').then(setSuppliers).catch((err) => setError(err.message));
    apiFetch('/api/schedule', { params: { project_id: projectId } }).then(setBoqItems).catch(() => setBoqItems([]));
  }, [projectId]);

  const setLine = (i, k) => (e) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: e.target.value } : l)));
  const total = lines.reduce((t, l) => t + (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0), 0);
  const complete = supplierId && lines.every((l) => l.description.trim() && l.unit.trim() && parseFloat(l.quantity) > 0 && parseFloat(l.rate) >= 0);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const order = await apiFetch('/api/purchasing/orders', {
        method: 'POST',
        body: {
          project_id: projectId,
          supplier_id: supplierId,
          expected_date: expectedDate || null,
          delivery_address: deliveryAddress.trim() || null,
          notes: notes.trim() || null,
          lines: lines.map((l) => ({
            description: l.description.trim(), unit: l.unit.trim(),
            quantity: parseFloat(l.quantity), rate: parseFloat(l.rate),
            boq_item_id: l.boq_item_id || null,
          })),
        },
      });
      onCreated(order.po_id);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div><button onClick={onCancel} style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)' }}>← All orders</button></div>
      <h1 style={{ margin: 0 }}>New purchase order</h1>
      <p style={{ margin: 0, color: 'var(--color-aggregate)' }}>Saved as a draft. You can check it and download the PDF before issuing it to the supplier.</p>

      <div className="ledger-header" style={{ margin: 'var(--space-2) 0 0' }}><h3>Supplier</h3></div>
      {addingSupplier ? (
        <NewSupplierForm
          onCancel={() => setAddingSupplier(false)}
          onAdded={(s) => { setSuppliers([...suppliers, s].sort((a, b) => a.name.localeCompare(b.name))); setSupplierId(s.id); setAddingSupplier(false); }}
        />
      ) : (
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px' }}>
            <Field label="Supplier *">
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Choose a supplier…</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <button onClick={() => setAddingSupplier(true)}>+ New supplier</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
        <Field label="Deliver by"><input type="date" value={expectedDate} min={bhutanToday()} onChange={(e) => setExpectedDate(e.target.value)} /></Field>
        <Field label="Delivery address"><input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Defaults to the project location" /></Field>
      </div>

      <div className="ledger-header" style={{ margin: 'var(--space-2) 0 0' }}>
        <h3>Items</h3>
        <span className="ledger-header-note numeric">Total Nu. {money(total)}</span>
      </div>
      {lines.map((l, i) => (
        <div key={i} className="ticket ticket--sunken" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3)' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label={`Item ${i + 1} *`}><input value={l.description} onChange={setLine(i, 'description')} placeholder="e.g. OPC cement 50 kg" /></Field>
            </div>
            <Field label="Unit *"><input value={l.unit} onChange={setLine(i, 'unit')} placeholder="bag" /></Field>
            <Field label="Quantity *"><input type="number" min="0" step="any" inputMode="decimal" value={l.quantity} onChange={setLine(i, 'quantity')} /></Field>
            <Field label="Rate (Nu.) *"><input type="number" min="0" step="any" inputMode="decimal" value={l.rate} onChange={setLine(i, 'rate')} /></Field>
            <Field label="For BOQ item">
              <select value={l.boq_item_id} onChange={setLine(i, 'boq_item_id')}>
                <option value="">— none —</option>
                {boqItems.map((b) => <option key={b.boq_item_id} value={b.boq_item_id}>{b.section_name}: {b.description}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="numeric" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)' }}>
              Amount Nu. {money((parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0))}
            </span>
            {lines.length > 1 && (
              <button onClick={() => setLines(lines.filter((_, j) => j !== i))} style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)' }}>Remove</button>
            )}
          </div>
        </div>
      ))}
      <div><button onClick={() => setLines([...lines, { ...EMPTY_LINE }])}>+ Add item</button></div>

      <Field label="Notes for the supplier"><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <ErrorBox message={error} />
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <button className="primary" disabled={saving || !complete} onClick={save}>Save draft</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- detail

function DeliveryForm({ lines, poId, onSaved, onCancel }) {
  const open = lines.filter((l) => l.pending_qty > 0);
  const [date, setDate] = useState(bhutanToday());
  const [noteNo, setNoteNo] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [notes, setNotes] = useState('');
  const [entries, setEntries] = useState(() => Object.fromEntries(open.map((l) => [l.po_line_id, { received: '', rejected: '', remarks: '' }])));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (id, k) => (e) => setEntries({ ...entries, [id]: { ...entries[id], [k]: e.target.value } });

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/purchasing/orders/${poId}/receipts`, {
        method: 'POST',
        body: {
          received_date: date,
          delivery_note_no: noteNo.trim() || null,
          vehicle_no: vehicle.trim() || null,
          notes: notes.trim() || null,
          lines: open.map((l) => ({
            po_line_id: l.po_line_id,
            quantity_received: parseFloat(entries[l.po_line_id].received) || 0,
            quantity_rejected: parseFloat(entries[l.po_line_id].rejected) || 0,
            remarks: entries[l.po_line_id].remarks.trim() || null,
          })),
        },
      });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="ticket ticket--accent-safety" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
      <h3 style={{ margin: 0 }}>Record a delivery</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3)' }}>
        <Field label="Received on"><input type="date" value={date} max={bhutanToday()} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Delivery note no."><input value={noteNo} onChange={(e) => setNoteNo(e.target.value)} /></Field>
        <Field label="Vehicle no."><input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="BP-1-A1234" /></Field>
      </div>
      {open.map((l) => (
        <div key={l.po_line_id} style={{ borderTop: '1px solid var(--color-aggregate-faint)', paddingTop: 'var(--space-3)' }}>
          <p style={{ margin: '0 0 var(--space-2)', fontWeight: 600 }}>
            {l.description} <span className="numeric" style={{ fontWeight: 400, color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>· {qty(l.pending_qty)} {l.unit} still to come</span>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-3)' }}>
            <Field label={`Accepted (${l.unit})`}>
              <input type="number" min="0" max={l.pending_qty} step="any" inputMode="decimal" value={entries[l.po_line_id].received} onChange={set(l.po_line_id, 'received')} />
            </Field>
            <Field label={`Rejected (${l.unit})`}>
              <input type="number" min="0" step="any" inputMode="decimal" value={entries[l.po_line_id].rejected} onChange={set(l.po_line_id, 'rejected')} />
            </Field>
            <Field label="Remarks"><input value={entries[l.po_line_id].remarks} onChange={set(l.po_line_id, 'remarks')} placeholder="e.g. 5 bags torn" /></Field>
          </div>
        </div>
      ))}
      <Field label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <ErrorBox message={error} />
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <button className="primary" disabled={saving} onClick={save}>Save delivery</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function OrderDetail({ poId, canManage, canReceive, onBack, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(() => {
    apiFetch(`/api/purchasing/orders/${poId}`).then(setDetail).catch((err) => setError(err.message));
  }, [poId]);
  useEffect(() => { load(); }, [load]);

  async function act(path, body) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/purchasing/orders/${poId}/${path}`, { method: 'POST', body });
      setCancelling(false);
      load();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf() {
    try {
      const blob = await apiFetch(`/api/purchasing/orders/${poId}/pdf`, { raw: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${detail.order.po_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!detail) {
    return error ? <ErrorBox message={error} /> : <p style={{ color: 'var(--color-aggregate)' }}>Loading order…</p>;
  }
  const { order, lines, receipts } = detail;
  const lineName = Object.fromEntries(lines.map((l) => [l.po_line_id, l]));
  const canCancel = canManage && (order.status === 'draft' || (order.status === 'issued' && order.receipt_count === 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div><button onClick={onBack} style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)' }}>← All orders</button></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="numeric" style={{ margin: 0 }}>{order.po_number}</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-aggregate)' }}>
            {order.supplier_name}{order.supplier_phone ? ` · ${order.supplier_phone}` : ''}
          </p>
        </div>
        <StatusPill status={order.status} />
      </div>
      <p className="numeric" style={{ margin: 0, fontSize: 'var(--text-sm)', color: order.delivery_overdue ? 'var(--color-brick)' : 'var(--color-aggregate)' }}>
        Ordered {formatDate(order.order_date)} · deliver by {formatDate(order.expected_date)}{order.delivery_overdue ? ' (overdue)' : ''}
        {' '}· Nu. {money(order.total_amount)} · {order.pct_received}% received
      </p>
      {order.cancel_reason && <p style={{ margin: 0, color: 'var(--color-brick)' }}>Cancelled: {order.cancel_reason}</p>}

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <button onClick={downloadPdf}>Download PDF</button>
        {canManage && order.status === 'draft' && (
          <button className="primary" disabled={busy} onClick={() => act('issue')}>Issue to supplier</button>
        )}
        {canReceive && OPEN.has(order.status) && !receiving && (
          <button className="primary" onClick={() => setReceiving(true)}>Record delivery</button>
        )}
        {canCancel && !cancelling && <button disabled={busy} onClick={() => setCancelling(true)}>Cancel order</button>}
      </div>
      {cancelling && (
        <div className="ticket ticket--sunken" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', flexWrap: 'wrap', padding: 'var(--space-4)' }}>
          <div style={{ flex: '1 1 220px' }}><Field label="Reason for cancelling *"><input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} /></Field></div>
          <button disabled={busy || !cancelReason.trim()} onClick={() => act('cancel', { reason: cancelReason.trim() })}>Cancel order</button>
          <button onClick={() => setCancelling(false)}>Keep it</button>
        </div>
      )}
      <ErrorBox message={error} />

      {receiving && (
        <DeliveryForm lines={lines} poId={poId} onCancel={() => setReceiving(false)}
          onSaved={() => { setReceiving(false); load(); onChanged(); }} />
      )}

      <div className="ledger-header" style={{ margin: 'var(--space-2) 0 0' }}><h3>Items</h3></div>
      {lines.map((l) => (
        <div key={l.po_line_id} className="ticket" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <p style={{ margin: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>{l.line_no}. {l.description}</p>
            <span className="numeric" style={{ whiteSpace: 'nowrap' }}>Nu. {money(l.amount)}</span>
          </div>
          {l.boq_description && <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-aggregate)' }}>BOQ: {l.boq_description}</p>}
          <p className="numeric" style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)' }}>
            {qty(l.ordered_qty)} {l.unit} × Nu. {money(l.rate)} · received {qty(l.received_qty)}
            {l.rejected_qty > 0 && `, rejected ${qty(l.rejected_qty)}`}
            {l.pending_qty > 0 && order.status !== 'cancelled' ? ` · ${qty(l.pending_qty)} to come` : ''}
          </p>
        </div>
      ))}

      {receipts.length > 0 && (
        <>
          <div className="ledger-header" style={{ margin: 'var(--space-2) 0 0' }}><h3>Deliveries</h3></div>
          {receipts.map((r) => (
            <div key={r.id} className="ticket ticket--sunken" style={{ padding: 'var(--space-4)' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {formatDate(r.received_date)}
                <span style={{ fontWeight: 400, color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>
                  {[r.delivery_note_no && ` · DN ${r.delivery_note_no}`, r.vehicle_no && ` · ${r.vehicle_no}`, r.received_by_name && ` · by ${r.received_by_name}`].filter(Boolean).join('')}
                </span>
              </p>
              <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-5)', fontSize: 'var(--text-sm)' }}>
                {r.lines.map((rl) => (
                  <li key={rl.po_line_id} className="numeric">
                    {lineName[rl.po_line_id]?.description}: {qty(rl.quantity_received)} {lineName[rl.po_line_id]?.unit} accepted
                    {rl.quantity_rejected > 0 && `, ${qty(rl.quantity_rejected)} rejected`}{rl.remarks && ` (${rl.remarks})`}
                  </li>
                ))}
              </ul>
              {r.notes && <p style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)' }}>{r.notes}</p>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- page

export function PurchasingPage({ projectId, canManage, canReceive }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState({ name: 'list' });

  const load = useCallback(() => {
    apiFetch('/api/purchasing/orders', { params: { project_id: projectId } })
      .then(setOrders)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--space-6) var(--space-5)' }}>
      {view.name === 'list' && (
        <>
          {loading && <p style={{ color: 'var(--color-aggregate)' }}>Loading purchase orders…</p>}
          <ErrorBox message={error} />
          {!loading && !error && (
            <OrderList orders={orders} canManage={canManage}
              onOpen={(id) => setView({ name: 'detail', id })} onNew={() => setView({ name: 'new' })} />
          )}
        </>
      )}
      {view.name === 'new' && (
        <NewOrderForm projectId={projectId} onCancel={() => setView({ name: 'list' })}
          onCreated={(id) => { load(); setView({ name: 'detail', id }); }} />
      )}
      {view.name === 'detail' && (
        <OrderDetail poId={view.id} canManage={canManage} canReceive={canReceive}
          onBack={() => setView({ name: 'list' })} onChanged={load} />
      )}
    </div>
  );
}
