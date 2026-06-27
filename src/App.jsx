import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { useMyRoles } from './lib/useMyRoles';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MasterRollPage } from './pages/MasterRollPage';
import { ProgressPage } from './pages/ProgressPage';
import { AdvancesPage } from './pages/AdvancesPage';
import { CashierPage } from './pages/CashierPage';
import { AdminPage } from './pages/AdminPage';
import { ReportsPage } from './pages/ReportsPage';
import { ProjectPickerPage } from './pages/ProjectPickerPage';

const BASE_TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'master-roll', label: 'Master Roll' },
  { key: 'progress', label: 'Progress' },
  { key: 'reports', label: 'Reports' },
];

function ThemePicker() {
  const { theme, setTheme, themes } = useTheme();
  return (
    <div className="theme-picker" role="group" aria-label="Choose color theme">
      {themes.map((t) => (
        <button
          key={t.key}
          className={`theme-swatch ${theme === t.key ? 'theme-swatch--active' : ''}`}
          style={{ background: t.swatchColor }}
          onClick={() => setTheme(t.key)}
          aria-label={`${t.label} theme`}
          aria-pressed={theme === t.key}
          title={t.label}
        />
      ))}
    </div>
  );
}

function NavBar({ tabs, activeTab, onChangeTab, onSignOut, onSwitchProject }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'var(--space-3) var(--space-5)',
        boxShadow: 'var(--shadow-resting)',
        position: 'relative', zIndex: 10,
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
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
        <ThemePicker />
        <button onClick={onSwitchProject}>Switch project</button>
        <button onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  );
}

function AppShell() {
  const { user, loading, signOut } = useAuth();
  const [projectId, setProjectId] = useState(() => new URLSearchParams(window.location.search).get('project_id'));
  const [activeTab, setActiveTab] = useState('dashboard');
  const { roles, hasRole } = useMyRoles(projectId);

  function selectProject(id) {
    setProjectId(id);
    // Persist the choice in the URL, matching the existing pattern (so
    // refreshing or sharing the link keeps working), without a full
    // page reload - history.replaceState keeps the in-memory React
    // state and the address bar in sync without re-running auth/data
    // fetches that a navigation would otherwise trigger.
    const url = new URL(window.location.href);
    url.searchParams.set('project_id', id);
    window.history.replaceState({}, '', url);
    setActiveTab('dashboard');
  }

  function switchProject() {
    setProjectId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('project_id');
    window.history.replaceState({}, '', url);
  }

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
    return <ProjectPickerPage onSelectProject={selectProject} />;
  }

  const tabs = [
    ...BASE_TABS,
    ...(hasRole('site_coordinator') ? [{ key: 'advances', label: 'Advances' }] : []),
    ...(hasRole('cashier') ? [{ key: 'cashier', label: 'Cashier' }] : []),
    ...(hasRole('admin') || hasRole('company_owner') ? [{ key: 'admin', label: 'Admin' }] : []),
  ];

  return (
    <div>
      <NavBar tabs={tabs} activeTab={activeTab} onChangeTab={setActiveTab} onSignOut={signOut} onSwitchProject={switchProject} />
      {activeTab === 'dashboard' && <DashboardPage projectId={projectId} />}
      {activeTab === 'master-roll' && <MasterRollPage projectId={projectId} />}
      {activeTab === 'progress' && <ProgressPage projectId={projectId} />}
      {activeTab === 'reports' && <ReportsPage projectId={projectId} />}
      {activeTab === 'advances' && hasRole('site_coordinator') && <AdvancesPage projectId={projectId} />}
      {activeTab === 'cashier' && hasRole('cashier') && <CashierPage projectId={projectId} />}
      {activeTab === 'admin' && (hasRole('admin') || hasRole('company_owner')) && <AdminPage projectId={projectId} />}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
}
