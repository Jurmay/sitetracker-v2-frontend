import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../lib/apiClient';
import { StatusStamp } from '../components/StatusStamp';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

// Improvement #4: helper to compute how much of an advance is already settled
// by totalling verified/settled settlements against it
function computeSettled(settlements, requisitionId) {
  return settlements
    .filter((s) => s.requisition_id === requisitionId && s.status !== 'rejected')
    .reduce((sum, s) => sum + (s.settled_amount ?? 0), 0);
}

async function uploadSettlementReceipt(projectId, file) {
  // Compress before upload (same pattern as labourer photos)
  const compressed = await new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > height && width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
        else if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
          'image/jpeg', 0.82
        );
      };
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });

  const path = `settlements/${projectId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from('site-photos')
    .upload(path, compressed, { contentType: 'image/jpeg' });
  if (error) throw new Error(`Receipt upload failed: ${error.message}`);
  const { data: urlData } = supabase.storage.from('site-photos').getPublicUrl(path);
  return urlData.publicUrl;
}

export function AdvancesPage({ projectId }) {
  const { user } = useAuth();
  const [boqItems, setBoqItems] = useState([]);
  const [subcontracts, setSubcontracts] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [settlements, setSettlements] = useState([]);

  const [category, setCategory] = useState('work_tied');
  const [boqItemId, setBoqItemId] = useState('');
  const [subcontractId, setSubcontractId] = useState('');
  const [amount, setAmount] = useState('');
  const [justification, setJustification] = useState('');

  const [settleRequisitionId, setSettleRequisitionId] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleReceiptFile, setSettleReceiptFile] = useState(null); // Improvement #4: receipt upload
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  function loadAll() {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      apiFetch('/api/boq/sections', { params: { project_id: projectId } }).then((sections) =>
        Promise.all(sections.map((s) => apiFetch('/api/boq/items', { params: { section_id: s.id } }))).then((lists) =>
          lists.flat()
        )
      ),
      apiFetch('/api/financial/subcontracts', { params: { project_id: projectId } }),
      apiFetch('/api/financial/advances', { params: { project_id: projectId } }),
      apiFetch('/api/financial/settlements', { params: { project_id: projectId } }),
    ])
      .then(([items, subs, advs, setts]) => {
        setBoqItems(items);
        setSubcontracts(subs);
        setAdvances(advs);
        setSettlements(setts);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [projectId, user?.id]);

  async function handleSubmitAdvance(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const payload = {
      project_id: projectId,
      advance_category: category,
      amount: parseFloat(amount),
      justification,
    };
    if (category === 'work_tied') payload.boq_item_id = boqItemId;
    if (category === 'subcontract') payload.subcontract_id = subcontractId;

    setSubmitting(true);
    try {
      await apiFetch('/api/financial/advances', { method: 'POST', body: payload });
      setSuccess('Advance requisition submitted for verification.');
      setAmount('');
      setJustification('');
      setBoqItemId('');
      setSubcontractId('');
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitSettlement(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      // Improvement #4: upload receipt first if one was selected
      let receiptUrl = null;
      if (settleReceiptFile) {
        setUploadingReceipt(true);
        try {
          receiptUrl = await uploadSettlementReceipt(projectId, settleReceiptFile);
        } finally {
          setUploadingReceipt(false);
        }
      }

      await apiFetch('/api/financial/settlements', {
        method: 'POST',
        body: {
          requisition_id: settleRequisitionId,
          project_id: projectId,
          settled_amount: parseFloat(settleAmount),
          ...(receiptUrl ? { receipt_url: receiptUrl } : {}),
        },
      });

      // Improvement #4: show remaining balance in the success message
      const selectedAdv = disbursedAdvances.find((a) => a.id === settleRequisitionId);
      const alreadySettled = computeSettled(settlements, settleRequisitionId);
      const remaining = selectedAdv ? selectedAdv.amount - alreadySettled - parseFloat(settleAmount) : null;
      const remainingMsg = remaining != null && remaining > 0
        ? ` Remaining balance: Nu. ${remaining.toLocaleString()}.`
        : remaining != null && remaining <= 0
        ? ' This advance is now fully settled.'
        : '';

      setSuccess(`Settlement submitted for verification.${remainingMsg}`);
      setSettleRequisitionId('');
      setSettleAmount('');
      setSettleReceiptFile(null);
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const disbursedAdvances = advances.filter((a) => a.status === 'disbursed');

  // Improvement #4: live remaining balance for the selected advance
  const selectedAdvance = useMemo(
    () => disbursedAdvances.find((a) => a.id === settleRequisitionId),
    [disbursedAdvances, settleRequisitionId]
  );
  const alreadySettled = useMemo(
    () => computeSettled(settlements, settleRequisitionId),
    [settlements, settleRequisitionId]
  );
  const remainingBalance = selectedAdvance ? selectedAdvance.amount - alreadySettled : null;
  const afterThisSettlement = remainingBalance != null && settleAmount
    ? remainingBalance - parseFloat(settleAmount || 0)
    : null;

  const labelStyle = { display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: 'var(--space-6) var(--space-5)' }}>
      <h1 style={{ marginBottom: 'var(--space-6)' }}>Advances</h1>

      {success && (
        <div className="ticket ticket--accent-survey" style={{ marginBottom: 'var(--space-5)' }}>
          <p style={{ color: 'var(--color-survey-deep)', margin: 0, fontWeight: 600 }}>{success}</p>
        </div>
      )}
      {error && (
        <div className="ticket ticket--accent-brick" style={{ marginBottom: 'var(--space-5)' }}>
          <p style={{ color: 'var(--color-brick)', margin: 0 }}>{error}</p>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-aggregate)' }}>Loading…</p>
      ) : (
        <>
          {/* Advance requisition form */}
          <form onSubmit={handleSubmitAdvance} className="ticket" style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ marginBottom: 'var(--space-4)' }}>New advance requisition</h3>

            <label style={labelStyle}>Advance type</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ marginBottom: 'var(--space-3)' }}>
              <option value="work_tied">Material / Transport / Work-tied labour</option>
              <option value="subcontract">Subcontract labour draw</option>
              <option value="overhead">Salary advance / Entertainment / Other</option>
            </select>

            {category === 'work_tied' && (
              <>
                <label style={labelStyle}>Linked work item</label>
                <select value={boqItemId} onChange={(e) => setBoqItemId(e.target.value)} required style={{ marginBottom: 'var(--space-3)' }}>
                  <option value="">Select a work item…</option>
                  {boqItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.description}</option>
                  ))}
                </select>
              </>
            )}

            {category === 'subcontract' && (
              <>
                <label style={labelStyle}>Subcontract team</label>
                <select value={subcontractId} onChange={(e) => setSubcontractId(e.target.value)} required style={{ marginBottom: 'var(--space-3)' }}>
                  <option value="">Select a team…</option>
                  {subcontracts.map((sc) => (
                    <option key={sc.id} value={sc.id}>{sc.team_lead_name}</option>
                  ))}
                </select>
              </>
            )}

            <label style={labelStyle}>Amount</label>
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required style={{ marginBottom: 'var(--space-3)' }} />

            <label style={labelStyle}>Justification</label>
            <textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={2} required style={{ marginBottom: 'var(--space-4)', resize: 'none' }} />

            <button type="submit" className="primary" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Submitting…' : 'Submit for verification'}
            </button>
          </form>

          {/* Settlement form */}
          {disbursedAdvances.length > 0 && (
            <form onSubmit={handleSubmitSettlement} className="ticket" style={{ marginBottom: 'var(--space-6)' }}>
              <h3 style={{ marginBottom: 'var(--space-4)' }}>Settle a disbursed advance</h3>

              <label style={labelStyle}>Advance to settle</label>
              <select
                value={settleRequisitionId}
                onChange={(e) => { setSettleRequisitionId(e.target.value); setSettleAmount(''); }}
                required
                style={{ marginBottom: 'var(--space-3)' }}
              >
                <option value="">Select an advance…</option>
                {disbursedAdvances.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.justification} — Nu. {a.amount?.toLocaleString()}
                  </option>
                ))}
              </select>

              {/* Improvement #4: show remaining balance before the user types an amount */}
              {selectedAdvance && (
                <div className="ticket ticket--sunken" style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-3)' }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)' }}>Original advance</span>
                    <span className="numeric" style={{ fontWeight: 600 }}>Nu. {selectedAdvance.amount?.toLocaleString()}</span>
                  </div>
                  {alreadySettled > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-3)', marginTop: 'var(--space-1)' }}>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)' }}>Already settled</span>
                      <span className="numeric" style={{ color: 'var(--color-aggregate)' }}>Nu. {alreadySettled.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-3)', marginTop: 'var(--space-1)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-aggregate-light)' }}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Remaining balance</span>
                    <span className="numeric" style={{ fontWeight: 700, color: remainingBalance > 0 ? 'var(--color-ink)' : 'var(--color-survey-deep)' }}>
                      Nu. {remainingBalance?.toLocaleString()}
                    </span>
                  </div>
                  {/* Live preview of balance after this settlement */}
                  {afterThisSettlement != null && settleAmount && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-3)', marginTop: 'var(--space-1)' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-aggregate)', fontStyle: 'italic' }}>After this settlement</span>
                      <span className="numeric" style={{ fontSize: 'var(--text-sm)', color: afterThisSettlement >= 0 ? 'var(--color-survey-deep)' : 'var(--color-brick)' }}>
                        Nu. {afterThisSettlement.toLocaleString()}
                        {afterThisSettlement < 0 ? ' (over advance)' : afterThisSettlement === 0 ? ' — fully settled' : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <label style={labelStyle}>Settled amount (partial settlements allowed)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                required
                style={{ marginBottom: 'var(--space-3)' }}
              />

              {/* Improvement #4: receipt image upload */}
              <label style={labelStyle}>Receipt / bill photo (optional)</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setSettleReceiptFile(e.target.files[0] ?? null)}
                style={{ marginBottom: settleReceiptFile ? 'var(--space-2)' : 'var(--space-4)' }}
              />
              {settleReceiptFile && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-aggregate)', marginBottom: 'var(--space-4)', marginTop: 0 }}>
                  {settleReceiptFile.name} selected
                </p>
              )}

              <button type="submit" className="primary" disabled={submitting || uploadingReceipt} style={{ width: '100%' }}>
                {uploadingReceipt ? 'Uploading receipt…' : submitting ? 'Submitting…' : 'Submit settlement'}
              </button>
            </form>
          )}

          {/* Improvement #7: consistent empty state */}
          <div className="ledger-header"><h3>Your requisitions</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {advances.length === 0 ? (
              <div className="ticket ticket--sunken" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                <p style={{ color: 'var(--color-aggregate)', margin: 0 }}>All caught up — no advance requisitions yet.</p>
              </div>
            ) : advances.map((a) => (
              <div key={a.id} className="ticket" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{a.justification}</p>
                  <p className="numeric" style={{ margin: '4px 0 0', color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>
                    Nu. {a.amount?.toLocaleString()} &middot; {a.advance_category}
                  </p>
                </div>
                <StatusStamp status={a.status} />
              </div>
            ))}
          </div>

          {settlements.length > 0 && (
            <>
              <div className="ledger-header" style={{ marginTop: 'var(--space-6)' }}><h3>Your settlements</h3></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {settlements.map((s) => (
                  <div key={s.id} className="ticket" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p className="numeric" style={{ margin: 0, fontWeight: 600 }}>Nu. {s.settled_amount?.toLocaleString()}</p>
                      {/* Improvement #5: show cashier's verification note (or rejection reason) to coordinator */}
                      {s.cashier_note && s.status === 'verified' && (
                        <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-survey-deep)' }}>
                          Note: {s.cashier_note}
                        </p>
                      )}
                      {s.rejection_reason && s.status === 'rejected' && (
                        <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-brick)' }}>
                          Rejected: {s.rejection_reason}
                        </p>
                      )}
                      {s.receipt_url && (
                        <a href={s.receipt_url} target="_blank" rel="noreferrer"
                          style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary)', textDecoration: 'none', display: 'block', marginTop: 4 }}>
                          View receipt ↗
                        </a>
                      )}
                    </div>
                    <StatusStamp status={s.status} />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
