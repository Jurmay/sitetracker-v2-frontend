import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiClient';
import { StatusStamp } from '../components/StatusStamp';
import { useAuth } from '../context/AuthContext';

// Improvement #5: inline review panel replaces window.prompt for reject reason
// and adds an optional verification note field
function ReviewPanel({ id, onVerify, onReject, actingId }) {
  const [mode, setMode] = useState(null); // null | 'reject' | 'verify'
  const [rejectReason, setRejectReason] = useState('');
  const [verifyNote, setVerifyNote] = useState('');

  function reset() { setMode(null); setRejectReason(''); setVerifyNote(''); }

  if (mode === 'reject') {
    return (
      <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-paper-sunken)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-brick)' }}>
        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-brick)' }}>
          Reason for rejection (required)
        </label>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={2}
          placeholder="Explain why this is being rejected…"
          style={{ marginBottom: 'var(--space-3)', resize: 'none' }}
        />
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            className="primary"
            disabled={!rejectReason.trim() || actingId === id}
            onClick={() => { onReject(id, rejectReason); reset(); }}
            style={{ background: 'var(--color-brick)', borderColor: 'var(--color-brick-deep)', flex: 1 }}
          >
            {actingId === id ? 'Rejecting…' : 'Confirm rejection'}
          </button>
          <button onClick={reset} style={{ flex: 1 }}>Cancel</button>
        </div>
        {!rejectReason.trim() && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-brick)', margin: 'var(--space-2) 0 0' }}>
            A reason is required to reject.
          </p>
        )}
      </div>
    );
  }

  if (mode === 'verify') {
    return (
      <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-paper-sunken)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-survey)' }}>
        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-survey-deep)' }}>
          Verification note (optional — coordinator will see this)
        </label>
        <textarea
          value={verifyNote}
          onChange={(e) => setVerifyNote(e.target.value)}
          rows={2}
          placeholder="Any note for the coordinator…"
          style={{ marginBottom: 'var(--space-3)', resize: 'none' }}
        />
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            className="primary"
            disabled={actingId === id}
            onClick={() => { onVerify(id, verifyNote || null); reset(); }}
            style={{ flex: 1 }}
          >
            {actingId === id ? 'Verifying…' : 'Confirm verification'}
          </button>
          <button onClick={reset} style={{ flex: 1 }}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
      <button
        disabled={actingId === id}
        onClick={() => setMode('verify')}
        style={{ flex: 1 }}
      >
        Verify
      </button>
      <button
        disabled={actingId === id}
        onClick={() => setMode('reject')}
        style={{ flex: 1, color: 'var(--color-brick)', borderColor: 'var(--color-brick)' }}
      >
        Reject
      </button>
    </div>
  );
}

export function CashierPage({ projectId }) {
  const { user } = useAuth();
  const [advances, setAdvances] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [cashbook, setCashbook] = useState(null);
  const [fundRequisitions, setFundRequisitions] = useState([]);

  const [fundAmount, setFundAmount] = useState('');
  const [fundReason, setFundReason] = useState('');

  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  function loadAll() {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      apiFetch('/api/financial/advances', { params: { project_id: projectId } }),
      apiFetch('/api/financial/settlements', { params: { project_id: projectId } }),
      apiFetch('/api/financial/cashbook', { params: { project_id: projectId } }).catch(() => null),
      apiFetch('/api/financial/fund-requisitions', { params: { project_id: projectId } }),
    ])
      .then(([advs, setts, cb, freqs]) => {
        setAdvances(advs);
        setSettlements(setts);
        setCashbook(cb);
        setFundRequisitions(freqs);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadAll, [projectId, user?.id]);

  async function runAction(id, fn) {
    setError(null);
    setSuccess(null);
    setActingId(id);
    try {
      await fn();
      setSuccess('Action completed.');
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId(null);
    }
  }

  // Improvement #5: verify with optional note, reject with mandatory reason
  function handleVerifyAdvance(id, note) {
    runAction(id, () =>
      apiFetch(`/api/financial/advances/${id}/verify`, { method: 'POST', body: { remarks: note ?? undefined } })
    );
  }

  function handleRejectAdvance(id, reason) {
    runAction(id, () =>
      apiFetch(`/api/financial/advances/${id}/reject`, { method: 'POST', body: { remarks: reason } })
    );
  }

  function handleVerifySettlement(id, note) {
    runAction(id, () =>
      apiFetch(`/api/financial/settlements/${id}/verify`, { method: 'POST', body: { remarks: note ?? undefined } })
    );
  }

  function handleRejectSettlement(id, reason) {
    runAction(id, () =>
      apiFetch(`/api/financial/settlements/${id}/reject`, { method: 'POST', body: { remarks: reason } })
    );
  }

  async function handleFundRequisition(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await apiFetch('/api/financial/fund-requisitions', {
        method: 'POST',
        body: { project_id: projectId, amount: parseFloat(fundAmount), reason: fundReason },
      });
      setSuccess('Fund requisition raised.');
      setFundAmount('');
      setFundReason('');
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  const pendingVerification = advances.filter((a) => a.status === 'pending_verification');
  const pendingApproval = advances.filter((a) => a.status === 'approved');
  const pendingSettlementVerification = settlements.filter((s) => s.status === 'pending_verification');

  // Improvement #7: all-caught-up check
  const allAdvancesClear = pendingVerification.length === 0 && pendingApproval.length === 0;
  const allSettlementsClear = pendingSettlementVerification.length === 0;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 'var(--space-6) var(--space-5)' }}>
      <h1 style={{ marginBottom: 'var(--space-6)' }}>Cashier</h1>

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
          {/* Cash position card */}
          {cashbook && (
            <div
              className="ticket"
              style={{
                marginBottom: 'var(--space-6)',
                borderColor: cashbook.balance_pct_of_fund <= 20 ? 'var(--color-brick)' : 'var(--color-ink)',
              }}
            >
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)', margin: '0 0 var(--space-2)' }}>
                Cash position
              </p>
              <p className="numeric" style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, margin: 0 }}>
                Nu. {cashbook.current_balance?.toLocaleString()}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-aggregate)', margin: 'var(--space-1) 0 0' }}>
                {cashbook.balance_pct_of_fund}% of total fund received
                {cashbook.balance_pct_of_fund <= 20 && ' — below threshold'}
              </p>
            </div>
          )}

          {/* Improvement #7: unified all-clear state for advance queues */}
          {allAdvancesClear && allSettlementsClear && (
            <div className="ticket ticket--sunken" style={{ textAlign: 'center', padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
              <p style={{ color: 'var(--color-survey-deep)', margin: 0, fontWeight: 600, fontSize: 'var(--text-lg)' }}>
                ✓ All caught up — no pending items.
              </p>
            </div>
          )}

          {/* Advances awaiting verification */}
          <div className="ledger-header"><h3>Advances awaiting verification</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            {pendingVerification.length === 0 ? (
              <p style={{ color: 'var(--color-aggregate)', fontStyle: 'italic' }}>All caught up — nothing awaiting verification.</p>
            ) : pendingVerification.map((a) => (
              <div key={a.id} className="ticket">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>{a.justification}</p>
                    <p className="numeric" style={{ margin: '4px 0 0', color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>
                      Nu. {a.amount?.toLocaleString()} &middot; {a.advance_category}
                    </p>
                  </div>
                  <StatusStamp status={a.status} />
                </div>
                {/* Improvement #5: inline review panel */}
                <ReviewPanel
                  id={a.id}
                  onVerify={handleVerifyAdvance}
                  onReject={handleRejectAdvance}
                  actingId={actingId}
                />
              </div>
            ))}
          </div>

          {/* Advances approved by admin, awaiting cashier disbursement */}
          <div className="ledger-header"><h3>Approved advances awaiting disbursement</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            {pendingApproval.length === 0 ? (
              <p style={{ color: 'var(--color-aggregate)', fontStyle: 'italic' }}>All caught up — nothing awaiting disbursement.</p>
            ) : pendingApproval.map((a) => (
              <div key={a.id} className="ticket" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{a.justification}</p>
                  <p className="numeric" style={{ margin: '4px 0 0', color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>
                    Nu. {a.amount?.toLocaleString()}
                  </p>
                </div>
                <button
                  className="primary"
                  disabled={actingId === a.id}
                  onClick={() => runAction(a.id, () =>
                    apiFetch(`/api/financial/advances/${a.id}/disburse`, { method: 'POST', body: {} })
                  )}
                >
                  {actingId === a.id ? 'Disbursing…' : 'Disburse'}
                </button>
              </div>
            ))}
          </div>

          {/* Settlements awaiting verification */}
          <div className="ledger-header"><h3>Settlements awaiting verification</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            {pendingSettlementVerification.length === 0 ? (
              <p style={{ color: 'var(--color-aggregate)', fontStyle: 'italic' }}>All caught up — no settlements pending.</p>
            ) : pendingSettlementVerification.map((s) => (
              <div key={s.id} className="ticket">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p className="numeric" style={{ margin: 0, fontWeight: 600 }}>Nu. {s.settled_amount?.toLocaleString()}</p>
                    {/* Improvement #5: show receipt image if uploaded */}
                    {s.receipt_url && (
                      <a href={s.receipt_url} target="_blank" rel="noreferrer"
                        style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary)', textDecoration: 'none', display: 'block', marginTop: 4 }}>
                        View receipt ↗
                      </a>
                    )}
                  </div>
                  <StatusStamp status={s.status} />
                </div>
                {/* Improvement #5: inline settlement review panel */}
                <ReviewPanel
                  id={s.id}
                  onVerify={handleVerifySettlement}
                  onReject={handleRejectSettlement}
                  actingId={actingId}
                />
              </div>
            ))}
          </div>

          {/* Fund requisition form */}
          <form onSubmit={handleFundRequisition} className="ticket" style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ marginBottom: 'var(--space-4)' }}>Raise a fund requisition</h3>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
              Amount
            </label>
            <input
              type="number" min="0" step="0.01" value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)} required
              style={{ marginBottom: 'var(--space-3)' }}
            />
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
              Reason
            </label>
            <textarea
              value={fundReason} onChange={(e) => setFundReason(e.target.value)}
              rows={2} required style={{ marginBottom: 'var(--space-4)', resize: 'none' }}
            />
            <button type="submit" className="primary" style={{ width: '100%' }}>Submit to Admin</button>
          </form>

          {/* Fund requisitions list */}
          {fundRequisitions.length > 0 && (
            <>
              <div className="ledger-header"><h3>Your fund requisitions</h3></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {fundRequisitions.map((f) => (
                  <div key={f.id} className="ticket" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p className="numeric" style={{ margin: 0, fontWeight: 600 }}>Nu. {f.amount?.toLocaleString()}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)' }}>{f.reason}</p>
                    </div>
                    <StatusStamp status={f.status} />
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
