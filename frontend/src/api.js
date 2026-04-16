const API_BASE_URL = 'http://localhost:40001'

async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }
  
  return response.json()
}

// Dashboard
export const fetchStats = () => fetchAPI('/api/v1/dashboard/stats')
export const fetchRecentRequests = (limit = 50) => 
  fetchAPI(`/api/v1/dashboard/recent-requests?limit=${limit}`)
export const fetchTopIssues = (limit = 10) => 
  fetchAPI(`/api/v1/dashboard/top-issues?limit=${limit}`)
export const fetchEfficiencyTrend = (days = 7) => 
  fetchAPI(`/api/v1/dashboard/efficiency-trend?days=${days}`)

// API Keys
export const fetchAPIKeys = () => fetchAPI('/api/v1/keys')
export const createAPIKey = (data) => fetchAPI('/api/v1/keys', {
  method: 'POST',
  body: JSON.stringify(data),
})
export const deleteAPIKey = (id) => fetchAPI(`/api/v1/keys/${id}`, {
  method: 'DELETE',
})

// Sessions
export const fetchSessions = () => fetchAPI('/api/v1/analysis/sessions')

// Analysis
export const fetchAnalysisReport = (apiKeyId, days = 7) => 
  fetchAPI(`/api/v1/analysis/report?${apiKeyId ? `api_key_id=${apiKeyId}&` : ''}days=${days}`)
export const fetchPatternDistribution = (days = 7) => 
  fetchAPI(`/api/v1/analysis/patterns?days=${days}`)
export const fetchSavingsSummary = () => fetchAPI('/api/v1/analysis/savings')

// Settings
export const fetchSettings = () => fetchAPI('/api/v1/settings')
export const updateSettings = (data) => fetchAPI('/api/v1/settings', {
  method: 'PUT',
  body: JSON.stringify(data),
})
