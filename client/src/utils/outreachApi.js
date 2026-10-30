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

// Redirect to login on 401 (expired or invalid token)
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('app_token')
      localStorage.removeItem('app_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

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

// Lead sources (where a lead came from — colours its pipeline card)
export const getSources = () => api.get('/outreach/sources').then(r => r.data)
export const createSource = (data) => api.post('/outreach/sources', data).then(r => r.data)
export const updateSource = (id, data) => api.patch(`/outreach/sources/${id}`, data).then(r => r.data)
export const deleteSource = (id) => api.delete(`/outreach/sources/${id}`).then(r => r.data)

// Channels (where a touchpoint or reply happened — LinkedIn, Email, Phone call…)
export const getChannels = () => api.get('/outreach/channels').then(r => r.data)
export const createChannel = (data) => api.post('/outreach/channels', data).then(r => r.data)
export const updateChannel = (id, data) => api.patch(`/outreach/channels/${id}`, data).then(r => r.data)
export const deleteChannel = (id) => api.delete(`/outreach/channels/${id}`).then(r => r.data)

// Leads
export const getLeads = (params) => api.get('/outreach/leads', { params }).then(r => r.data)
export const createLead = (data) => api.post('/outreach/leads', data).then(r => r.data)
export const getLead = (id) => api.get(`/outreach/leads/${id}`).then(r => r.data)
export const updateLead = (id, data) => api.patch(`/outreach/leads/${id}`, data).then(r => r.data)
export const deleteLead = (id) => api.delete(`/outreach/leads/${id}`).then(r => r.data)
export const getTrashLeads = () => api.get('/outreach/trash').then(r => r.data)
export const restoreTrashLead = (id) => api.post(`/outreach/trash/restore/${id}`).then(r => r.data)
export const permanentDeleteLead = (id) => api.delete(`/outreach/trash/permanent/${id}`).then(r => r.data)

// Touchpoints
export const getTouchpoints = (leadId) => api.get(`/outreach/leads/${leadId}/touchpoints`).then(r => r.data)
export const upsertTouchpoint = (leadId, number, data) =>
  api.put(`/outreach/leads/${leadId}/touchpoints/${number}`, data).then(r => r.data)

// Dashboard
export const getDashboard = (params) => api.get('/outreach/dashboard', { params }).then(r => r.data)
export const getOverdueLeads = (params) => api.get('/outreach/overdue', { params }).then(r => r.data)
export const getActivity = (params) => api.get('/outreach/activity', { params }).then(r => r.data)
export const getActivityLeads = (params) => api.get('/outreach/activity/leads', { params }).then(r => r.data)

// Dashboard Cards
export const getDashboardCards = () => api.get('/outreach/dashboard/cards').then(r => r.data)
export const createDashboardCard = (data) => api.post('/outreach/dashboard/cards', data).then(r => r.data)
export const updateDashboardCard = (id, data) => api.patch(`/outreach/dashboard/cards/${id}`, data).then(r => r.data)
export const deleteDashboardCard = (id) => api.delete(`/outreach/dashboard/cards/${id}`).then(r => r.data)

// Export
export const exportCsv = (params) => api.get('/outreach/export/csv', { params, responseType: 'blob' }).then(r => r.data)
// Returns the printable report HTML (fetched with auth, so it can't be opened as a bare URL)
export const getExportPdfHtml = (params) =>
  api.get('/outreach/export/pdf', { params, responseType: 'text' }).then(r => r.data)

// Pipeline Stages
export const getPipelineStages = () => api.get('/outreach/pipeline-stages').then(r => r.data)
export const createPipelineStage = (data) => api.post('/outreach/pipeline-stages', data).then(r => r.data)
export const updatePipelineStage = (id, data) => api.patch(`/outreach/pipeline-stages/${id}`, data).then(r => r.data)
export const deletePipelineStage = (id) => api.delete(`/outreach/pipeline-stages/${id}`).then(r => r.data)
export const getOrphanedStages = () => api.get('/outreach/pipeline-stages/orphaned').then(r => r.data)
export const remapStage = (from, to) => api.post('/outreach/pipeline-stages/remap', { from, to }).then(r => r.data)

// Settings
export const getSettings = () => api.get('/outreach/settings').then(r => r.data)
export const updateSettings = (data) => api.patch('/outreach/settings', data).then(r => r.data)

// Lead Responses
export const getLeadResponses = (leadId) => api.get(`/outreach/leads/${leadId}/responses`).then(r => r.data)
export const createLeadResponse = (leadId, data) => api.post(`/outreach/leads/${leadId}/responses`, data).then(r => r.data)
export const deleteLeadResponse = (leadId, id) => api.delete(`/outreach/leads/${leadId}/responses/${id}`).then(r => r.data)

// Lead fields (built-in + custom, in form order)
export const getFields = (params) => api.get('/outreach/fields', { params }).then(r => r.data)
export const reorderFields = (ids) => api.patch('/outreach/fields/order', { ids }).then(r => r.data)

// Lead Custom Fields
export const getCustomFields = (params) => api.get('/outreach/custom-fields', { params }).then(r => r.data)
export const createCustomField = (data) => api.post('/outreach/custom-fields', data).then(r => r.data)
export const updateCustomField = (id, data) => api.patch(`/outreach/custom-fields/${id}`, data).then(r => r.data)
export const deleteCustomField = (id) => api.delete(`/outreach/custom-fields/${id}`).then(r => r.data)
