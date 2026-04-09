export function getToken() { return localStorage.getItem('app_token'); }

// Decode JWT payload without verification — gives id, username, role without an API call
export function decodeToken() {
  try {
    const token = getToken();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload || null;
  } catch { return null; }
}
export function getUser() {
  try {
    const u = localStorage.getItem('app_user');
    if (!u) return null;
    const parsed = JSON.parse(u);
    // Reject empty objects — must have at least an id
    return (parsed && parsed.id) ? parsed : null;
  } catch {
    localStorage.removeItem('app_user');
    return null;
  }
}
export function isAdmin() { return getUser()?.role === 'admin'; }
export function logout() { localStorage.removeItem('app_token'); localStorage.removeItem('app_user'); window.location.href = '/login'; }
export function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }
