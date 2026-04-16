import { useState } from 'react'

const TABS = [
  { id: 'quick-start', label: 'Quick Start' },
  { id: 'providers', label: 'Providers' },
  { id: 'api-reference', label: 'API Reference' },
]

function Documentation() {
  const [activeTab, setActiveTab] = useState('quick-start')

  return (
    <div>
      <div className="page-header">
        <h1>Documentation</h1>
        <p>Learn how to set up and use Token Flow</p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id ? 'btn btn-primary' : 'btn btn-secondary'}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'quick-start' && <QuickStart />}
      {activeTab === 'providers' && <Providers />}
      {activeTab === 'api-reference' && <ApiReference />}
    </div>
  )
}

function QuickStart() {
  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">1. Configure your API Key</h3>
        </div>
        <div className="card-body">
          <p style={{ color: '#6e6e80', marginBottom: '16px' }}>
            Go to <strong>API Keys</strong> page and add your upstream API key. Token Flow will use this to proxy requests.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">2. Point your application to Token Flow</h3>
        </div>
        <div className="card-body">
          <p style={{ color: '#6e6e80', marginBottom: '16px' }}>
            Replace your API base URL with the Token Flow proxy address:
          </p>

          <h4 style={{ marginBottom: '8px' }}>Python (OpenAI SDK)</h4>
          <pre style={{
            background: '#f7f7f8',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '13px',
            overflow: 'auto',
            marginBottom: '16px',
            textAlign: 'left',
          }}>{`import openai

client = openai.OpenAI(
    base_url="http://localhost:40001/v1",
    api_key="your-upstream-api-key",
    default_headers={"X-API-Key": "your-tokenflow-key-id"}
)

response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "user", "content": "Hello!"}
    ],
    session_id="conversation-001"
)`}</pre>

          <h4 style={{ marginBottom: '8px' }}>curl</h4>
          <pre style={{
            background: '#f7f7f8',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '13px',
            overflow: 'auto',
            textAlign: 'left',
          }}>{`curl http://localhost:40001/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-tokenflow-key-id" \\
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}],
    "session_id": "conversation-001"
  }'`}</pre>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">3. Monitor & Optimize</h3>
        </div>
        <div className="card-body">
          <p style={{ color: '#6e6e80' }}>
            Once requests flow through Token Flow, the Dashboard will show real-time stats.
            The Analysis page provides pattern detection and optimization suggestions.
            Look for:
          </p>
          <ul style={{ color: '#6e6e80', paddingLeft: '20px', marginTop: '8px' }}>
            <li>Context pattern detection (Full Context, Sliding Window, Summarization)</li>
            <li>Efficiency scores (A/B/C/D) per API key and session</li>
            <li>Cost savings estimates and optimization recommendations</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function Providers() {
  const providers = [
    { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', status: 'Supported' },
    { name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', status: 'Supported' },
    { name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', status: 'Supported' },
    { name: 'Custom / Self-hosted', baseUrl: 'Your own endpoint', status: 'Supported' },
  ]

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Supported Providers</h3>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Base URL</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.name}>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td><code style={{ fontSize: '13px', background: '#f7f7f8', padding: '2px 6px', borderRadius: '4px' }}>{p.baseUrl}</code></td>
                  <td><span className="badge badge-success">{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ApiReference() {
  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Swagger UI</h3>
        </div>
        <div className="card-body">
          <p style={{ color: '#6e6e80', marginBottom: '12px' }}>
            Full interactive API documentation is available via Swagger UI:
          </p>
          <a
            href="http://localhost:40001/docs"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#10a37f',
              fontSize: '16px',
              fontWeight: 500,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            http://localhost:40001/docs
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </a>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Key Endpoints</h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Endpoint</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['POST', '/v1/chat/completions', 'Proxy chat completions to upstream'],
                  ['GET', '/api/v1/dashboard/stats', 'Dashboard statistics'],
                  ['GET', '/api/v1/dashboard/recent-requests', 'Recent request logs'],
                  ['GET', '/api/v1/keys', 'List API keys'],
                  ['POST', '/api/v1/keys', 'Create API key'],
                  ['GET', '/api/v1/analysis/report', 'Efficiency analysis report'],
                  ['GET', '/api/v1/analysis/sessions', 'Session list'],
                  ['GET', '/api/v1/analysis/savings', 'Savings summary'],
                  ['GET', '/api/v1/settings', 'Get settings'],
                  ['PUT', '/api/v1/settings', 'Update settings'],
                ].map(([method, endpoint, desc]) => (
                  <tr key={endpoint}>
                    <td>
                      <span className={`badge ${method === 'GET' ? 'badge-info' : 'badge-warning'}`}>
                        {method}
                      </span>
                    </td>
                    <td><code style={{ fontSize: '13px', background: '#f7f7f8', padding: '2px 6px', borderRadius: '4px' }}>{endpoint}</code></td>
                    <td style={{ color: '#6e6e80' }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Documentation
