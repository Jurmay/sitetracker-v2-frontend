import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiClient';

const TODAY = new Date().toISOString().slice(0, 10);

export function ProgressPage({ projectId }) {
  const [boqItems, setBoqItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [measuredQuantity, setMeasuredQuantity] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [loadingItems, setLoadingItems] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    setLoadingItems(true);
    setError(null);

    apiFetch('/api/boq/sections', { params: { project_id: projectId } })
      .then(async (sections) => {
        const itemLists = await Promise.all(
          sections.map((s) => apiFetch('/api/boq/items', { params: { section_id: s.id } }))
        );
        setBoqItems(itemLists.flat());
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingItems(false));
  }, [projectId]);

  const selectedItem = boqItems.find((i) => i.id === selectedItemId);
  const quantityNum = parseFloat(measuredQuantity);
  const percentComplete =
    selectedItem && !isNaN(quantityNum) ? Math.round((quantityNum / selectedItem.quantity) * 100) : null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedItemId) {
      setError('Select a BOQ item to report progress against.');
      return;
    }
    if (measuredQuantity === '' || isNaN(quantityNum) || quantityNum < 0) {
      setError('Enter a valid measured quantity (0 or greater).');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/progress', {
        method: 'POST',
        body: {
          project_id: projectId,
          boq_item_id: selectedItemId,
          date: TODAY,
          measured_quantity: quantityNum,
          notes: notes || null,
        },
      });
      setSuccess(`Progress recorded: ${selectedItem.description} now at ${quantityNum} ${selectedItem.unit}.`);
      setMeasuredQuantity('');
      setNotes('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 'var(--space-6) var(--space-5)' }}>
      <h1 style={{ marginBottom: 'var(--space-1)' }}>Progress report &mdash; {TODAY}</h1>
      <p style={{ color: 'var(--color-aggregate)', marginTop: 0, marginBottom: 'var(--space-6)' }}>
        Record the actual measured quantity completed for a work item.
      </p>

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

      {loadingItems ? (
        <p style={{ color: 'var(--color-aggregate)' }}>Loading work items…</p>
      ) : (
        <form onSubmit={handleSubmit} className="ticket">
          <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            Work item
          </label>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            required
            style={{ marginBottom: 'var(--space-4)' }}
          >
            <option value="">Select a work item…</option>
            {boqItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.description} ({item.unit})
              </option>
            ))}
          </select>

          <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            Measured quantity {selectedItem ? `(${selectedItem.unit})` : ''}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={measuredQuantity}
              onChange={(e) => setMeasuredQuantity(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            {selectedItem && (
              <span style={{ color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>
                / {selectedItem.quantity} {selectedItem.unit}
              </span>
            )}
          </div>

          {percentComplete !== null && (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ background: 'var(--color-aggregate-faint)', borderRadius: 4, height: 6 }}>
                <div
                  style={{
                    background: percentComplete > 100 ? 'var(--color-brick)' : 'var(--color-survey)',
                    width: `${Math.min(percentComplete, 100)}%`,
                    height: 6,
                    borderRadius: 4,
                  }}
                />
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-aggregate)', margin: 'var(--space-1) 0 0' }}>
                {percentComplete}% complete (auto-calculated)
                {percentComplete > 100 && ' — exceeds BOQ estimate'}
              </p>
            </div>
          )}

          <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. slowed by rain in the afternoon"
            style={{ marginBottom: 'var(--space-5)', resize: 'none' }}
          />

          <button type="submit" className="primary" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Submitting…' : 'Submit progress report'}
          </button>
        </form>
      )}
    </div>
  );
}
