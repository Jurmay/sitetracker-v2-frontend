import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// Project settings: one page per project, Admin and Company Owner only.
// Reads and writes project_settings directly through Supabase; row-level
// security already limits updates to the project's admins and owners, and
// every saved change is written to audit_log (trg_audit_project_settings).
//
// Times are stored as "hours after Bhutan midnight" (e.g. 18 = 6:00 pm),
// the same unit the reminder and lock jobs use.

const FIELDS = [
  'lock_master_roll_enabled', 'master_roll_lock_hours', 'master_roll_reminder_hours',
  'lock_progress_report_enabled', 'progress_report_lock_hours', 'progress_report_reminder_hours',
  'lock_settlement_enabled', 'settlement_grace_days',
  'cash_replenishment_threshold_pct', 'accounts_department_email', 'max_upload_size_mb',
];

const LABELS = {
  lock_master_roll_enabled: 'Require today\'s master roll',
  master_roll_lock_hours: 'Master roll lock time',
  master_roll_reminder_hours: 'Master roll reminder time',
  lock_progress_report_enabled: 'Require today\'s progress report',
  progress_report_lock_hours: 'Progress report lock time',
  progress_report_reminder_hours: 'Progress report reminder time',
  lock_settlement_enabled: 'Settle old advances first',
  settlement_grace_days: 'Days allowed to settle',
  cash_replenishment_threshold_pct: 'Low cash alert',
  accounts_department_email: 'Accounts department email',
  max_upload_size_mb: 'Largest photo upload',
};

function hourLabel(h) {
  const n = Number(h);
  if (n === 0 || n === 24) return '12:00 am';
  if (n === 12) return '12:00 pm';
  return n < 12 ? `${n}:00 am` : `${n - 12}:00 pm`;
}
const HOURS = Array.from({ length: 17 }, (_, i) => i + 7); // 7 am .. 11 pm

function show(field, value) {
  if (value === true) return 'on';
  if (value === false) return 'off';
  if (field.endsWith('_hours')) return hourLabel(value);
  if (field.endsWith('_days')) return `${value} days`;
  if (field.endsWith('_pct')) return `${Number(value)}%`;
  if (field.endsWith('_mb')) return `${value} MB`;
  return value || 'none';
}

function Switch({ on, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{
        width: 46, height: 26, minWidth: 46, padding: 0, borderRadius: 13, position: 'relative',
        border: 'none', boxShadow: 'none', transform: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: on ? 'var(--color-survey)' : 'var(--color-aggregate-light)',
        transition: 'background 0.15s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: '50%',
        background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
      }} />
    </button>
  );
}

function Row({ title, note, control, dim, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap',
      padding: 'var(--space-3) 0', borderTop: '1px solid var(--color-aggregate-faint)',
    }}>
      {control}
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>{title}</p>
        {note && <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)' }}>{note}</p>}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', opacity: dim ? 0.4 : 1 }}>{children}</div>
    </div>
  );
}

function Group({ title, note, children }) {
  return (
    <section className="ticket" style={{ padding: 'var(--space-2) var(--space-4)' }}>
      <h3 style={{ margin: 'var(--space-3) 0 2px' }}>{title}</h3>
      {note && <p style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)' }}>{note}</p>}
      {children}
    </section>
  );
}

function HourSelect({ value, onChange, label, disabled }) {
  return (
    <select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} style={{ width: 130 }}>
      {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
    </select>
  );
}

export function SettingsPage({ projectId }) {
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setError(null);
    const { data, error: e } = await supabase.from('project_settings').select(FIELDS.join(', ')).eq('project_id', projectId).maybeSingle();
    if (e) { setError(e.message); return; }
    if (!data) { setError('No settings found for this project.'); return; }
    setSaved(data);
    setForm({ ...data, accounts_department_email: data.accounts_department_email ?? '' });
    const { data: log } = await supabase.from('audit_log')
      .select('created_at, actor_id, before_value, after_value')
      .eq('entity_type', 'project_settings').eq('project_id', projectId)
      .order('created_at', { ascending: false }).limit(5);
    setHistory(log || []);
  }
  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!form) {
    return <div style={{ padding: 'var(--space-5)' }}>{error ? <p role="alert" style={{ color: 'var(--color-brick)' }}>{error}</p> : <p style={{ color: 'var(--color-aggregate)' }}>Loading settings…</p>}</div>;
  }

  const set = (k) => (v) => { setSuccess(null); setForm({ ...form, [k]: v }); };
  const changed = FIELDS.filter((f) => String(form[f] ?? '') !== String(saved[f] ?? ''));

  function problems() {
    const p = [];
    if (form.master_roll_reminder_hours >= form.master_roll_lock_hours) p.push('The master roll reminder must come before its lock time.');
    if (form.progress_report_reminder_hours >= form.progress_report_lock_hours) p.push('The progress report reminder must come before its lock time.');
    const days = Number(form.settlement_grace_days);
    if (!Number.isInteger(days) || days < 1 || days > 60) p.push('Days allowed to settle must be a whole number from 1 to 60.');
    const pct = Number(form.cash_replenishment_threshold_pct);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) p.push('Low cash alert must be between 0 and 100%.');
    const email = String(form.accounts_department_email || '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) p.push('The accounts email doesn\'t look like an email address.');
    return p;
  }

  async function save() {
    const p = problems();
    if (p.length) { setError(p.join(' ')); return; }
    setSaving(true); setError(null); setSuccess(null);
    const patch = {};
    changed.forEach((f) => {
      let v = form[f];
      if (f === 'accounts_department_email') v = String(v).trim() || null;
      else if (f === 'cash_replenishment_threshold_pct') v = Number(v);
      else if (f.endsWith('_days') || f.endsWith('_mb') || f.endsWith('_hours')) v = Number(v);
      patch[f] = v;
    });
    const { data, error: e } = await supabase.from('project_settings').update(patch).eq('project_id', projectId).select('project_id');
    setSaving(false);
    if (e) { setError(e.message); return; }
    if (!data || data.length === 0) { setError('Not saved. Only an Admin or Company Owner of this project can change settings.'); return; }
    setSuccess(`Saved ${changed.length} change${changed.length === 1 ? '' : 's'}. They apply straight away.`);
    load();
  }

  const offCount = ['lock_master_roll_enabled', 'lock_progress_report_enabled', 'lock_settlement_enabled'].filter((k) => !form[k]).length;

  return (
    <div style={{ padding: '0 var(--space-5) var(--space-6)', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div>
        <h1 style={{ margin: 0 }}>Project settings</h1>
        <p style={{ margin: 'var(--space-1) 0 0', color: 'var(--color-aggregate)' }}>
          Rules for this project only. Other projects keep their own settings. Billing terms are on the Bills page.
        </p>
      </div>

      {offCount > 0 && (
        <div className="ticket ticket--accent-brick" style={{ padding: 'var(--space-3) var(--space-4)' }}>
          <p style={{ margin: 0 }}>
            {offCount} site discipline rule{offCount === 1 ? ' is' : 's are'} off. Coordinators can raise advances without {offCount === 1 ? 'it' : 'them'}.
          </p>
        </div>
      )}

      <Group title="Site discipline" note="When a rule is on and not met, the coordinator can't raise a new advance until they catch up.">
        <Row
          title={LABELS.lock_master_roll_enabled}
          note="Blocks new advances if today's master roll isn't sent by the lock time."
          control={<Switch on={form.lock_master_roll_enabled} onChange={set('lock_master_roll_enabled')} label={LABELS.lock_master_roll_enabled} />}
          dim={!form.lock_master_roll_enabled}
        >
          <HourSelect label={LABELS.master_roll_lock_hours} value={form.master_roll_lock_hours} onChange={set('master_roll_lock_hours')} disabled={!form.lock_master_roll_enabled} />
        </Row>
        <Row
          title={LABELS.lock_progress_report_enabled}
          note="Same rule for the daily progress report."
          control={<Switch on={form.lock_progress_report_enabled} onChange={set('lock_progress_report_enabled')} label={LABELS.lock_progress_report_enabled} />}
          dim={!form.lock_progress_report_enabled}
        >
          <HourSelect label={LABELS.progress_report_lock_hours} value={form.progress_report_lock_hours} onChange={set('progress_report_lock_hours')} disabled={!form.lock_progress_report_enabled} />
        </Row>
        <Row
          title={LABELS.lock_settlement_enabled}
          note="Blocks new advances while an earlier paid advance is overdue for settling."
          control={<Switch on={form.lock_settlement_enabled} onChange={set('lock_settlement_enabled')} label={LABELS.lock_settlement_enabled} />}
          dim={!form.lock_settlement_enabled}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
            <input type="number" min="1" max="60" step="1" value={form.settlement_grace_days} disabled={!form.lock_settlement_enabled}
              onChange={(e) => set('settlement_grace_days')(e.target.value)} style={{ width: 80 }} aria-label={LABELS.settlement_grace_days} />
            days
          </label>
        </Row>
      </Group>

      <Group title="Reminders" note="Emails to the coordinator if today's entry isn't in yet. A second, final reminder follows later in the day.">
        <Row title={LABELS.master_roll_reminder_hours} note="Must be earlier than the master roll lock time.">
          <HourSelect label={LABELS.master_roll_reminder_hours} value={form.master_roll_reminder_hours} onChange={set('master_roll_reminder_hours')} />
        </Row>
        <Row title={LABELS.progress_report_reminder_hours} note="Must be earlier than the progress report lock time.">
          <HourSelect label={LABELS.progress_report_reminder_hours} value={form.progress_report_reminder_hours} onChange={set('progress_report_reminder_hours')} />
        </Row>
      </Group>

      <Group title="Money and files">
        <Row title={LABELS.cash_replenishment_threshold_pct} note="Flags the project when site cash falls below this share of funds received.">
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
            <input type="number" min="0" max="100" step="1" value={form.cash_replenishment_threshold_pct}
              onChange={(e) => set('cash_replenishment_threshold_pct')(e.target.value)} style={{ width: 80 }} aria-label={LABELS.cash_replenishment_threshold_pct} />
            %
          </label>
        </Row>
        <Row title={LABELS.accounts_department_email} note="Gets a copy of each approved fund request. Leave empty for none.">
          <input type="email" value={form.accounts_department_email} placeholder="accounts@company.bt"
            onChange={(e) => set('accounts_department_email')(e.target.value)} style={{ width: 240 }} aria-label={LABELS.accounts_department_email} />
        </Row>
        <Row title={LABELS.max_upload_size_mb} note="Bigger photos are refused on upload.">
          <select value={form.max_upload_size_mb} onChange={(e) => set('max_upload_size_mb')(Number(e.target.value))} style={{ width: 100 }} aria-label={LABELS.max_upload_size_mb}>
            {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n} MB</option>)}
          </select>
        </Row>
      </Group>

      {error && <div role="alert" className="ticket ticket--accent-brick" style={{ padding: 'var(--space-3) var(--space-4)' }}><p style={{ margin: 0, color: 'var(--color-brick)' }}>{error}</p></div>}
      {success && <div role="status" className="ticket ticket--accent-survey" style={{ padding: 'var(--space-3) var(--space-4)' }}><p style={{ margin: 0, color: 'var(--color-survey-deep)', fontWeight: 600 }}>{success}</p></div>}

      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="primary" disabled={saving || changed.length === 0} onClick={save}>
          {saving ? 'Saving…' : changed.length ? `Save ${changed.length} change${changed.length === 1 ? '' : 's'}` : 'No changes'}
        </button>
        {changed.length > 0 && <button onClick={() => { setForm({ ...saved, accounts_department_email: saved.accounts_department_email ?? '' }); setError(null); }}>Undo changes</button>}
      </div>

      <section>
        <h3 style={{ margin: '0 0 var(--space-2)' }}>Recent changes</h3>
        {history.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>No changes recorded yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {history.map((h, i) => {
              const diffs = FIELDS.filter((f) => h.before_value && h.after_value && String(h.before_value[f]) !== String(h.after_value[f]));
              return (
                <div key={i} className="ticket ticket--sunken" style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)' }}>
                  <p className="numeric" style={{ margin: 0, color: 'var(--color-aggregate)' }}>
                    {new Date(h.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Thimphu' })}
                  </p>
                  {diffs.length === 0 ? <p style={{ margin: 0 }}>Billing terms or other details changed</p> : diffs.map((f) => (
                    <p key={f} style={{ margin: 0 }}>{LABELS[f]}: {show(f, h.before_value[f])} → <strong>{show(f, h.after_value[f])}</strong></p>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
