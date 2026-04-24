import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

export const fetchDashboard = () => api.get('/dashboard')
export const fetchKeys = () => api.get('/keys')
export const createKey = (data: any) => api.post('/keys', data)
export const updateKey = (id: string, data: any) => api.put(`/keys/${id}`, data)
export const deleteKey = (id: string) => api.delete(`/keys/${id}`)
export const fetchSessions = (params?: Record<string, string>) => api.get('/sessions', { params })
export const fetchSessionStats = () => api.get('/sessions/stats')
export const fetchSession = (id: string) => api.get(`/sessions/${id}`)
export const fetchAnalysis = (sessionId: string) => api.get(`/analysis/${sessionId}`)
export const fetchConfig = () => api.get('/config')
export const updateConfig = (data: any) => api.put('/config', data)
export const fetchProviderModels = (name: string) => api.get(`/providers/${name}/models`)

export default api
