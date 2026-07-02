import axios from 'axios'
import { getToken } from './auth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Leads
export const getLinkedInLeads = (params) => api.get('/linkedin/leads', { params }).then(r => r.data)
export const createLinkedInLead = (data) => api.post('/linkedin/leads', data).then(r => r.data)
export const getLinkedInLead = (id) => api.get(`/linkedin/leads/${id}`).then(r => r.data)
export const updateLinkedInLead = (id, data) => api.patch(`/linkedin/leads/${id}`, data).then(r => r.data)
export const deleteLinkedInLead = (id) => api.delete(`/linkedin/leads/${id}`).then(r => r.data)
export const getLinkedInTrash = () => api.get('/linkedin/trash').then(r => r.data)
export const restoreLinkedInTrashLead = (id) => api.post(`/linkedin/trash/restore/${id}`).then(r => r.data)
export const permanentDeleteLinkedInLead = (id) => api.delete(`/linkedin/trash/permanent/${id}`).then(r => r.data)

// Engagements
export const getEngagements = (leadId) => api.get(`/linkedin/leads/${leadId}/engagements`).then(r => r.data)
export const createEngagement = (leadId, data) => api.post(`/linkedin/leads/${leadId}/engagements`, data).then(r => r.data)
export const deleteEngagement = (leadId, id) => api.delete(`/linkedin/leads/${leadId}/engagements/${id}`).then(r => r.data)

// Dashboard
export const getLinkedInDashboard = (params) => api.get('/linkedin/dashboard', { params }).then(r => r.data)
export const getStaleEngagementLeads = (params) => api.get('/linkedin/stale-engagement', { params }).then(r => r.data)
export const getLinkedInActivity = (params) => api.get('/linkedin/activity', { params }).then(r => r.data)
export const getLinkedInActivityLeads = (params) => api.get('/linkedin/activity/leads', { params }).then(r => r.data)

// Dashboard Cards
export const getLinkedInDashboardCards = () => api.get('/linkedin/dashboard/cards').then(r => r.data)
export const createLinkedInDashboardCard = (data) => api.post('/linkedin/dashboard/cards', data).then(r => r.data)
export const updateLinkedInDashboardCard = (id, data) => api.patch(`/linkedin/dashboard/cards/${id}`, data).then(r => r.data)
export const deleteLinkedInDashboardCard = (id) => api.delete(`/linkedin/dashboard/cards/${id}`).then(r => r.data)

// Pipeline Stages
export const getLinkedInPipelineStages = () => api.get('/linkedin/pipeline-stages').then(r => r.data)
export const createLinkedInPipelineStage = (data) => api.post('/linkedin/pipeline-stages', data).then(r => r.data)
export const updateLinkedInPipelineStage = (id, data) => api.patch(`/linkedin/pipeline-stages/${id}`, data).then(r => r.data)
export const deleteLinkedInPipelineStage = (id) => api.delete(`/linkedin/pipeline-stages/${id}`).then(r => r.data)

// Settings
export const getLinkedInSettings = () => api.get('/linkedin/settings').then(r => r.data)
export const updateLinkedInSettings = (data) => api.patch('/linkedin/settings', data).then(r => r.data)
