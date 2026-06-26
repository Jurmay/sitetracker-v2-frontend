import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiClient';

export function ProjectPickerPage({ onSelectProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch('/api/projects')
      .then(setProjects)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-aggregate)' }}>Loading your projects…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--space-6) var(--space-5)' }}>
      <h1 style={{ marginBottom: 'var(--space-2)' }}>Select a project</h1>
      <p style={{ color: 'var(--color-aggregate)', marginTop: 0, marginBottom: 'var(--space-6)' }}>
        Choose which project to work in.
      </p>

      {error && (
        <div className="ticket" style={{ borderColor: 'var(--color-brick)', marginBottom: 'var(--space-5)' }}>
          <p style={{ color: 'var(--color-brick)', margin: 0 }}>{error}</p>
        </div>
      )}

      {!error && projects.length === 0 && (
        <div className="ticket">
          <p style={{ color: 'var(--color-aggregate)', margin: 0 }}>
            You don't have access to any project yet. Contact your Company Owner or Admin
            to be added to one.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelectProject(p.id)}
            className="ticket"
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              textAlign: 'left', cursor: 'pointer', width: '100%',
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--text-lg)' }}>{p.name}</p>
              {p.location && (
                <p style={{ margin: '4px 0 0', color: 'var(--color-aggregate)', fontSize: 'var(--text-sm)' }}>
                  {p.location}
                </p>
              )}
            </div>
            <span style={{ color: 'var(--color-aggregate)' }}>{p.status}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
