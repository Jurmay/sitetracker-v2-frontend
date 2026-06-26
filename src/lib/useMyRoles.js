import { useEffect, useState } from 'react';
import { apiFetch } from './apiClient';

/**
 * Fetches the current user's active role(s) on a project, via the
 * /my-role endpoint added alongside the Financial screens (there was
 * no prior way for the frontend to know this - a real gap).
 */
export function useMyRoles(projectId) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    apiFetch(`/api/projects/${projectId}/my-role`)
      .then((res) => setRoles(res.roles))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  return { roles, loading, error, hasRole: (r) => roles.includes(r) };
}
