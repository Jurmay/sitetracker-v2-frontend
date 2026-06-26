import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiClient';

export function AdminPage({ projectId }) {
  const [advances, setAdvances] = useState([]);
  const [fundRequisitions, setFundRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  function loadAll() {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      apiFetch('/api/financial/advances', { params: { project_id: projectId } }),
      apiFetch('/api/financial/fund-requisitions', { params: { project_id: projectId } }),
    ])
      .then(([advs, freqs]) => {
        setAdvances(advs);
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

  const pendingApproval = advances.filter((a) => a.status === 'pending_approval');
  const pendingFundApproval = fundRequisitions.filter((f) => f.status === 'pending_approval');

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: 'var(--space-6) var(--space-5)' }}>
      <h1 style={{ marginBottom: 'var(--space-6)' }}>Admin</h1>

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
          <h3 style={{ marginBottom: 'var(--space-3)' }}>Advances awaiting your approval</h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)', marginTop: 0, marginBottom: 'var(--space-4)' }}>
            These have already been verified by the Cashier. Approving lets the Cashier disburse the funds.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            {pendingApproval.map((a) => (
              <div key={a.id} className="ticket" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{a.justification}</p>
                  <p className="numeric" style={{ margin: '4px 0 0', color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>
                    {a.amount} &middot; {a.advance_category}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    className="primary"
                    disabled={actingId === a.id}
                    onClick={() => runAction(a.id, () =>
                      apiFetch(`/api/financial/advances/${a.id}/approve`, { method: 'POST', body: {} })
                    )}
                  >
                    Approve
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
            {pendingApproval.length === 0 && (
              <p style={{ color: 'var(--color-aggregate)' }}>Nothing awaiting your approval.</p>
            )}
          </div>

          <h3 style={{ marginBottom: 'var(--space-3)' }}>Fund requisitions awaiting your approval</h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)', marginTop: 0, marginBottom: 'var(--space-4)' }}>
            Approving generates a record and emails the project's Accounts contact, if one is configured.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {pendingFundApproval.map((f) => (
              <div key={f.id} className="ticket" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{f.reason}</p>
                  <p className="numeric" style={{ margin: '4px 0 0', color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>
                    {f.amount}
                  </p>
                </div>
                <button
                  className="primary"
                  disabled={actingId === f.id}
                  onClick={() => runAction(f.id, () =>
                    apiFetch(`/api/financial/fund-requisitions/${f.id}/approve`, { method: 'POST', body: {} })
                  )}
                >
                  Approve
                </button>
              </div>
            ))}
            {pendingFundApproval.length === 0 && (
              <p style={{ color: 'var(--color-aggregate)' }}>Nothing awaiting your approval.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
