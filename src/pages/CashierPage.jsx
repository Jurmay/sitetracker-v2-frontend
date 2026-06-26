import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiClient';
import { StatusStamp } from '../components/StatusStamp';

export function CashierPage({ projectId }) {
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

  useEffect(loadAll, [projectId]);

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
  const pendingSettlementVerification = settlements.filter((s) => s.status === 'pending_verification');

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 'var(--space-6) var(--space-5)' }}>
      <h1 style={{ marginBottom: 'var(--space-6)' }}>Cashier</h1>

      {success && (
        <div className="ticket" style={{ borderColor: 'var(--color-survey)', marginBottom: 'var(--space-5)' }}>
          <p style={{ color: 'var(--color-survey-deep)', margin: 0, fontWeight: 600 }}>{success}</p>
        </div>
      )}
      {error && (
        <div className="ticket" style={{ borderColor: 'var(--color-brick)', marginBottom: 'var(--space-5)' }}>
          <p style={{ color: 'var(--color-brick)', margin: 0 }}>{error}</p>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-aggregate)' }}>Loading…</p>
      ) : (
        <>
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
                {cashbook.current_balance}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-aggregate)', margin: 'var(--space-1) 0 0' }}>
                {cashbook.balance_pct_of_fund}% of total fund received
                {cashbook.balance_pct_of_fund <= 20 && ' — below threshold'}
              </p>
            </div>
          )}

          <h3 style={{ marginBottom: 'var(--space-3)' }}>Advances awaiting verification</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            {pendingVerification.map((a) => (
              <div key={a.id} className="ticket" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{a.justification}</p>
                  <p className="numeric" style={{ margin: '4px 0 0', color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>
                    {a.amount}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    disabled={actingId === a.id}
                    onClick={() => runAction(a.id, () =>
                      apiFetch(`/api/financial/advances/${a.id}/verify`, { method: 'POST', body: {} })
                    )}
                  >
                    Verify
                  </button>
                  <button
                    disabled={actingId === a.id}
                    onClick={() => {
                      const remarks = window.prompt('Reason for rejecting this advance:');
                      if (remarks) {
                        runAction(a.id, () =>
                          apiFetch(`/api/financial/advances/${a.id}/reject`, { method: 'POST', body: { remarks } })
                        );
                      }
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
            {pendingVerification.length === 0 && (
              <p style={{ color: 'var(--color-aggregate)' }}>Nothing awaiting verification.</p>
            )}
          </div>

          <h3 style={{ marginBottom: 'var(--space-3)' }}>Approved advances awaiting disbursement</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            {advances.filter((a) => a.status === 'approved').map((a) => (
              <div key={a.id} className="ticket" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{a.justification}</p>
                  <p className="numeric" style={{ margin: '4px 0 0', color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>
                    {a.amount}
                  </p>
                </div>
                <button
                  className="primary"
                  disabled={actingId === a.id}
                  onClick={() => runAction(a.id, () =>
                    apiFetch(`/api/financial/advances/${a.id}/disburse`, { method: 'POST', body: {} })
                  )}
                >
                  Disburse
                </button>
              </div>
            ))}
            {advances.filter((a) => a.status === 'approved').length === 0 && (
              <p style={{ color: 'var(--color-aggregate)' }}>Nothing awaiting disbursement.</p>
            )}
          </div>

          <h3 style={{ marginBottom: 'var(--space-3)' }}>Settlements awaiting verification</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            {pendingSettlementVerification.map((s) => (
              <div key={s.id} className="ticket" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="numeric" style={{ margin: 0, fontWeight: 600 }}>{s.settled_amount}</p>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    disabled={actingId === s.id}
                    onClick={() => runAction(s.id, () =>
                      apiFetch(`/api/financial/settlements/${s.id}/verify`, { method: 'POST', body: {} })
                    )}
                  >
                    Verify
                  </button>
                  <button
                    disabled={actingId === s.id}
                    onClick={() => {
                      const remarks = window.prompt('Reason for rejecting this settlement:');
                      if (remarks) {
                        runAction(s.id, () =>
                          apiFetch(`/api/financial/settlements/${s.id}/reject`, { method: 'POST', body: { remarks } })
                        );
                      }
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
            {pendingSettlementVerification.length === 0 && (
              <p style={{ color: 'var(--color-aggregate)' }}>Nothing awaiting verification.</p>
            )}
          </div>

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

          {fundRequisitions.length > 0 && (
            <>
              <h3 style={{ marginBottom: 'var(--space-3)' }}>Your fund requisitions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {fundRequisitions.map((f) => (
                  <div key={f.id} className="ticket" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p className="numeric" style={{ margin: 0 }}>{f.amount}</p>
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
