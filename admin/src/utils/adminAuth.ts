import { api } from '../api';

/** Accept admin token passed from widget login (cross-origin handoff). */
export function bootstrapAdminAuth(): boolean {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (token) {
    api.setToken(token);
    params.delete('token');
    const qs = params.toString();
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState({}, '', next);
    return true;
  }

  return !!localStorage.getItem('qc_admin_token');
}
