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

// Improvement #2 & #3: human-readable role labels + page titles
const ROLE_LABELS = {
  company_owner: 'Company Owner',
  admin: 'Admin',
  site_coordinator: 'Site Coordinator',
  cashier: 'Cashier',
  viewer: 'Viewer',
};

const TAB_TITLES = {
  dashboard: 'Dashboard',
  'master-roll': 'Master Roll',
  progress: 'Progress',
  reports: 'Reports',
  advances: 'Advances',
  cashier: 'Cashier',
  admin: 'Admin',
};

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

// Improvement #6: fixed mobile navigation - role badge in top bar,
// tabs moved to a dedicated bottom-style tab row with proper sizing
function NavBar({ tabs, activeTab, onChangeTab, onSignOut, onSwitchProject, roles }) {
  const primaryRole = roles[0];
  const roleLabel = primaryRole ? ROLE_LABELS[primaryRole] : null;

  return (
    <>
      {/* Top bar: identity strip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-2) var(--space-4)',
        background: 'var(--color-paper-raised)',
        borderBottom: '1px solid var(--color-aggregate-light)',
        boxShadow: 'var(--shadow-resting)',
        position: 'relative',
        zIndex: 10,
        gap: 'var(--space-2)',
        flexWrap: 'wrap',
        minHeight: 48,
      }}>
        {/* Left: app name + role badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'var(--text-base)',
            letterSpacing: '-0.01em',
          }}>
            SiteTracker
          </span>
          {/* Improvement #2: role badge always visible in top bar */}
          {roleLabel && (
            <span style={{
              display: 'inline-block',
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '2px 8px',
              borderRadius: 4,
              background: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              lineHeight: 1.6,
              whiteSpace: 'nowrap',
            }}>
              {roleLabel}
            </span>
          )}
        </div>

        {/* Right: theme picker + actions */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexShrink: 0 }}>
          <ThemePicker />
          <button
            onClick={onSwitchProject}
            style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)' }}
          >
            Switch
          </button>
          <button
            onClick={onSignOut}
            style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)' }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Improvement #6: dedicated tab row, scrollable on small screens,
          tabs are evenly sized with minimum touch target height */}
      <div style={{
        display: 'flex',
        overflowX: 'auto',
        background: 'var(--color-paper-raised)',
        borderBottom: '2px solid var(--color-aggregate-faint)',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        position: 'sticky',
        top: 0,
        zIndex: 9,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChangeTab(tab.key)}
              aria-pressed={isActive}
              style={{
                flex: '1 0 auto',
                minWidth: 72,
                minHeight: 48,
                padding: 'var(--space-2) var(--space-3)',
                fontSize: 'var(--text-sm)',
                fontWeight: isActive ? 700 : 600,
                border: 'none',
                borderBottom: isActive
                  ? '3px solid var(--color-primary)'
                  : '3px solid transparent',
                borderRadius: 0,
                background: isActive ? 'var(--color-paper-sunken)' : 'transparent',
                color: isActive ? 'var(--color-primary)' : 'var(--color-aggregate)',
                boxShadow: 'none',
                transform: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'color 0.14s, border-color 0.14s, background 0.14s',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Improvement #3: current page title shown below the tab strip */}
      <div style={{
        padding: 'var(--space-3) var(--space-5) var(--space-2)',
        background: 'var(--color-paper)',
      }}>
        <p style={{
          margin: 0,
          fontSize: 'var(--text-xs)',
          textTransform: 'uppercase',
          letterSpacing: '0.09em',
          color: 'var(--color-aggregate)',
          fontWeight: 700,
          fontFamily: 'var(--font-body)',
        }}>
          {TAB_TITLES[activeTab] ?? ''}
        </p>
      </div>
    </>
  );
}

function AppShell() {
  const { user, loading, signOut } = useAuth();
  const [projectId, setProjectId] = useState(() => new URLSearchParams(window.location.search).get('project_id'));
  const [activeTab, setActiveTab] = useState('dashboard');
  const { roles, hasRole } = useMyRoles(projectId);

  function selectProject(id) {
    setProjectId(id);
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

  if (!user) return <LoginPage />;
  if (!projectId) return <ProjectPickerPage onSelectProject={selectProject} />;

  const tabs = [
    ...BASE_TABS,
    ...(hasRole('site_coordinator') ? [{ key: 'advances', label: 'Advances' }] : []),
    ...(hasRole('cashier') ? [{ key: 'cashier', label: 'Cashier' }] : []),
    ...(hasRole('admin') || hasRole('company_owner') ? [{ key: 'admin', label: 'Admin' }] : []),
  ];

  return (
    <div>
      <NavBar
        tabs={tabs}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onSignOut={signOut}
        onSwitchProject={switchProject}
        roles={roles}
      />
      <div style={{ paddingBottom: 'var(--space-8)' }}>
        {activeTab === 'dashboard' && <DashboardPage projectId={projectId} />}
        {activeTab === 'master-roll' && <MasterRollPage projectId={projectId} />}
        {activeTab === 'progress' && <ProgressPage projectId={projectId} />}
        {activeTab === 'reports' && <ReportsPage projectId={projectId} />}
        {activeTab === 'advances' && hasRole('site_coordinator') && <AdvancesPage projectId={projectId} />}
        {activeTab === 'cashier' && hasRole('cashier') && <CashierPage projectId={projectId} />}
        {activeTab === 'admin' && (hasRole('admin') || hasRole('company_owner')) && <AdminPage projectId={projectId} />}
      </div>
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
