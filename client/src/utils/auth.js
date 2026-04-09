export function getToken() { return localStorage.getItem('app_token'); }
export function getUser() { const u = localStorage.getItem('app_user'); return u ? JSON.parse(u) : null; }
export function isAdmin() { return getUser()?.role === 'admin'; }
export function logout() { localStorage.removeItem('app_token'); localStorage.removeItem('app_user'); window.location.href = '/login'; }
export function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }
