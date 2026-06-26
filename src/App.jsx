import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

function AppShell() {
  const { user, loading } = useAuth();
  // Project selection is hardcoded as a placeholder for this scaffolding
  // pass - a real project picker (for users with access to multiple
  // projects, per the Company Owner / multi-project design) is a
  // follow-up piece, not yet built.
  const [projectId] = useState(() => new URLSearchParams(window.location.search).get('project_id'));

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

  return <DashboardPage projectId={projectId} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
