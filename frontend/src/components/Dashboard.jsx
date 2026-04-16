import { useState, useEffect } from 'react'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts'
import { fetchStats, fetchRecentRequests, fetchTopIssues, fetchEfficiencyTrend } from '../api'

const COLORS = ['#10a37f', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']

function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recentRequests, setRecentRequests] = useState([])
  const [topIssues, setTopIssues] = useState([])
  const [trend, setTrend] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [statsData, requestsData, issuesData, trendData] = await Promise.all([
        fetchStats(),
        fetchRecentRequests(10),
        fetchTopIssues(5),
        fetchEfficiencyTrend(7)
      ])
      setStats(statsData)
      setRecentRequests(requestsData)
      setTopIssues(issuesData)
      setTrend(trendData)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const getScoreClass = (score) => {
    if (score >= 90) return 'score-a'
    if (score >= 70) return 'score-b'
    if (score >= 50) return 'score-c'
    return 'score-d'
  }

  const getScoreLabel = (score) => {
    if (score >= 90) return 'A'
    if (score >= 70) return 'B'
    if (score >= 50) return 'C'
    return 'D'
  }

  if (loading) {
    return <div className="loading">Loading dashboard...</div>
  }

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Monitor your LLM traffic and optimize context usage</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Today's Requests</div>
          <div className="stat-value">{formatNumber(stats?.today_requests || 0)}</div>
          <div className="stat-change positive">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17l5-5 5 5M12 12V3" />
            </svg>
            Real-time
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Today's Tokens</div>
          <div className="stat-value">{formatNumber(stats?.today_tokens || 0)}</div>
          <div className="stat-change">
            Across all APIs
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active API Keys</div>
          <div className="stat-value">{stats?.total_api_keys || 0}</div>
          <div className="stat-change">
            Configured
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Efficiency</div>
          <div className="stat-value">{stats?.average_efficiency || 0}%</div>
          <div className={`stat-change ${(stats?.average_efficiency || 0) >= 70 ? 'positive' : 'negative'}`}>
            {(stats?.average_efficiency || 0) >= 70 ? 'Good' : 'Needs improvement'}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Efficiency Trend (7 days)</h3>
        </div>
        <div className="card-body">
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { weekday: 'short' })}
                />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip 
                  formatter={(value) => [`${value}%`, 'Efficiency']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Line 
                  type="monotone" 
                  dataKey="avg_score" 
                  stroke="#10a37f" 
                  strokeWidth={2}
                  dot={{ fill: '#10a37f', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Requests & Top Issues */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Requests</h3>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Tokens</th>
                    <th>Pattern</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRequests.slice(0, 8).map((req) => (
                    <tr key={req.id}>
                      <td>{req.model}</td>
                      <td>{formatNumber(req.total_tokens)}</td>
                      <td>
                        <span className={`badge badge-${
                          req.detected_pattern === 'full_context' ? 'warning' :
                          req.detected_pattern === 'sliding_window' ? 'success' :
                          req.detected_pattern === 'summarization' ? 'info' : 'secondary'
                        }`}>
                          {req.detected_pattern?.replace('_', ' ') || 'unknown'}
                        </span>
                      </td>
                      <td>
                        {req.efficiency_score ? (
                          <div className="score">
                            <div className={`score-circle ${getScoreClass(req.efficiency_score)}`}>
                              {getScoreLabel(req.efficiency_score)}
                            </div>
                            <span>{req.efficiency_score}%</span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top Optimization Opportunities</h3>
          </div>
          <div className="card-body">
            {topIssues.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🎉</div>
                <p>No major issues found. Your context usage looks good!</p>
              </div>
            ) : (
              topIssues.map((issue, idx) => (
                <div key={idx} className="suggestion-item">
                  <div className="suggestion-header">
                    <span className="suggestion-title">{issue.suggestion.title}</span>
                    <span className={`badge badge-${
                      issue.suggestion.severity === 'high' ? 'danger' :
                      issue.suggestion.severity === 'medium' ? 'warning' : 'info'
                    }`}>
                      {issue.suggestion.severity}
                    </span>
                  </div>
                  <div className="suggestion-desc">{issue.suggestion.description}</div>
                  <div className="suggestion-meta">
                    <span>Model: {issue.model}</span>
                    <span>Efficiency: {issue.efficiency_score}%</span>
                    {issue.suggestion.estimated_savings_percent && (
                      <span style={{ color: '#10a37f' }}>
                        Save ~{issue.suggestion.estimated_savings_percent}%
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
