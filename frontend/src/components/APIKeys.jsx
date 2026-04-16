import { useState, useEffect } from 'react'
import { fetchAPIKeys, createAPIKey, deleteAPIKey } from '../api'

function APIKeys() {
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    provider: 'openai',
    upstream_key: '',
    base_url: 'https://api.openai.com/v1',
    scenario: '',
  })

  useEffect(() => {
    loadKeys()
  }, [])

  const loadKeys = async () => {
    try {
      const data = await fetchAPIKeys()
      setKeys(data)
    } catch (error) {
      console.error('Failed to load API keys:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await createAPIKey(formData)
      setShowForm(false)
      setFormData({
        name: '',
        provider: 'openai',
        upstream_key: '',
        base_url: 'https://api.openai.com/v1',
        scenario: '',
      })
      loadKeys()
    } catch (error) {
      alert('Failed to create API key: ' + error.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this API key?')) return
    try {
      await deleteAPIKey(id)
      loadKeys()
    } catch (error) {
      alert('Failed to delete API key: ' + error.message)
    }
  }

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
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

  if (loading) {
    return <div className="loading">Loading API keys...</div>
  }

  return (
    <div>
      <div className="page-header">
        <h1>API Keys</h1>
        <p>Manage your LLM API configurations and monitor their usage</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Configured API Keys</h3>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 4v16m8-8H4" />
            </svg>
            Add API Key
          </button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Provider</th>
                  <th>Scenario</th>
                  <th>Requests</th>
                  <th>Tokens</th>
                  <th>Efficiency</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id}>
                    <td>
                      <strong>{key.name}</strong>
                      <div style={{ fontSize: '12px', color: '#6e6e80' }}>{key.id.slice(0, 8)}...</div>
                    </td>
                    <td>
                      <span className="badge badge-info">{key.provider}</span>
                    </td>
                    <td>{key.scenario || '-'}</td>
                    <td>{formatNumber(key.total_requests)}</td>
                    <td>{formatNumber(key.total_tokens)}</td>
                    <td>
                      {key.efficiency_score ? (
                        <div className="score">
                          <div className={`score-circle ${getScoreClass(key.efficiency_score)}`}>
                            {getScoreLabel(key.efficiency_score)}
                          </div>
                          <span>{key.efficiency_score}%</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <button 
                        className="btn btn-secondary"
                        onClick={() => handleDelete(key.id)}
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '32px',
            width: '100%',
            maxWidth: '480px',
            maxHeight: '90vh',
            overflow: 'auto',
          }}>
            <h2 style={{ marginBottom: '24px' }}>Add API Key</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                  placeholder="e.g., Production OpenAI"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                  Provider *
                </label>
                <select
                  value={formData.provider}
                  onChange={(e) => {
                    const provider = e.target.value
                    let baseUrl = 'https://api.openai.com/v1'
                    if (provider === 'anthropic') baseUrl = 'https://api.anthropic.com/v1'
                    if (provider === 'google') baseUrl = 'https://generativelanguage.googleapis.com/v1'
                    setFormData({ ...formData, provider, base_url: baseUrl })
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                  API Key *
                </label>
                <input
                  type="password"
                  value={formData.upstream_key}
                  onChange={(e) => setFormData({ ...formData, upstream_key: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                  placeholder="sk-..."
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                  Base URL
                </label>
                <input
                  type="text"
                  value={formData.base_url}
                  onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                  Scenario (optional)
                </label>
                <input
                  type="text"
                  value={formData.scenario}
                  onChange={(e) => setFormData({ ...formData, scenario: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                  placeholder="e.g., customer-support, code-generation"
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add API Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default APIKeys
