// Owner dashboard across all sites. Rows come from /api/dashboard/portfolio
// (v_portfolio_summary), which only returns sites where the user is
// Company Owner or Admin - so an empty list means "not an owner".

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount ?? 0);
}

function sum(sites, key) {
  return sites.reduce((total, s) => total + (s[key] ?? 0), 0);
}

function daysSince(isoDate) {
  if (!isoDate) return null;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
}

// Everything on a site that needs the owner's attention, most urgent first.
function siteAlerts(s) {
  const alerts = [];
  if (s.settlements_overdue > 0) {
    alerts.push({ level: 'brick', text: `${s.settlements_overdue} advance${s.settlements_overdue > 1 ? 's' : ''} overdue for settlement` });
  }
  if (s.cash_low) {
    alerts.push({ level: 'brick', text: `Cash low: ${s.cash_balance_pct}% of funds left (limit ${s.cash_replenishment_threshold_pct}%)` });
  }
  if (s.cost_variance < 0) {
    alerts.push({ level: 'brick', text: `Over cost by Nu. ${formatCurrency(-s.cost_variance)}` });
  }
  if (s.advances_pending_approval > 0) {
    alerts.push({ level: 'safety', text: `${s.advances_pending_approval} advance${s.advances_pending_approval > 1 ? 's' : ''} waiting for your approval` });
  }
  if (s.fund_requisitions_pending > 0) {
    alerts.push({ level: 'safety', text: `${s.fund_requisitions_pending} fund requisition${s.fund_requisitions_pending > 1 ? 's' : ''} waiting for approval` });
  }
  const missing = s.coordinators_missing_today.length;
  if (missing > 0) {
    alerts.push({ level: 'safety', text: `${missing} of ${s.coordinators_on_duty} coordinator${s.coordinators_on_duty > 1 ? 's' : ''} haven't submitted today` });
  }
  if (s.schedule_variance < 0) {
    alerts.push({ level: 'safety', text: `Behind schedule by Nu. ${formatCurrency(-s.schedule_variance)} of work` });
  }
  if (s.schedule_items_late > 0) {
    alerts.push({ level: 'safety', text: `${s.schedule_items_late} BOQ item${s.schedule_items_late > 1 ? 's' : ''} behind schedule` });
  }
  if (s.schedule_items_unscheduled > 0) {
    alerts.push({ level: 'safety', text: `${s.schedule_items_unscheduled} BOQ item${s.schedule_items_unscheduled > 1 ? 's' : ''} without planned dates` });
  }
  if (s.items_exceeding_boq_estimate > 0) {
    alerts.push({ level: 'safety', text: `${s.items_exceeding_boq_estimate} BOQ item${s.items_exceeding_boq_estimate > 1 ? 's' : ''} past estimated quantity` });
  }
  const idle = daysSince(s.last_progress_date);
  if (s.status === 'active' && (idle === null || idle > 7)) {
    alerts.push({ level: 'safety', text: idle === null ? 'No progress reported yet' : `No progress reported for ${idle} days` });
  }
  return alerts;
}

function Stat({ label, value, variant }) {
  const color =
    variant === 'positive' ? 'var(--color-survey-deep)' :
    variant === 'negative' ? 'var(--color-brick)' :
    'var(--color-ink)';
  return (
    <div className="ticket ticket--sunken kpi-card" style={{ padding: 'var(--space-4)' }}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value" style={{ fontSize: 'var(--text-xl)', color }}>{value}</span>
    </div>
  );
}

function ProgressBar({ label, pct, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-aggregate)', marginBottom: 4 }}>
        <span>{label}</span>
        <span className="numeric">{pct}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--color-aggregate-faint)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

function SiteCard({ site, onOpen }) {
  const alerts = siteAlerts(site);
  const accent = alerts.some((a) => a.level === 'brick') ? 'brick' : alerts.length ? 'safety' : 'survey';
  const awaitingCashier = site.advances_pending_verification + site.advances_awaiting_disbursement + site.settlements_pending_verification;

  return (
    <div className={`ticket ticket--accent-${accent}`} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, overflowWrap: 'anywhere' }}>{site.name}</h3>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)' }}>
            {[site.location, site.status].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button className="primary" onClick={() => onOpen(site.project_id)} style={{ flexShrink: 0 }}>
          Open
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <ProgressBar label="Work done (physical)" pct={site.physical_progress_pct} color="var(--color-survey)" />
        <ProgressBar label="Money spent (financial)" pct={site.financial_progress_pct} color="var(--color-primary)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-3)' }}>
        <Stat label="Cash in hand" value={formatCurrency(site.cash_balance)} variant={site.cash_low ? 'negative' : undefined} />
        <Stat label="Cost variance" value={formatCurrency(site.cost_variance)} variant={site.cost_variance >= 0 ? 'positive' : 'negative'} />
        <Stat label="Advances out" value={formatCurrency(site.advances_outstanding_amount)} />
        <Stat
          label="Submitted today"
          value={site.coordinators_on_duty ? `${Math.min(site.master_roll_submitted_today, site.progress_submitted_today)}/${site.coordinators_on_duty}` : '—'}
          variant={site.coordinators_missing_today.length ? 'negative' : 'positive'}
        />
      </div>

      {alerts.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {alerts.map((a) => (
            <li key={a.text} style={{ fontSize: 'var(--text-sm)', color: a.level === 'brick' ? 'var(--color-brick)' : 'var(--color-ink)' }}>
              {a.text}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-survey-deep)', fontWeight: 600 }}>
          All clear on this site.
        </p>
      )}

      {site.coordinators_missing_today.length > 0 && (
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-aggregate)' }}>
          Not yet submitted today: {site.coordinators_missing_today.join(', ')}
        </p>
      )}
      {awaitingCashier > 0 && (
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-aggregate)' }}>
          With the cashier: {awaitingCashier} item{awaitingCashier > 1 ? 's' : ''} to verify or pay out.
        </p>
      )}
    </div>
  );
}

export function PortfolioPage({ sites, onOpenSite }) {
  const totalCv = sum(sites, 'cost_variance');
  const flagged = sites.filter((s) => siteAlerts(s).some((a) => a.level === 'brick')).length;

  return (
    <div>
      <h1 style={{ marginBottom: 'var(--space-2)' }}>All sites</h1>
      <p style={{ color: 'var(--color-aggregate)', marginTop: 0 }}>
        {sites.length} site{sites.length > 1 ? 's' : ''}
        {flagged > 0 ? ` · ${flagged} need${flagged > 1 ? '' : 's'} attention` : ' · nothing urgent'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(max(140px, calc((100% - 2 * var(--space-3)) / 3)), 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
        <Stat label="Total budget" value={formatCurrency(sum(sites, 'total_budgeted_cost'))} />
        <Stat label="Work done" value={formatCurrency(sum(sites, 'earned_value'))} />
        <Stat label="Spent" value={formatCurrency(sum(sites, 'actual_cost'))} />
        <Stat label="Cost variance" value={formatCurrency(totalCv)} variant={totalCv >= 0 ? 'positive' : 'negative'} />
        <Stat label="Cash in hand" value={formatCurrency(sum(sites, 'cash_balance'))} />
        <Stat label="Advances out" value={formatCurrency(sum(sites, 'advances_outstanding_amount'))} />
      </div>

      <div className="ledger-header">
        <h3>Sites</h3>
        <span className="ledger-header-note">Amounts in Nu.</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {sites.map((s) => <SiteCard key={s.project_id} site={s} onOpen={onOpenSite} />)}
      </div>
    </div>
  );
}
