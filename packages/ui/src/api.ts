import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

export const fetchDashboard = () => api.get('/dashboard')
export const fetchKeys = () => api.get('/keys')
export const createKey = (data: any) => api.post('/keys', data)
export const deleteKey = (id: string) => api.delete(`/keys/${id}`)
export const fetchSessions = () => api.get('/sessions')
export const fetchSession = (id: string) => api.get(`/sessions/${id}`)
export const fetchAnalysis = (sessionId: string) => api.get(`/analysis/${sessionId}`)

export default api
