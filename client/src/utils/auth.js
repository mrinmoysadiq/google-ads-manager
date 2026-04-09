export function getToken() { return localStorage.getItem('app_token'); }
export function getUser() {
  try {
    const u = localStorage.getItem('app_user');
    return u ? JSON.parse(u) : null;
  } catch {
    localStorage.removeItem('app_user');
    return null;
  }
}
export function isAdmin() { return getUser()?.role === 'admin'; }
export function logout() { localStorage.removeItem('app_token'); localStorage.removeItem('app_user'); window.location.href = '/login'; }
export function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }
