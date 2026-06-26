import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiClient';
import { StatusStamp } from '../components/StatusStamp';

export function AdvancesPage({ projectId }) {
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

  useEffect(loadAll, [projectId]);

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
      await apiFetch('/api/financial/settlements', {
        method: 'POST',
        body: {
          requisition_id: settleRequisitionId,
          project_id: projectId,
          settled_amount: parseFloat(settleAmount),
        },
      });
      setSuccess('Settlement submitted for verification.');
      setSettleRequisitionId('');
      setSettleAmount('');
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const disbursedAdvances = advances.filter((a) => a.status === 'disbursed');

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: 'var(--space-6) var(--space-5)' }}>
      <h1 style={{ marginBottom: 'var(--space-6)' }}>Advances</h1>

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
          <form onSubmit={handleSubmitAdvance} className="ticket" style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ marginBottom: 'var(--space-4)' }}>New advance requisition</h3>

            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
              Advance type
            </label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ marginBottom: 'var(--space-3)' }}>
              <option value="work_tied">Material / Transport / Work-tied labour</option>
              <option value="subcontract">Subcontract labour draw</option>
              <option value="overhead">Salary advance / Entertainment / Other</option>
            </select>

            {category === 'work_tied' && (
              <>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                  Linked work item
                </label>
                <select
                  value={boqItemId}
                  onChange={(e) => setBoqItemId(e.target.value)}
                  required
                  style={{ marginBottom: 'var(--space-3)' }}
                >
                  <option value="">Select a work item…</option>
                  {boqItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.description}</option>
                  ))}
                </select>
              </>
            )}

            {category === 'subcontract' && (
              <>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                  Subcontract team
                </label>
                <select
                  value={subcontractId}
                  onChange={(e) => setSubcontractId(e.target.value)}
                  required
                  style={{ marginBottom: 'var(--space-3)' }}
                >
                  <option value="">Select a team…</option>
                  {subcontracts.map((sc) => (
                    <option key={sc.id} value={sc.id}>{sc.team_lead_name}</option>
                  ))}
                </select>
              </>
            )}

            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
              Amount
            </label>
            <input
              type="number" min="0" step="0.01" value={amount}
              onChange={(e) => setAmount(e.target.value)} required
              style={{ marginBottom: 'var(--space-3)' }}
            />

            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
              Justification
            </label>
            <textarea
              value={justification} onChange={(e) => setJustification(e.target.value)}
              rows={2} required style={{ marginBottom: 'var(--space-4)', resize: 'none' }}
            />

            <button type="submit" className="primary" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Submitting…' : 'Submit for verification'}
            </button>
          </form>

          {disbursedAdvances.length > 0 && (
            <form onSubmit={handleSubmitSettlement} className="ticket" style={{ marginBottom: 'var(--space-6)' }}>
              <h3 style={{ marginBottom: 'var(--space-4)' }}>Settle a disbursed advance</h3>

              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                Advance to settle
              </label>
              <select
                value={settleRequisitionId}
                onChange={(e) => setSettleRequisitionId(e.target.value)}
                required
                style={{ marginBottom: 'var(--space-3)' }}
              >
                <option value="">Select an advance…</option>
                {disbursedAdvances.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.justification} — {a.amount}
                  </option>
                ))}
              </select>

              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                Settled amount (partial settlements allowed)
              </label>
              <input
                type="number" min="0" step="0.01" value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)} required
                style={{ marginBottom: 'var(--space-4)' }}
              />

              <button type="submit" className="primary" disabled={submitting} style={{ width: '100%' }}>
                {submitting ? 'Submitting…' : 'Submit settlement'}
              </button>
            </form>
          )}

          <h3 style={{ marginBottom: 'var(--space-3)' }}>Your requisitions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {advances.map((a) => (
              <div key={a.id} className="ticket" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{a.justification}</p>
                  <p className="numeric" style={{ margin: '4px 0 0', color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>
                    {a.amount} &middot; {a.advance_category}
                  </p>
                </div>
                <StatusStamp status={a.status} />
              </div>
            ))}
            {advances.length === 0 && (
              <p style={{ color: 'var(--color-aggregate)' }}>No advance requisitions yet.</p>
            )}
          </div>

          {settlements.length > 0 && (
            <>
              <h3 style={{ marginTop: 'var(--space-6)', marginBottom: 'var(--space-3)' }}>Your settlements</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {settlements.map((s) => (
                  <div key={s.id} className="ticket" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p className="numeric" style={{ margin: 0 }}>{s.settled_amount}</p>
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
