import axios from 'axios'
import { getToken } from './auth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Specialists
export const getSpecialists = () => api.get('/outreach/specialists').then(r => r.data)
export const createSpecialist = (data) => api.post('/outreach/specialists', data).then(r => r.data)
export const updateSpecialist = (id, data) => api.patch(`/outreach/specialists/${id}`, data).then(r => r.data)
export const checkIsManager = (id) => api.get(`/outreach/specialists/${id}/is-manager`).then(r => r.data)

// Industries
export const getIndustries = () => api.get('/outreach/industries').then(r => r.data)
export const createIndustry = (data) => api.post('/outreach/industries', data).then(r => r.data)
export const updateIndustry = (id, data) => api.patch(`/outreach/industries/${id}`, data).then(r => r.data)
export const deleteIndustry = (id) => api.delete(`/outreach/industries/${id}`).then(r => r.data)

// Leads
export const getLeads = (params) => api.get('/outreach/leads', { params }).then(r => r.data)
export const createLead = (data) => api.post('/outreach/leads', data).then(r => r.data)
export const getLead = (id) => api.get(`/outreach/leads/${id}`).then(r => r.data)
export const updateLead = (id, data) => api.patch(`/outreach/leads/${id}`, data).then(r => r.data)
export const deleteLead = (id) => api.delete(`/outreach/leads/${id}`).then(r => r.data)

// Touchpoints
export const getTouchpoints = (leadId) => api.get(`/outreach/leads/${leadId}/touchpoints`).then(r => r.data)
export const upsertTouchpoint = (leadId, number, data) =>
  api.put(`/outreach/leads/${leadId}/touchpoints/${number}`, data).then(r => r.data)

// Dashboard
export const getDashboard = (params) => api.get('/outreach/dashboard', { params }).then(r => r.data)
export const getOverdueLeads = (params) => api.get('/outreach/overdue', { params }).then(r => r.data)
export const getActivity = (params) => api.get('/outreach/activity', { params }).then(r => r.data)

// Dashboard Cards
export const getDashboardCards = () => api.get('/outreach/dashboard/cards').then(r => r.data)
export const createDashboardCard = (data) => api.post('/outreach/dashboard/cards', data).then(r => r.data)
export const updateDashboardCard = (id, data) => api.patch(`/outreach/dashboard/cards/${id}`, data).then(r => r.data)
export const deleteDashboardCard = (id) => api.delete(`/outreach/dashboard/cards/${id}`).then(r => r.data)

// Export
export const exportCsv = (params) => api.get('/outreach/export/csv', { params, responseType: 'blob' }).then(r => r.data)
export const getExportPdfUrl = (params) => {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString()
  return `${api.defaults.baseURL}/outreach/export/pdf${qs ? '?' + qs : ''}`
}

// Pipeline Stages
export const getPipelineStages = () => api.get('/outreach/pipeline-stages').then(r => r.data)
export const createPipelineStage = (data) => api.post('/outreach/pipeline-stages', data).then(r => r.data)
export const updatePipelineStage = (id, data) => api.patch(`/outreach/pipeline-stages/${id}`, data).then(r => r.data)
export const deletePipelineStage = (id) => api.delete(`/outreach/pipeline-stages/${id}`).then(r => r.data)

// Settings
export const getSettings = () => api.get('/outreach/settings').then(r => r.data)
export const updateSettings = (data) => api.patch('/outreach/settings', data).then(r => r.data)

// Lead Responses
export const createLeadResponse = (leadId, data) => api.post(`/outreach/leads/${leadId}/responses`, data).then(r => r.data)
export const deleteLeadResponse = (leadId, id) => api.delete(`/outreach/leads/${leadId}/responses/${id}`).then(r => r.data)
