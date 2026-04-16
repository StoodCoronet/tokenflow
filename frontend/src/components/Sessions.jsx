import { useState, useEffect } from 'react'
import { fetchSessions } from '../api'

function Sessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      const data = await fetchSessions()
      setSessions(data)
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString()
  }

  const formatDuration = (start, end) => {
    if (!start || !end) return '-'
    const diff = new Date(end) - new Date(start)
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m`
  }

  const getScoreClass = (score) => {
    if (!score) return ''
    if (score >= 90) return 'score-a'
    if (score >= 70) return 'score-b'
    if (score >= 50) return 'score-c'
    return 'score-d'
  }

  const getScoreLabel = (score) => {
    if (!score) return '-'
    if (score >= 90) return 'A'
    if (score >= 70) return 'B'
    if (score >= 50) return 'C'
    return 'D'
  }

  const getPatternBadge = (pattern) => {
    const badges = {
      'full_context': { class: 'badge-warning', label: 'Full Context' },
      'sliding_window': { class: 'badge-success', label: 'Sliding Window' },
      'summarization': { class: 'badge-info', label: 'Summarization' },
      'rag': { class: 'badge-info', label: 'RAG' },
      'hierarchical': { class: 'badge-info', label: 'Hierarchical' },
      'selective': { class: 'badge-success', label: 'Selective' },
      'unknown': { class: 'badge-secondary', label: 'Unknown' },
    }
    return badges[pattern] || badges['unknown']
  }

  if (loading) {
    return <div className="loading">Loading sessions...</div>
  }

  return (
    <div>
      <div className="page-header">
        <h1>Sessions</h1>
        <p>Monitor conversation sessions and their context efficiency</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Active Sessions</h3>
          <span style={{ color: '#6e6e80', fontSize: '14px' }}>
            {sessions.length} sessions tracked
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Session ID</th>
                  <th>Messages</th>
                  <th>Tokens</th>
                  <th>Pattern</th>
                  <th>Efficiency</th>
                  <th>Potential Savings</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const badge = getPatternBadge(session.current_pattern)
                  return (
                    <tr key={session.session_id}>
                      <td>
                        <strong>{session.session_id.slice(0, 12)}...</strong>
                        <div style={{ fontSize: '12px', color: '#6e6e80' }}>
                          {formatDate(session.start_time)}
                        </div>
                      </td>
                      <td>{session.message_count}</td>
                      <td>
                        <div>{formatNumber(session.total_prompt_tokens + session.total_completion_tokens)}</div>
                        <div style={{ fontSize: '12px', color: '#6e6e80' }}>
                          P: {formatNumber(session.total_prompt_tokens)} / 
                          C: {formatNumber(session.total_completion_tokens)}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${badge.class}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td>
                        {session.current_efficiency_score ? (
                          <div className="score">
                            <div className={`score-circle ${getScoreClass(session.current_efficiency_score)}`}>
                              {getScoreLabel(session.current_efficiency_score)}
                            </div>
                            <span>{session.current_efficiency_score}%</span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        {session.optimization_potential ? (
                          <div>
                            <div style={{ color: '#ef4444', fontWeight: 500 }}>
                              {session.optimization_potential}%
                            </div>
                            <div style={{ fontSize: '12px', color: '#6e6e80' }}>
                              ~${session.estimated_savings_cost.toFixed(2)}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#10a37f' }}>Optimal</span>
                        )}
                      </td>
                      <td>{formatDuration(session.start_time, session.last_activity)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Session Insights */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginTop: '24px' }}>
        <div className="stat-card">
          <div className="stat-label">Avg Messages per Session</div>
          <div className="stat-value">
            {sessions.length > 0 
              ? Math.round(sessions.reduce((acc, s) => acc + s.message_count, 0) / sessions.length)
              : 0
            }
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Sessions Needing Optimization</div>
          <div className="stat-value" style={{ color: '#ef4444' }}>
            {sessions.filter(s => (s.optimization_potential || 0) > 20).length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Potential Savings</div>
          <div className="stat-value" style={{ color: '#10a37f' }}>
            ${sessions.reduce((acc, s) => acc + s.estimated_savings_cost, 0).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sessions
