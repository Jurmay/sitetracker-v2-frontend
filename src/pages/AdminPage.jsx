import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';

// Improvement #1: Permission Checkboxes panel
// Fetches the report permission grid for a chosen user and lets admin
// toggle each report on/off via PUT /api/dashboard/permissions
function PermissionsPanel({ projectId }) {
  const [lookupEmail, setLookupEmail] = useState('');
  const [targetUser, setTargetUser] = useState(null); // { user_id, name, email, roles }
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Improvement: look the user up by EMAIL (not a raw UUID), then load
  // their permission grid. Uses the /api/admin/users/lookup endpoint.
  async function handleLookup(e) {
    e.preventDefault();
    if (!lookupEmail.trim()) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setPermissions([]);
    setTargetUser(null);

    try {
      const found = await apiFetch('/api/admin/users/lookup', {
        method: 'POST',
        body: { project_id: projectId, email: lookupEmail.trim() },
      });
      setTargetUser(found);

      const perms = await apiFetch(`/api/dashboard/permissions/${found.user_id}`, {
        params: { project_id: projectId },
      });
      setPermissions(perms);
      if (perms.length === 0) {
        setError('This user has no permission rows yet on this project.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function togglePermission(reportKey, currentlyGranted) {
    if (!targetUser) return;
    setSaving(reportKey);
    setError(null);
    try {
      await apiFetch('/api/dashboard/permissions', {
        method: 'PUT',
        params: { project_id: projectId },
        body: {
          user_id: targetUser.user_id,
          report_definition_key: reportKey,
          granted: !currentlyGranted,
        },
      });
      setPermissions((prev) =>
        prev.map((p) => (p.report_key === reportKey ? { ...p, granted: !currentlyGranted } : p))
      );
      setSuccess(`${!currentlyGranted ? 'Granted' : 'Revoked'}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  const byCategory = permissions.reduce((acc, p) => {
    const cat = p.category ?? 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const ROLE_LABELS = {
    company_owner: 'Company Owner', admin: 'Admin',
    site_coordinator: 'Site Coordinator', cashier: 'Cashier', viewer: 'Viewer',
  };

  return (
    <div>
      <div className="ledger-header" style={{ marginTop: 'var(--space-6)' }}>
        <h3>Report &amp; Dashboard Permissions</h3>
        <span className="ledger-header-note">control what each user can access</span>
      </div>

      {success && (
        <div className="ticket ticket--accent-survey" style={{ marginBottom: 'var(--space-4)' }}>
          <p style={{ color: 'var(--color-survey-deep)', margin: 0, fontSize: 'var(--text-sm)' }}>{success}</p>
        </div>
      )}
      {error && (
        <div className="ticket ticket--accent-brick" style={{ marginBottom: 'var(--space-4)' }}>
          <p style={{ color: 'var(--color-brick)', margin: 0, fontSize: 'var(--text-sm)' }}>{error}</p>
        </div>
      )}

      <form onSubmit={handleLookup} className="ticket" style={{ marginBottom: 'var(--space-4)' }}>
        <p style={{ fontWeight: 600, marginTop: 0, marginBottom: 'var(--space-1)' }}>
          View / edit a user&rsquo;s permissions
        </p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)', margin: '0 0 var(--space-3)' }}>
          Enter the user&rsquo;s email address.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <input
            type="email"
            value={lookupEmail}
            onChange={(e) => setLookupEmail(e.target.value)}
            placeholder="their@email.com"
            required
            style={{ flex: '1 1 180px' }}
          />
          <button type="submit" className="primary" disabled={loading} style={{ flexShrink: 0 }}>
            {loading ? 'Loading…' : 'Load'}
          </button>
        </div>
      </form>

      {targetUser && (
        <div className="ticket ticket--sunken" style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{targetUser.name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)' }}>
            {targetUser.email} &middot; {targetUser.roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')}
          </p>
        </div>
      )}

      {permissions.length > 0 && (
        <div className="ticket" style={{ marginBottom: 'var(--space-6)' }}>
          {Object.entries(byCategory).map(([category, perms]) => (
            <div key={category} style={{ marginBottom: 'var(--space-4)' }}>
              <p style={{
                fontWeight: 700, fontSize: 'var(--text-xs)', textTransform: 'uppercase',
                letterSpacing: '0.07em', color: 'var(--color-aggregate)', margin: '0 0 var(--space-2)',
              }}>
                {category}
              </p>
              {perms.map((p) => (
                <label
                  key={p.report_key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    padding: 'var(--space-3) 0', minHeight: 44,
                    borderBottom: '1px solid var(--color-aggregate-faint)', cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={p.granted}
                    disabled={saving === p.report_key}
                    onChange={() => togglePermission(p.report_key, p.granted)}
                    style={{ width: 20, height: 20, accentColor: 'var(--color-primary)', flexShrink: 0, margin: 0 }}
                  />
                  <span style={{ fontSize: 'var(--text-sm)', flex: 1 }}>{p.report_name}</span>
                  {saving === p.report_key
                    ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-aggregate)' }}>saving…</span>
                    : p.granted && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-survey-deep)', fontWeight: 600 }}>✓</span>}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminPage({ projectId }) {
  const { user } = useAuth();
  const [advances, setAdvances] = useState([]);
  const [fundRequisitions, setFundRequisitions] = useState([]);
  const [sections, setSections] = useState([]);
  const [boqItems, setBoqItems] = useState([]);

  const [newSectionName, setNewSectionName] = useState('');
  const [newItemSectionId, setNewItemSectionId] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newItemRate, setNewItemRate] = useState('');

  const [assignEmail, setAssignEmail] = useState('');
  const [assignRole, setAssignRole] = useState('site_coordinator');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('site_coordinator');
  const [resetEmail, setResetEmail] = useState('');

  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  function loadAll() {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      apiFetch('/api/financial/advances', { params: { project_id: projectId } }),
      apiFetch('/api/financial/fund-requisitions', { params: { project_id: projectId } }),
      apiFetch('/api/boq/sections', { params: { project_id: projectId } }),
    ])
      .then(async ([advs, freqs, secs]) => {
        setAdvances(advs);
        setFundRequisitions(freqs);
        setSections(secs);
        const itemLists = await Promise.all(secs.map((s) => apiFetch('/api/boq/items', { params: { section_id: s.id } })));
        setBoqItems(itemLists.flat());
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
      const result = await fn();
      if (result && result._email_warning) {
        setError(result._email_warning);
      } else {
        setSuccess('Action completed.');
      }
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId(null);
    }
  }

  async function handleRejectAdvance(id) {
    const remarks = window.prompt('Reason for rejecting this advance:');
    if (remarks) {
      runAction(id, () =>
        apiFetch(`/api/financial/advances/${id}/reject`, { method: 'POST', body: { remarks } })
      );
    }
  }

  async function handleCreateSection(e) {
    e.preventDefault();
    setError(null); setSuccess(null); setSubmitting(true);
    try {
      await apiFetch('/api/boq/sections', { method: 'POST', body: { project_id: projectId, name: newSectionName, sort_order: sections.length } });
      setSuccess('Section added.'); setNewSectionName(''); loadAll();
    } catch (err) { setError(err.message); } finally { setSubmitting(false); }
  }

  async function handleCreateItem(e) {
    e.preventDefault();
    setError(null); setSuccess(null); setSubmitting(true);
    try {
      await apiFetch('/api/boq/items', {
        method: 'POST',
        body: { section_id: newItemSectionId, description: newItemDescription, unit: newItemUnit, quantity: parseFloat(newItemQuantity), rate: parseFloat(newItemRate) },
      });
      setSuccess('Work item added.'); setNewItemDescription(''); setNewItemUnit(''); setNewItemQuantity(''); setNewItemRate(''); loadAll();
    } catch (err) { setError(err.message); } finally { setSubmitting(false); }
  }

  async function handleAssignRole(e) {
    e.preventDefault();
    setError(null); setSuccess(null); setSubmitting(true);
    try {
      await apiFetch('/api/admin/users/assign-role', { method: 'POST', body: { project_id: projectId, email: assignEmail, role: assignRole } });
      setSuccess(`${assignEmail} granted ${assignRole} on this project.`); setAssignEmail('');
    } catch (err) { setError(err.message); } finally { setSubmitting(false); }
  }

  async function handleInviteUser(e) {
    e.preventDefault();
    setError(null); setSuccess(null); setSubmitting(true);
    try {
      await apiFetch('/api/admin/users/invite', { method: 'POST', body: { project_id: projectId, email: inviteEmail, name: inviteName, role: inviteRole } });
      setSuccess(`Invite sent to ${inviteEmail}.`); setInviteEmail(''); setInviteName('');
    } catch (err) { setError(err.message); } finally { setSubmitting(false); }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setError(null); setSuccess(null); setSubmitting(true);
    try {
      await apiFetch('/api/admin/users/reset-password', { method: 'POST', body: { project_id: projectId, email: resetEmail } });
      setSuccess(`Password reset email sent to ${resetEmail}.`); setResetEmail('');
    } catch (err) { setError(err.message); } finally { setSubmitting(false); }
  }

  const pendingApproval = advances.filter((a) => a.status === 'pending_approval');
  const pendingFundApproval = fundRequisitions.filter((f) => f.status === 'pending_approval');

  const labelStyle = { display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: 'var(--space-6) var(--space-5)' }}>
      <h1 style={{ marginBottom: 'var(--space-6)' }}>Admin</h1>

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
          {/* Advances awaiting admin approval */}
          <div className="ledger-header">
            <h3>Advances awaiting your approval</h3>
            <span className="ledger-header-note">verified by Cashier · approving allows disbursement</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            {pendingApproval.length === 0 ? (
              <p style={{ color: 'var(--color-aggregate)', fontStyle: 'italic' }}>All caught up — nothing awaiting your approval.</p>
            ) : pendingApproval.map((a) => (
              <div key={a.id} className="ticket" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{a.justification}</p>
                  <p className="numeric" style={{ margin: '4px 0 0', color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>
                    Nu. {a.amount?.toLocaleString()} &middot; {a.advance_category}
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
                  <button disabled={actingId === a.id} onClick={() => handleRejectAdvance(a.id)}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Fund requisitions */}
          <div className="ledger-header">
            <h3>Fund requisitions awaiting your approval</h3>
            <span className="ledger-header-note">generates a receipt · emails Accounts if configured</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
            {pendingFundApproval.length === 0 ? (
              <p style={{ color: 'var(--color-aggregate)', fontStyle: 'italic' }}>All caught up — nothing awaiting approval.</p>
            ) : pendingFundApproval.map((f) => (
              <div key={f.id} className="ticket" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{f.reason}</p>
                  <p className="numeric" style={{ margin: '4px 0 0', color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>
                    Nu. {f.amount?.toLocaleString()}
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
          </div>

          {/* BOQ Setup */}
          <div className="ledger-header"><h3>BOQ setup</h3></div>

          <form onSubmit={handleCreateSection} className="ticket" style={{ marginBottom: 'var(--space-4)' }}>
            <p style={{ fontWeight: 600, marginTop: 0, marginBottom: 'var(--space-3)' }}>Add a section</p>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <input value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} placeholder="e.g. Civil Works" required style={{ flex: 1 }} />
              <button type="submit" className="primary" disabled={submitting}>Add section</button>
            </div>
          </form>

          <form onSubmit={handleCreateItem} className="ticket" style={{ marginBottom: 'var(--space-6)' }}>
            <p style={{ fontWeight: 600, marginTop: 0, marginBottom: 'var(--space-3)' }}>Add a work item</p>
            <label style={labelStyle}>Section</label>
            <select value={newItemSectionId} onChange={(e) => setNewItemSectionId(e.target.value)} required style={{ marginBottom: 'var(--space-3)' }}>
              <option value="">Select a section…</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label style={labelStyle}>Description</label>
            <input value={newItemDescription} onChange={(e) => setNewItemDescription(e.target.value)} required style={{ marginBottom: 'var(--space-3)' }} />
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Unit</label>
                <input value={newItemUnit} onChange={(e) => setNewItemUnit(e.target.value)} placeholder="sqm" required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Quantity</label>
                <input type="number" min="0" step="0.01" value={newItemQuantity} onChange={(e) => setNewItemQuantity(e.target.value)} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Rate</label>
                <input type="number" min="0" step="0.01" value={newItemRate} onChange={(e) => setNewItemRate(e.target.value)} required />
              </div>
            </div>
            <button type="submit" className="primary" disabled={submitting} style={{ width: '100%' }}>Add work item</button>
          </form>

          {boqItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
              {boqItems.map((item) => (
                <div key={item.id} className="ticket" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.description}</span>
                  <span className="numeric" style={{ color: 'var(--color-aggregate)' }}>
                    {item.quantity} {item.unit} &middot; {item.rate}/{item.unit}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Improvement #1: Permission Checkboxes panel */}
          <PermissionsPanel projectId={projectId} />

          {/* User Management */}
          <div className="ledger-header" style={{ marginTop: 'var(--space-6)' }}><h3>Users</h3></div>

          <form onSubmit={handleAssignRole} className="ticket" style={{ marginBottom: 'var(--space-4)' }}>
            <p style={{ fontWeight: 600, marginTop: 0, marginBottom: 'var(--space-1)' }}>Assign role to an existing user</p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)', marginTop: 0, marginBottom: 'var(--space-3)' }}>
              For someone who already has an account.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <input type="email" value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} placeholder="their@email.com" required style={{ flex: '2 1 160px' }} />
              <select value={assignRole} onChange={(e) => setAssignRole(e.target.value)} style={{ flex: '1 1 140px' }}>
                <option value="company_owner">Company Owner</option>
                <option value="admin">Admin</option>
                <option value="site_coordinator">Site Coordinator</option>
                <option value="cashier">Cashier</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="submit" className="primary" disabled={submitting} style={{ flexShrink: 0 }}>Assign</button>
            </div>
          </form>

          <form onSubmit={handleInviteUser} className="ticket" style={{ marginBottom: 'var(--space-4)' }}>
            <p style={{ fontWeight: 600, marginTop: 0, marginBottom: 'var(--space-1)' }}>Invite a new user</p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)', marginTop: 0, marginBottom: 'var(--space-3)' }}>
              For someone who has never logged in before. They'll receive an email to set their password.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
              <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Full name" required style={{ flex: '1 1 120px' }} />
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="their@email.com" required style={{ flex: '1 1 160px' }} />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ flex: '1 1 140px' }}>
                <option value="company_owner">Company Owner</option>
                <option value="admin">Admin</option>
                <option value="site_coordinator">Site Coordinator</option>
                <option value="cashier">Cashier</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button type="submit" className="primary" disabled={submitting} style={{ width: '100%' }}>Send invite</button>
          </form>

          <form onSubmit={handleResetPassword} className="ticket">
            <p style={{ fontWeight: 600, marginTop: 0, marginBottom: 'var(--space-1)' }}>Reset password</p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-aggregate)', marginTop: 0, marginBottom: 'var(--space-3)' }}>
              Sends a recovery email — no password is ever entered or shown here.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="their@email.com" required style={{ flex: 1 }} />
              <button type="submit" className="primary" disabled={submitting} style={{ flexShrink: 0 }}>Send reset email</button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
