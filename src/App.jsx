import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useMyRoles } from './lib/useMyRoles';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MasterRollPage } from './pages/MasterRollPage';
import { ProgressPage } from './pages/ProgressPage';
import { AdvancesPage } from './pages/AdvancesPage';
import { CashierPage } from './pages/CashierPage';
import { AdminPage } from './pages/AdminPage';

// Tabs visible to every role for now - restricting visibility properly
// belongs to the per-user report-permission grid (Phase 3 design), which
// has no frontend UI yet. The two financial tabs below ARE conditioned
// on role, since their underlying actions are meaningfully different per
// role (a Coordinator submitting vs a Cashier verifying), not just a
// visibility preference.
const BASE_TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'master-roll', label: 'Master Roll' },
  { key: 'progress', label: 'Progress' },
];

function NavBar({ tabs, activeTab, onChangeTab, onSignOut }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'var(--space-3) var(--space-5)', borderBottom: 'var(--border-width) solid var(--color-ink)',
        background: 'var(--color-paper-raised)', flexWrap: 'wrap', gap: 'var(--space-2)',
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChangeTab(tab.key)}
            className={activeTab === tab.key ? 'primary' : ''}
            style={{ padding: 'var(--space-2) var(--space-4)' }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <button onClick={onSignOut}>Sign out</button>
    </div>
  );
}

function AppShell() {
  const { user, loading, signOut } = useAuth();
  // Project selection is hardcoded as a placeholder for this scaffolding
  // pass - a real project picker (for users with access to multiple
  // projects, per the Company Owner / multi-project design) is a
  // follow-up piece, not yet built.
  const [projectId] = useState(() => new URLSearchParams(window.location.search).get('project_id'));
  const [activeTab, setActiveTab] = useState('dashboard');
  const { roles, hasRole } = useMyRoles(projectId);

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-aggregate)' }}>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (!projectId) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-5)' }}>
        <div className="ticket" style={{ maxWidth: 420 }}>
          <h2>No project selected</h2>
          <p style={{ color: 'var(--color-aggregate)' }}>
            Add <code>?project_id=&lt;uuid&gt;</code> to the URL for now. A proper
            project picker is not yet built in this scaffolding pass.
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    ...BASE_TABS,
    ...(hasRole('site_coordinator') ? [{ key: 'advances', label: 'Advances' }] : []),
    ...(hasRole('cashier') ? [{ key: 'cashier', label: 'Cashier' }] : []),
    ...(hasRole('admin') || hasRole('company_owner') ? [{ key: 'admin', label: 'Admin' }] : []),
  ];

  return (
    <div>
      <NavBar tabs={tabs} activeTab={activeTab} onChangeTab={setActiveTab} onSignOut={signOut} />
      {activeTab === 'dashboard' && <DashboardPage projectId={projectId} />}
      {activeTab === 'master-roll' && <MasterRollPage projectId={projectId} />}
      {activeTab === 'progress' && <ProgressPage projectId={projectId} />}
      {activeTab === 'advances' && hasRole('site_coordinator') && <AdvancesPage projectId={projectId} />}
      {activeTab === 'cashier' && hasRole('cashier') && <CashierPage projectId={projectId} />}
      {activeTab === 'admin' && (hasRole('admin') || hasRole('company_owner')) && <AdminPage projectId={projectId} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
