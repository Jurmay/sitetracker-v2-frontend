import { supabase } from './supabaseClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * Thin fetch wrapper for the FastAPI backend. Attaches the current
 * Supabase session's access token as a Bearer header automatically,
 * so every call is authenticated the same way the backend's
 * get_current_user dependency expects (see backend/app/core/deps.py).
 *
 * Throws on non-2xx responses with the backend's own `detail` message
 * surfaced, since every router was written to return a specific,
 * actionable detail string rather than a generic error.
 */
export async function apiFetch(path, { method = 'GET', body, params, raw = false } = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  let url = `${API_BASE_URL}${path}`;
  if (params) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    );
    url += `?${query.toString()}`;
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      detail = errorBody.detail ?? detail;
    } catch {
      // response body wasn't JSON (e.g. an error from a route that
      // normally returns a file) - keep the generic message
    }
    throw new Error(detail);
  }

  if (response.status === 204) return null;
  // raw=true: caller wants the actual binary content (PDF/CSV download),
  // not a parsed JSON object - returns a Blob, which the caller can hand
  // to URL.createObjectURL for a save-as download.
  if (raw) return response.blob();
  return response.json();
}
