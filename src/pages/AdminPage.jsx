import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';

// Admin, in four parts: Approvals (money waiting for a decision), People
// (who has access and what they can do), Project setup (BOQ) and Activity
// (who changed what). Role rules (only an Owner grants Owner, same company
// only, at least one Owner) are enforced by the database; this page only
// hides choices that would be refused.

const ROLES = [
  { key: 'company_owner', label: 'Company Owner', does: 'Everything an Admin can do, plus create projects and add or remove owners.' },
  { key: 'admin', label: 'Admin', does: 'Approves advances and fund requests, sets up the BOQ, manages people, purchasing and client bills.' },
  { key: 'site_coordinator', label: 'Site Coordinator', does: 'Sends the master roll and progress reports, records deliveries, asks for site advances.' },
  { key: 'cashier', label: 'Cashier', does: 'Verifies and pays out advances, checks settlements, asks for funds, records client payments.' },
  { key: 'viewer', label: 'Viewer', does: 'Read only. Financial reports only if granted under Report access.' },
];
const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.key, r.label]));
const CATEGORY_LABEL = { work_tied: 'Work item', subcontract: 'Subcontract', overhead: 'Overhead' };

const ENTITY_LABEL = {
  project_roles: 'role', advance_requisitions: 'advance', advance_requisition_actions: 'advance step',
  advance_settlements: 'settlement', fund_requisitions: 'fund request', fund_receipts: 'fund receipt',
  progress_reports: 'progress report', progress_corrections: 'progress correction', master_roll_entries: 'master roll',
  boq_items: 'BOQ item', boq_sections: 'BOQ section', boq_variations: 'BOQ variation', purchase_orders: 'purchase order',
  goods_receipts: 'delivery', suppliers: 'supplier', client_bills: 'client bill', client_bill_payments: 'client payment',
  labourers: 'worker', projects: 'project', project_settings: 'project settings',
};

function money(n) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n ?? 0);
}
function formatDate(iso, withTime = false) {
  if (!iso) return '—';
  const d = new Date(iso);
  return withTime
    ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Thimphu' })
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Thimphu' });
}

function Notice({ error, success }) {
  if (error) {
    return (
      <div role="alert" className="ticket ticket--accent-brick" style={{ marginBottom: 'var(--space-4)' }}>
        <p style={{ color: 'var(--color-brick)', margin: 0 }}>{error}</p>
      </div>
    );
  }
  if (success) {
    return (
      <div role="status" className="ticket ticket--accent-survey" style={{ marginBottom: 'var(--space-4)' }}>
        <p style={{ color: 'var(--color-survey-deep)', margin: 0, fontWeight: 600 }}>{success}</p>
      </div>
    );
  }
  return null;
}

function SectionTitle({ title, note }) {
  return (
    <div className="ledger-header">
      <h3>{title}</h3>
      {note && <span className="ledger-header-note">{note}</span>}
    </div>
  );
}

const small = { padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)' };

// ---------------------------------------------------------------- approvals

function DecisionCard({ title, lines, busy, onApprove, onReject }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <div className="ticket" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: '1 1 220px' }}>
          <p style={{ margin: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>{title}</p>
          {lines.map((l) => (
            <p key={l} className="numeric" style={{ margin: '4px 0 0', color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>{l}</p>
          ))}
        </div>
        {!rejecting && (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="primary" disabled={busy} onClick={onApprove}>Approve</button>
            <button disabled={busy} onClick={() => setRejecting(true)}>Reject</button>
          </div>
        )}
      </div>
      {rejecting && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-sm)' }}>
            Reason for rejecting (they will see this)
            <input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </label>
          <button disabled={busy || !reason.trim()} onClick={() => onReject(reason.trim())}>Reject</button>
          <button onClick={() => { setRejecting(false); setReason(''); }}>Cancel</button>
        </div>
      )}
    </div>
  );
}

function Approvals({ projectId }) {
  const [advances, setAdvances] = useState([]);
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const load = useCallback(() => {
    Promise.all([
      apiFetch('/api/financial/advances', { params: { project_id: projectId } }),
      apiFetch('/api/financial/fund-requisitions', { params: { project_id: projectId } }),
    ])
      .then(([a, f]) => { setAdvances(a); setFunds(f); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  async function act(id, path, body, done) {
    setBusyId(id); setError(null); setSuccess(null);
    try {
      const result = await apiFetch(path, { method: 'POST', body });
      if (result && result._email_warning) setError(result._email_warning);
      else setSuccess(done);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const pendingAdvances = advances.filter((a) => a.status === 'pending_approval');
  const pendingFunds = funds.filter((f) => f.status === 'pending_approval');
  const who = (r) => [r.requested_by_name && `by ${r.requested_by_name}`, r.created_at && formatDate(r.created_at, true)].filter(Boolean).join(' · ');

  if (loading) return <p style={{ color: 'var(--color-aggregate)' }}>Loading…</p>;
  return (
    <>
      <Notice error={error} success={success} />
      <SectionTitle title="Advances" note="checked by the cashier · approving lets the cashier pay out" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        {pendingAdvances.length === 0 && <p style={{ color: 'var(--color-aggregate)', fontStyle: 'italic' }}>Nothing waiting.</p>}
        {pendingAdvances.map((a) => (
          <DecisionCard key={a.id} title={a.justification} busy={busyId === a.id}
            lines={[`Nu. ${money(a.amount)} · ${CATEGORY_LABEL[a.advance_category] ?? a.advance_category}`, who(a)].filter(Boolean)}
            onApprove={() => act(a.id, `/api/financial/advances/${a.id}/approve`, {}, 'Advance approved.')}
            onReject={(remarks) => act(a.id, `/api/financial/advances/${a.id}/reject`, { remarks }, 'Advance rejected.')} />
        ))}
      </div>
      <SectionTitle title="Fund requests" note="approving records the money in and emails Accounts if set up" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {pendingFunds.length === 0 && <p style={{ color: 'var(--color-aggregate)', fontStyle: 'italic' }}>Nothing waiting.</p>}
        {pendingFunds.map((f) => (
          <DecisionCard key={f.id} title={f.reason} busy={busyId === f.id}
            lines={[`Nu. ${money(f.amount)}`, who(f)].filter(Boolean)}
            onApprove={() => act(f.id, `/api/financial/fund-requisitions/${f.id}/approve`, {}, 'Fund request approved.')}
            onReject={(reason) => act(f.id, `/api/financial/fund-requisitions/${f.id}/reject`, { reason }, 'Fund request rejected.')} />
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- people

function ReportAccess({ projectId, member }) {
  const [permissions, setPermissions] = useState(null);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch(`/api/dashboard/permissions/${member.user_id}`, { params: { project_id: projectId } })
      .then(setPermissions)
      .catch((err) => setError(err.message));
  }, [projectId, member.user_id]);

  async function toggle(p) {
    setSaving(p.report_key); setError(null);
    try {
      await apiFetch('/api/dashboard/permissions', {
        method: 'PUT', params: { project_id: projectId },
        body: { user_id: member.user_id, report_definition_key: p.report_key, granted: !p.granted },
      });
      setPermissions((prev) => prev.map((x) => (x.report_key === p.report_key ? { ...x, granted: !p.granted } : x)));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  if (error) return <p style={{ color: 'var(--color-brick)', fontSize: 'var(--text-sm)', margin: 0 }}>{error}</p>;
  if (!permissions) return <p style={{ color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)', margin: 0 }}>Loading report access…</p>;
  if (permissions.length === 0) return <p style={{ color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)', margin: 0 }}>No reports set up for this person yet.</p>;
  return (
    <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
      <legend style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-aggregate)', marginBottom: 'var(--space-2)' }}>
        Reports and dashboard cards they can see
      </legend>
      {permissions.map((p) => (
        <label key={p.report_key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minHeight: 40, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          <input type="checkbox" checked={p.granted} disabled={saving === p.report_key} onChange={() => toggle(p)}
            style={{ width: 20, height: 20, margin: 0, flexShrink: 0, accentColor: 'var(--color-primary)' }} />
          <span style={{ flex: 1 }}>{p.report_name}</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-aggregate)' }}>{p.category}</span>
        </label>
      ))}
    </fieldset>
  );
}

function MemberCard({ member, me, canGrantOwner, projectId, onChanged, onMessage }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(null); // role key being removed
  const [addRole, setAddRole] = useState('');
  const [showReports, setShowReports] = useState(false);

  const active = member.roles.filter((r) => r.status === 'active').map((r) => r.role);
  const removed = member.roles.filter((r) => r.status !== 'active').map((r) => r.role);
  const addable = ROLES.filter((r) => !active.includes(r.key) && (r.key !== 'company_owner' || canGrantOwner));
  const isMe = member.user_id === me;

  async function call(path, body, done) {
    setBusy(true); onMessage(null, null);
    try {
      await apiFetch(path, { method: 'POST', body: { project_id: projectId, ...body } });
      onMessage(null, done);
      setConfirming(null); setAddRole('');
      onChanged();
    } catch (err) {
      onMessage(err.message, null);
    } finally {
      setBusy(false);
    }
  }
  const setRole = (role, on) => call('/api/admin/users/role-status', { user_id: member.user_id, role, active: on },
    on ? `${member.name} is now ${ROLE_LABEL[role]}.` : `${ROLE_LABEL[role]} removed from ${member.name}.`);
  const canChange = (role) => role !== 'company_owner' || canGrantOwner;

  let status;
  if (member.invite_pending) status = `Invite sent ${formatDate(member.invited_at)}, not accepted yet`;
  else if (member.last_sign_in_at) status = `Last signed in ${formatDate(member.last_sign_in_at)}`;
  else status = 'Never signed in';

  return (
    <div className="ticket" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', opacity: member.has_active_role ? 1 : 0.85 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{member.name}{isMe && <span style={{ color: 'var(--color-aggregate)', fontWeight: 400 }}> (you)</span>}</p>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)', overflowWrap: 'anywhere' }}>{member.email}</p>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: member.invite_pending ? 'var(--color-primary-deep)' : 'var(--color-aggregate)' }}>{status}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {member.invite_pending && <button style={small} disabled={busy} onClick={() => call('/api/admin/users/resend-invite', { user_id: member.user_id }, `Invite sent again to ${member.email}.`)}>Resend invite</button>}
          {!member.invite_pending && !isMe && <button style={small} disabled={busy} onClick={() => call('/api/admin/users/reset-password', { email: member.email }, `Password reset email sent to ${member.email}.`)}>Send password reset</button>}
          {member.has_active_role && <button style={small} aria-expanded={showReports} onClick={() => setShowReports(!showReports)}>{showReports ? 'Hide report access' : 'Report access'}</button>}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {active.length === 0 && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)' }}>No access to this project.</span>}
        {active.map((role) => (
          <span key={role} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', padding: '2px 4px 2px 10px', borderRadius: 999, border: '1.5px solid var(--color-aggregate-light)', fontSize: 'var(--text-sm)' }}>
            {ROLE_LABEL[role] ?? role}
            {canChange(role) && !(isMe && (role === 'admin' || role === 'company_owner')) && confirming !== role && (
              <button aria-label={`Remove ${ROLE_LABEL[role]} from ${member.name}`} style={{ ...small, padding: '0 8px' }} disabled={busy} onClick={() => setConfirming(role)}>Remove</button>
            )}
          </span>
        ))}
      </div>
      {confirming && (
        <div className="ticket ticket--sunken" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap', padding: 'var(--space-3) var(--space-4)' }}>
          <span style={{ flex: '1 1 220px', fontSize: 'var(--text-sm)' }}>
            Remove <strong>{ROLE_LABEL[confirming]}</strong> from {member.name}? {active.length === 1 ? 'They will lose access to this project.' : 'Their other roles stay.'}
          </span>
          <button disabled={busy} onClick={() => setRole(confirming, false)}>Remove</button>
          <button onClick={() => setConfirming(null)}>Cancel</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span>{active.length ? 'Add a role' : 'Give access as'}</span>
          <select value={addRole} onChange={(e) => setAddRole(e.target.value)} style={{ width: 'auto' }}>
            <option value="">Choose…</option>
            {addable.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </label>
        <button style={small} disabled={busy || !addRole} onClick={() => setRole(addRole, true)}>{active.length ? 'Add' : 'Give access'}</button>
        {removed.filter((r) => !active.includes(r)).length > 0 && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-aggregate)' }}>
            Removed before: {removed.filter((r) => !active.includes(r)).map((r) => ROLE_LABEL[r] ?? r).join(', ')}
          </span>
        )}
      </div>

      {showReports && <ReportAccess projectId={projectId} member={member} />}
    </div>
  );
}

function AddPerson({ projectId, members, canGrantOwner, onDone, onMessage }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('site_coordinator');
  const [busy, setBusy] = useState(false);
  const existing = members.find((m) => m.email && m.email.toLowerCase() === email.trim().toLowerCase());

  async function submit(e) {
    e.preventDefault();
    setBusy(true); onMessage(null, null);
    try {
      if (existing) {
        await apiFetch('/api/admin/users/assign-role', { method: 'POST', body: { project_id: projectId, email: email.trim(), role } });
        onMessage(null, `${existing.name} now has ${ROLE_LABEL[role]} access.`);
      } else {
        await apiFetch('/api/admin/users/invite', { method: 'POST', body: { project_id: projectId, email: email.trim(), name: name.trim(), role } });
        onMessage(null, `Invite sent to ${email.trim()}. They'll get an email to set their password.`);
      }
      setEmail(''); setName('');
      onDone();
    } catch (err) {
      onMessage(err.message, null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="ticket" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
      <p style={{ fontWeight: 600, margin: 0 }}>Add a person to this project</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-sm)' }}>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
        </label>
        {!existing && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-sm)' }}>
            Full name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        )}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-sm)' }}>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.filter((r) => r.key !== 'company_owner' || canGrantOwner).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </label>
      </div>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)' }}>
        {existing
          ? `${existing.name} already has an account in your company; they'll get access straight away.`
          : 'Someone new gets an email invite to set their own password. Nobody else sees it.'}
      </p>
      <button type="submit" className="primary" disabled={busy} style={{ alignSelf: 'flex-start' }}>
        {busy ? 'Working…' : existing ? 'Give access' : 'Send invite'}
      </button>
    </form>
  );
}

function People({ projectId }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showRoles, setShowRoles] = useState(false);

  const load = useCallback(() => {
    apiFetch('/api/admin/users/members', { params: { project_id: projectId } })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  const onMessage = (err, ok) => { setError(err); setSuccess(ok); };

  if (!data) return error ? <Notice error={error} /> : <p style={{ color: 'var(--color-aggregate)' }}>Loading people…</p>;
  const withAccess = data.members.filter((m) => m.has_active_role);
  const others = data.members.filter((m) => !m.has_active_role);

  return (
    <>
      <Notice error={error} success={success} />
      <AddPerson projectId={projectId} members={data.members} canGrantOwner={data.can_grant_owner} onDone={load} onMessage={onMessage} />

      <button style={{ ...small, marginBottom: 'var(--space-4)' }} aria-expanded={showRoles} onClick={() => setShowRoles(!showRoles)}>
        {showRoles ? 'Hide what each role can do' : 'What can each role do?'}
      </button>
      {showRoles && (
        <dl className="ticket ticket--sunken" style={{ margin: '0 0 var(--space-5)', display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) 1fr', gap: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-sm)' }}>
          {ROLES.map((r) => (
            <div key={r.key} style={{ display: 'contents' }}>
              <dt style={{ fontWeight: 600 }}>{r.label}</dt>
              <dd style={{ margin: 0, color: 'var(--color-aggregate)' }}>{r.does}</dd>
            </div>
          ))}
        </dl>
      )}

      <SectionTitle title={`With access (${withAccess.length})`} note={data.can_grant_owner ? 'you are an Owner' : 'only an Owner can add or remove owners'} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        {withAccess.map((m) => (
          <MemberCard key={m.user_id} member={m} me={user?.id} canGrantOwner={data.can_grant_owner} projectId={projectId} onChanged={load} onMessage={onMessage} />
        ))}
      </div>
      {others.length > 0 && (
        <>
          <SectionTitle title={`Others in your company (${others.length})`} note="no access to this project" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {others.map((m) => (
              <MemberCard key={m.user_id} member={m} me={user?.id} canGrantOwner={data.can_grant_owner} projectId={projectId} onChanged={load} onMessage={onMessage} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------- setup

function Setup({ projectId }) {
  const [sections, setSections] = useState([]);
  const [items, setItems] = useState([]);
  const [sectionName, setSectionName] = useState('');
  const [item, setItem] = useState({ section_id: '', description: '', unit: '', quantity: '', rate: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const load = useCallback(() => {
    apiFetch('/api/boq/sections', { params: { project_id: projectId } })
      .then(async (secs) => {
        setSections(secs);
        const lists = await Promise.all(secs.map((s) => apiFetch('/api/boq/items', { params: { section_id: s.id } })));
        setItems(lists.flat());
      })
      .catch((err) => setError(err.message));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  async function save(fn, done) {
    setBusy(true); setError(null); setSuccess(null);
    try { await fn(); setSuccess(done); load(); return true; } catch (err) { setError(err.message); return false; } finally { setBusy(false); }
  }
  const set = (k) => (e) => setItem({ ...item, [k]: e.target.value });
  const label = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-sm)' };

  return (
    <>
      <Notice error={error} success={success} />
      <p style={{ marginTop: 0, color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>
        For a won tender, “New project from won tender” on the project list loads the whole BOQ at once. Use this for small additions.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); save(() => apiFetch('/api/boq/sections', { method: 'POST', body: { project_id: projectId, name: sectionName.trim(), sort_order: sections.length } }), 'Section added.').then((ok) => ok && setSectionName('')); }}
        className="ticket" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        <label style={{ ...label, flex: '1 1 220px' }}>New section<input value={sectionName} onChange={(e) => setSectionName(e.target.value)} placeholder="e.g. Civil Works" required /></label>
        <button type="submit" className="primary" disabled={busy}>Add section</button>
      </form>
      <form onSubmit={(e) => { e.preventDefault(); save(() => apiFetch('/api/boq/items', { method: 'POST', body: { section_id: item.section_id, description: item.description.trim(), unit: item.unit.trim(), quantity: parseFloat(item.quantity), rate: parseFloat(item.rate) } }), 'Work item added.').then((ok) => ok && setItem({ ...item, description: '', unit: '', quantity: '', rate: '' })); }}
        className="ticket" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <p style={{ fontWeight: 600, margin: 0 }}>New work item</p>
        <label style={label}>Section
          <select value={item.section_id} onChange={set('section_id')} required>
            <option value="">Choose a section…</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label style={label}>Description<input value={item.description} onChange={set('description')} required /></label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-3)' }}>
          <label style={label}>Unit<input value={item.unit} onChange={set('unit')} placeholder="Cu.m" required /></label>
          <label style={label}>Quantity<input type="number" min="0" step="any" inputMode="decimal" value={item.quantity} onChange={set('quantity')} required /></label>
          <label style={label}>Rate (Nu.)<input type="number" min="0" step="any" inputMode="decimal" value={item.rate} onChange={set('rate')} required /></label>
        </div>
        <button type="submit" className="primary" disabled={busy} style={{ alignSelf: 'flex-start' }}>Add work item</button>
      </form>
      {sections.map((s) => {
        const list = items.filter((i) => i.section_id === s.id);
        return (
          <div key={s.id} style={{ marginBottom: 'var(--space-4)' }}>
            <p style={{ fontWeight: 700, fontSize: 'var(--text-sm)', margin: '0 0 var(--space-2)' }}>{s.name} <span style={{ fontWeight: 400, color: 'var(--color-aggregate)' }}>· {list.length} item{list.length === 1 ? '' : 's'}</span></p>
            {list.map((i) => (
              <div key={i.id} className="ticket" style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--text-sm)', minWidth: 0, overflowWrap: 'anywhere' }}>{i.description}</span>
                <span className="numeric" style={{ color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>{i.quantity} {i.unit} @ {money(i.rate)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------- activity

function describe(row, names) {
  const what = ENTITY_LABEL[row.entity_type] ?? row.entity_type.replace(/_/g, ' ');
  const after = row.after_value ?? {};
  const before = row.before_value ?? {};
  if (row.entity_type === 'project_roles') {
    const person = names[after.user_id ?? before.user_id] ?? 'someone';
    const role = ROLE_LABEL[after.role ?? before.role] ?? 'a role';
    if (row.action_type === 'insert') return `gave ${person} the ${role} role`;
    if (row.action_type === 'update' && before.status !== after.status) {
      return after.status === 'active' ? `gave ${person} the ${role} role back` : `removed ${role} from ${person}`;
    }
    if (row.action_type === 'delete') return `deleted ${person}'s ${role} role`;
  }
  if (row.action_type === 'update' && before.status && after.status && before.status !== after.status) {
    return `changed a ${what} from ${before.status.replace(/_/g, ' ')} to ${after.status.replace(/_/g, ' ')}`;
  }
  const verb = { insert: 'added', update: 'updated', delete: 'deleted' }[row.action_type] ?? row.action_type;
  return `${verb} a ${what}`;
}

function Activity({ projectId }) {
  const [rows, setRows] = useState(null);
  const [names, setNames] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/admin/users/activity', { params: { project_id: projectId, limit: 150 } }),
      apiFetch('/api/admin/users/members', { params: { project_id: projectId } }),
    ])
      .then(([acts, people]) => {
        setRows(acts);
        setNames(Object.fromEntries(people.members.map((m) => [m.user_id, m.name])));
      })
      .catch((err) => setError(err.message));
  }, [projectId]);

  if (error) return <Notice error={error} />;
  if (!rows) return <p style={{ color: 'var(--color-aggregate)' }}>Loading activity…</p>;
  return (
    <>
      <p style={{ marginTop: 0, color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>
        Every change on this project is recorded automatically and can't be edited. Showing the latest {rows.length}.
      </p>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {rows.map((r) => (
          <li key={r.id} className="ticket" style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', gap: 'var(--space-3)', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-sm)', minWidth: 0 }}><strong>{r.actor_name}</strong> {describe(r, names)}</span>
            <time dateTime={r.created_at} className="numeric" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-aggregate)', whiteSpace: 'nowrap' }}>{formatDate(r.created_at, true)}</time>
          </li>
        ))}
      </ol>
    </>
  );
}

// ---------------------------------------------------------------- page

const PARTS = [
  { key: 'approvals', label: 'Approvals' },
  { key: 'people', label: 'People' },
  { key: 'setup', label: 'Project setup' },
  { key: 'activity', label: 'Activity' },
];

export function AdminPage({ projectId }) {
  const [part, setPart] = useState('approvals');
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: 'var(--space-6) var(--space-5)' }}>
      <h1 style={{ marginBottom: 'var(--space-4)' }}>Admin</h1>
      <div role="tablist" aria-label="Admin sections" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
        {PARTS.map((p) => (
          <button key={p.key} role="tab" aria-selected={part === p.key} onClick={() => setPart(p.key)}
            className={part === p.key ? 'primary' : undefined} style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--text-sm)' }}>
            {p.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {part === 'approvals' && <Approvals projectId={projectId} />}
        {part === 'people' && <People projectId={projectId} />}
        {part === 'setup' && <Setup projectId={projectId} />}
        {part === 'activity' && <Activity projectId={projectId} />}
      </div>
    </div>
  );
}
