import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount ?? 0);
}

function KpiCard({ label, value, variant }) {
  const color =
    variant === 'positive' ? 'var(--color-survey-deep)' :
    variant === 'negative' ? 'var(--color-brick)' :
    'var(--color-ink)';
  return (
    <div className="ticket">
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)', margin: '0 0 var(--space-2)' }}>
        {label}
      </p>
      <p className="numeric" style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, margin: 0, color }}>
        {value}
      </p>
    </div>
  );
}

export function DashboardPage({ projectId }) {
  const [evm, setEvm] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    apiFetch('/api/dashboard/evm', { params: { project_id: projectId } })
      .then(setEvm)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--space-6) var(--space-5)' }}>
      <h1 style={{ marginBottom: 'var(--space-6)' }}>Project dashboard</h1>

      {loading && <p style={{ color: 'var(--color-aggregate)' }}>Loading project figures…</p>}

      {error && (
        <div className="ticket" style={{ borderColor: 'var(--color-brick)', marginBottom: 'var(--space-5)' }}>
          <p style={{ color: 'var(--color-brick)', margin: 0 }}>{error}</p>
        </div>
      )}

      {evm && !loading && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          <KpiCard label="Physical progress" value={`${evm.physical_progress_pct}%`} />
          <KpiCard label="Financial progress" value={`${evm.financial_progress_pct}%`} />
          <KpiCard
            label="Cost variance"
            value={formatCurrency(evm.cost_variance)}
            variant={evm.cost_variance >= 0 ? 'positive' : 'negative'}
          />
          <KpiCard
            label="Schedule variance"
            value={formatCurrency(evm.schedule_variance)}
            variant={evm.schedule_variance >= 0 ? 'positive' : 'negative'}
          />
          <KpiCard label="Planned value" value={formatCurrency(evm.total_planned_value)} />
          <KpiCard label="Earned value" value={formatCurrency(evm.total_earned_value)} />
          <KpiCard label="Actual cost" value={formatCurrency(evm.total_actual_cost)} />
          <KpiCard
            label="BOQ items exceeding estimate"
            value={evm.items_exceeding_boq_estimate}
            variant={evm.items_exceeding_boq_estimate > 0 ? 'negative' : undefined}
          />
        </div>
      )}
    </div>
  );
}
