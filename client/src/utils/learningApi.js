import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

// ── Settings ──────────────────────────────────────────────────────────────────
export const getSettings = () => api.get('/learning/settings').then(r => r.data)
export const updateSetting = (key, value) => api.patch('/learning/settings', { key, value }).then(r => r.data)

// ── Roles ─────────────────────────────────────────────────────────────────────
export const getRoles = () => api.get('/learning/roles').then(r => r.data)
export const createRole = (name) => api.post('/learning/roles', { name }).then(r => r.data)
export const deleteRole = (id) => api.delete(`/learning/roles/${id}`).then(r => r.data)

// ── Users ─────────────────────────────────────────────────────────────────────
export const getLearningUsers = () => api.get('/learning/users').then(r => r.data)
export const createLearningUser = (data) => api.post('/learning/users', data).then(r => r.data)
export const updateLearningUser = (id, data) => api.patch(`/learning/users/${id}`, data).then(r => r.data)
export const getUserStats = (id) => api.get(`/learning/users/${id}/stats`).then(r => r.data)

// ── Entries ───────────────────────────────────────────────────────────────────
export const getEntries = (params) => api.get('/learning/entries', { params }).then(r => r.data)
export const createEntry = (data) => api.post('/learning/entries', data).then(r => r.data)
export const updateEntry = (id, data) => api.patch(`/learning/entries/${id}`, data).then(r => r.data)
export const deleteEntry = (id) => api.delete(`/learning/entries/${id}`).then(r => r.data)

// ── Manager ───────────────────────────────────────────────────────────────────
export const getManagerOverview = (managerId) => api.get(`/learning/manager/${managerId}/overview`).then(r => r.data)
export const getManagerFeed = (managerId, params) => api.get(`/learning/manager/${managerId}/feed`, { params }).then(r => r.data)

// ── Threads ───────────────────────────────────────────────────────────────────
export const getThreads = (entryId) => api.get(`/learning/threads/${entryId}`).then(r => r.data)
export const postThread = (data) => api.post('/learning/threads', data).then(r => r.data)
