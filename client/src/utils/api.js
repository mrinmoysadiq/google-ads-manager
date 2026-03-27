import axios from 'axios'

// In production (Render), VITE_API_URL points to the deployed backend.
// In local dev, Vite proxies /api → localhost:5001 automatically.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Sessions
export const createSession = (data) => api.post('/sessions', data).then(r => r.data)
export const getSession = (id) => api.get(`/sessions/${id}`).then(r => r.data)
export const completeSession = (id) => api.patch(`/sessions/${id}/complete`).then(r => r.data)

// Slide responses
export const saveSlideResponse = (data) => api.post('/slides', data).then(r => r.data)
export const getSlideResponses = (sessionId) => api.get(`/slides/${sessionId}`).then(r => r.data)

// Change log
export const saveChangeLog = (data) => api.post('/changelog', data).then(r => r.data)

export const getChangeLogs = (filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      params.append(key, val)
    }
  })
  return api.get(`/changelog?${params.toString()}`).then(r => r.data)
}

export const exportChangeLogs = (filters = {}) => {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      params.append(key, val)
    }
  })
  return api.get(`/changelog/export?${params.toString()}`, { responseType: 'blob' }).then(r => r.data)
}

export const getLastAction = (account, section) =>
  api.get('/changelog/last-action', { params: { account, section } }).then(r => r.data)

// Admin - Accounts
export const getAccounts = () => api.get('/admin/accounts').then(r => r.data)
export const createAccount = (name) => api.post('/admin/accounts', { name }).then(r => r.data)
export const updateAccount = (id, data) => api.patch(`/admin/accounts/${id}`, data).then(r => r.data)
export const deleteAccount = (id) => api.delete(`/admin/accounts/${id}`).then(r => r.data)

// Admin - Team Members
export const getTeamMembers = () => api.get('/admin/team-members').then(r => r.data)
export const createTeamMember = (name) => api.post('/admin/team-members', { name }).then(r => r.data)
export const updateTeamMember = (id, data) => api.patch(`/admin/team-members/${id}`, data).then(r => r.data)

export default api
