import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { fetchAnalysisReport, fetchPatternDistribution, fetchSavingsSummary } from '../api'

const COLORS = ['#10a37f', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']

function Analysis() {
  const [report, setReport] = useState(null)
  const [patterns, setPatterns] = useState([])
  const [savings, setSavings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(7)

  useEffect(() => {
    loadData()
  }, [days])

  const loadData = async () => {
    try {
      const [reportData, patternsData, savingsData] = await Promise.all([
        fetchAnalysisReport(null, days),
        fetchPatternDistribution(days),
        fetchSavingsSummary()
      ])
      setReport(reportData)
      setPatterns(patternsData)
      setSavings(savingsData)
    } catch (error) {
      console.error('Failed to load analysis data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  if (loading) {
    return <div className="loading">Loading analysis...</div>
  }

  return (
    <div>
      <div className="page-header">
        <h1>Analysis</h1>
        <p>Deep dive into your LLM usage efficiency and optimization opportunities</p>
      </div>

      {/* Time Range Selector */}
      <div style={{ marginBottom: '24px' }}>
        <select 
          value={days} 
          onChange={(e) => setDays(Number(e.target.value))}
          style={{
            padding: '10px 16px',
            border: '1px solid #e5e5e5',
            borderRadius: '6px',
            fontSize: '14px',
          }}
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      {/* Savings Overview */}
      {savings && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <h3 className="card-title">Savings Summary</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
              <div>
                <div style={{ fontSize: '13px', color: '#6e6e80', marginBottom: '8px' }}>Total Tokens</div>
                <div style={{ fontSize: '28px', fontWeight: 600 }}>{formatNumber(savings.total_tokens)}</div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: '#6e6e80', marginBottom: '8px' }}>Estimated Cost</div>
                <div style={{ fontSize: '28px', fontWeight: 600 }}>${savings.total_estimated_cost.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: '#6e6e80', marginBottom: '8px' }}>Potential Savings</div>
                <div style={{ fontSize: '28px', fontWeight: 600, color: '#10a37f' }}>
                  ${savings.total_potential_savings.toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: '#6e6e80', marginBottom: '8px' }}>Optimization Rate</div>
                <div style={{ fontSize: '28px', fontWeight: 600 }}>
                  {savings.total_estimated_cost > 0 
                    ? ((savings.total_potential_savings / savings.total_estimated_cost) * 100).toFixed(1)
                    : 0}%
                </div>
              </div>
            </div>

            {/* Per Key Breakdown */}
            <div style={{ marginTop: '24px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Per API Key Breakdown</h4>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Scenario</th>
                      <th>Tokens</th>
                      <th>Est. Cost</th>
                      <th>Efficiency</th>
                      <th>Potential Savings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savings.keys.map((key) => (
                      <tr key={key.api_key_id}>
                        <td><strong>{key.name}</strong></td>
                        <td>{key.scenario || '-'}</td>
                        <td>{formatNumber(key.total_tokens)}</td>
                        <td>${key.estimated_cost.toFixed(2)}</td>
                        <td>{key.current_efficiency}%</td>
                        <td style={{ color: '#10a37f', fontWeight: 500 }}>
                          ${key.potential_savings_cost.toFixed(2)} ({key.potential_savings_percent}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Pattern Distribution */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Context Pattern Distribution</h3>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={patterns}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ pattern, count }) => `${pattern}: ${count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    nameKey="pattern"
                  >
                    {patterns.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Efficiency by Pattern */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Efficiency by Pattern</h3>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={patterns} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <YAxis 
                    dataKey="pattern" 
                    type="category" 
                    tick={{ fontSize: 12 }}
                    width={100}
                  />
                  <Tooltip formatter={(value) => [`${value}%`, 'Efficiency']} />
                  <Bar dataKey="avg_efficiency" fill="#10a37f" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Top Suggestions */}
      {report?.top_suggestions && report.top_suggestions.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top Optimization Suggestions</h3>
          </div>
          <div className="card-body">
            {report.top_suggestions.map((suggestion, idx) => (
              <div key={idx} className="suggestion-item">
                <div className="suggestion-header">
                  <span className="suggestion-title">{suggestion.title}</span>
                  <span className={`badge badge-${
                    suggestion.severity === 'high' ? 'danger' :
                    suggestion.severity === 'medium' ? 'warning' : 'info'
                  }`}>
                    {suggestion.severity}
                  </span>
                </div>
                <div className="suggestion-desc">{suggestion.description}</div>
                <div className="suggestion-meta">
                  {suggestion.current_value && (
                    <span>Current: {suggestion.current_value}</span>
                  )}
                  {suggestion.suggested_value && (
                    <span style={{ color: '#10a37f' }}>Suggested: {suggestion.suggested_value}</span>
                  )}
                  {suggestion.estimated_savings_percent && (
                    <span style={{ color: '#10a37f', fontWeight: 500 }}>
                      Save ~{suggestion.estimated_savings_percent}%
                    </span>
                  )}
                </div>
                {suggestion.code_example && (
                  <pre className="code-block">{suggestion.code_example}</pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Analysis
