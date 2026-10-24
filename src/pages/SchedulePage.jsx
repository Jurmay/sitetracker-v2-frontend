import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../lib/apiClient';
import { bhutanToday } from '../lib/today';

// Status values come from v_schedule_by_boq_item.
const STATUS = {
  overdue: { label: 'Overdue', color: 'var(--color-brick)' },
  behind: { label: 'Behind', color: 'var(--color-primary-deep)' },
  late_start: { label: 'Late start', color: 'var(--color-primary-deep)' },
  on_track: { label: 'On track', color: 'var(--color-survey)' },
  not_started: { label: 'Not started', color: 'var(--color-aggregate)' },
  done: { label: 'Done', color: 'var(--color-survey-deep)' },
  unscheduled: { label: 'No dates', color: 'var(--color-aggregate)' },
};
const STATUS_ORDER = ['overdue', 'behind', 'late_start', 'on_track', 'not_started', 'done', 'unscheduled'];
const LATE = new Set(['overdue', 'behind', 'late_start']);

const DAY = 86_400_000;
const toTime = (iso) => new Date(`${iso}T00:00:00Z`).getTime();

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00Z`);
  const sameYear = iso.slice(0, 4) === bhutanToday().slice(0, 4);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC' });
}

function formatQty(n) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n ?? 0);
}

function delayText(days) {
  if (days == null) return null;
  if (days === 0) return 'on time';
  return days > 0 ? `${days} day${days > 1 ? 's' : ''} late` : `${-days} day${days < -1 ? 's' : ''} early`;
}

function StatusPill({ status }) {
  const s = STATUS[status] ?? STATUS.unscheduled;
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

// One shared time axis for the whole project so bars line up.
function useTimeline(items) {
  const today = toTime(bhutanToday());
  const times = [today];
  for (const it of items) {
    for (const key of ['planned_start', 'planned_end', 'actual_start', 'actual_finish', 'forecast_finish']) {
      if (it[key]) times.push(toTime(it[key]));
    }
  }
  const start = Math.min(...times);
  const end = Math.max(...times, start + DAY);
  const pos = (iso) => `${((toTime(iso) - start) / (end - start)) * 100}%`;
  const span = (a, b) => `${Math.max(((toTime(b) - toTime(a)) / (end - start)) * 100, 0.8)}%`;
  return { pos, span, todayPos: `${((today - start) / (end - start)) * 100}%` };
}

function TimelineBar({ item, timeline }) {
  const { pos, span, todayPos } = timeline;
  const s = STATUS[item.schedule_status] ?? STATUS.unscheduled;
  const actualEnd = item.actual_finish ?? (item.actual_start ? bhutanToday() : null);
  return (
    <div style={{ position: 'relative', height: 22, borderRadius: 4, background: 'var(--color-paper-sunken)', overflow: 'hidden' }}
      aria-hidden="true">
      {item.planned_start && item.planned_end && (
        <div title="Planned" style={{
          position: 'absolute', top: 3, height: 10, left: pos(item.planned_start), width: span(item.planned_start, item.planned_end),
          background: 'var(--color-aggregate-light)', borderRadius: 3, overflow: 'hidden',
        }}>
          <div style={{ width: `${Math.min(100, item.pct_complete)}%`, height: '100%', background: s.color }} />
        </div>
      )}
      {item.actual_start && (
        <div title="Actual" style={{
          position: 'absolute', top: 15, height: 4, left: pos(item.actual_start), width: span(item.actual_start, actualEnd),
          background: 'var(--color-ink)', borderRadius: 2, opacity: 0.55,
        }} />
      )}
      {item.forecast_finish && actualEnd && (
        <div title="Forecast" style={{
          position: 'absolute', top: 15, height: 4, left: pos(actualEnd), width: span(actualEnd, item.forecast_finish),
          borderTop: '2px dashed var(--color-ink)', opacity: 0.4,
        }} />
      )}
      <div title="Today" style={{ position: 'absolute', top: 0, bottom: 0, left: todayPos, width: 2, background: 'var(--color-brick)' }} />
    </div>
  );
}

function DatesEditor({ item, onSaved, onCancel }) {
  const [start, setStart] = useState(item.planned_start ?? '');
  const [end, setEnd] = useState(item.planned_end ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save(clear) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/boq/items/${item.boq_item_id}/planned-dates`, {
        method: 'PATCH',
        body: clear ? { planned_start: null, planned_end: null } : { planned_start: start || null, planned_end: end || null },
      });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
        <label style={{ fontSize: 'var(--text-sm)' }}>
          Planned start
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label style={{ fontSize: 'var(--text-sm)' }}>
          Planned end
          <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      {error && <p style={{ margin: 0, color: 'var(--color-brick)', fontSize: 'var(--text-sm)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <button className="primary" disabled={saving || !start || !end} onClick={() => save(false)}>Save dates</button>
        <button disabled={saving} onClick={onCancel}>Cancel</button>
        {item.planned_start && <button disabled={saving} onClick={() => save(true)}>Clear dates</button>}
      </div>
    </div>
  );
}

function ItemRow({ item, timeline, canEdit, onChanged }) {
  const [editing, setEditing] = useState(false);
  const delay = delayText(item.delay_days);
  const facts = [
    `Planned ${item.planned_start ? `${formatDate(item.planned_start)} – ${formatDate(item.planned_end)}` : 'dates not set'}`,
    item.actual_start && `started ${formatDate(item.actual_start)}`,
    item.actual_finish && `finished ${formatDate(item.actual_finish)}${delay ? ` (${delay})` : ''}`,
    !item.actual_finish && item.forecast_finish && `forecast finish ${formatDate(item.forecast_finish)}${delay ? ` (${delay})` : ''}`,
    !item.actual_finish && !item.forecast_finish && delay && delay,
    item.schedule_status === 'late_start' && 'no progress reported yet',
  ].filter(Boolean);

  return (
    <div className="ticket" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>{item.description}</p>
          <p className="numeric" style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)' }}>
            {formatQty(item.done_qty)} / {formatQty(item.quantity)} {item.unit} · {item.pct_complete}% done
            {item.pct_expected != null && !item.actual_finish ? ` (plan ${item.pct_expected}%)` : ''}
          </p>
        </div>
        <StatusPill status={item.schedule_status} />
      </div>

      <TimelineBar item={item} timeline={timeline} />

      <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: LATE.has(item.schedule_status) ? 'var(--color-brick)' : 'var(--color-aggregate)' }}>
        {facts.join(' · ')}
      </p>

      {canEdit && (editing ? (
        <DatesEditor item={item} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); }} />
      ) : (
        <div>
          <button onClick={() => setEditing(true)} style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)' }}>
            {item.planned_start ? 'Change dates' : 'Set dates'}
          </button>
        </div>
      ))}
    </div>
  );
}

export function SchedulePage({ projectId, canEdit }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lateOnly, setLateOnly] = useState(false);

  const load = useCallback(() => {
    apiFetch('/api/schedule', { params: { project_id: projectId } })
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const timeline = useTimeline(items);
  const counts = Object.fromEntries(STATUS_ORDER.map((k) => [k, items.filter((i) => i.schedule_status === k).length]));
  const lateCount = items.filter((i) => LATE.has(i.schedule_status)).length;
  const shown = lateOnly ? items.filter((i) => LATE.has(i.schedule_status)) : items;

  const sections = [];
  for (const item of shown) {
    let section = sections.find((s) => s.id === item.section_id);
    if (!section) sections.push(section = { id: item.section_id, name: item.section_name, items: [] });
    section.items.push(item);
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--space-6) var(--space-5)' }}>
      <h1 style={{ marginBottom: 'var(--space-2)' }}>Schedule</h1>
      <p style={{ color: 'var(--color-aggregate)', marginTop: 0 }}>
        Planned dates against progress reported on site. Bars: planned period (filled by % done),
        actual work below it, dashed line to the forecast finish, red line for today.
      </p>

      {loading && <p style={{ color: 'var(--color-aggregate)' }}>Loading schedule…</p>}
      {error && (
        <div className="ticket" style={{ borderColor: 'var(--color-brick)' }}>
          <p style={{ color: 'var(--color-brick)', margin: 0 }}>{error}</p>
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="ticket"><p style={{ margin: 0, color: 'var(--color-aggregate)' }}>No BOQ items to schedule yet.</p></div>
      )}

      {items.length > 0 && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center', margin: 'var(--space-4) 0' }}>
            {STATUS_ORDER.filter((k) => counts[k] > 0).map((k) => (
              <span key={k} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 'var(--text-sm)' }}>
                <StatusPill status={k} /> <span className="numeric">{counts[k]}</span>
              </span>
            ))}
            {lateCount > 0 && (
              <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 'var(--text-sm)', marginLeft: 'auto' }}>
                <input type="checkbox" checked={lateOnly} onChange={(e) => setLateOnly(e.target.checked)} style={{ width: 'auto' }} />
                Late items only
              </label>
            )}
          </div>

          {sections.map((section) => (
            <section key={section.id}>
              <div className="ledger-header"><h3>{section.name}</h3></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {section.items.map((item) => (
                  <ItemRow key={item.boq_item_id} item={item} timeline={timeline} canEdit={canEdit} onChanged={load} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
