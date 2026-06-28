import { useEffect, useState } from 'react';
import { apiFetch } from './apiClient';
import { useAuth } from '../context/AuthContext';

/**
 * Fetches the current user's active role(s) on a project, via the
 * /my-role endpoint added alongside the Financial screens.
 *
 * BUG (reported by real user testing): this only re-fetched when
 * projectId changed. Signing out and signing back in as a DIFFERENT
 * user on the SAME project left the previous user's roles sitting in
 * state, since projectId never changed - so the nav bar kept showing
 * the old user's tabs (e.g. Admin) until an unrelated full page
 * refresh happened to reset all React state from scratch. Fixed by
 * also depending on the current user's id, and explicitly clearing
 * roles back to empty the instant either value changes, so there's
 * never a window where stale roles from a different person are shown
 * while the new fetch is still in flight.
 */
export function useMyRoles(projectId) {
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setRoles([]); // clear immediately - never show a stale, different user's roles while the new fetch is in flight
    if (!projectId || !user) return;
    setLoading(true);
    apiFetch(`/api/projects/${projectId}/my-role`)
      .then((res) => setRoles(res.roles))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId, user?.id]);

  return { roles, loading, error, hasRole: (r) => roles.includes(r) };
}
