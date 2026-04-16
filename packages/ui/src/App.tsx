import { useState, useEffect } from 'react'
import { fetchDashboard, fetchKeys, fetchSessions } from './api'

type Tab = 'dashboard' | 'keys' | 'sessions'

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    if (tab === 'dashboard') {
      fetchDashboard().then(r => setData(r.data)).catch(() => setData(null))
    } else if (tab === 'keys') {
      fetchKeys().then(r => setData(r.data)).catch(() => setData(null))
    } else {
      fetchSessions().then(r => setData(r.data)).catch(() => setData(null))
    }
  }, [tab])

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center gap-6">
        <h1 className="text-xl font-bold">Token Flow</h1>
        <div className="flex gap-4">
          {(['dashboard', 'keys', 'sessions'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded text-sm ${tab === t ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </nav>
      <main className="max-w-6xl mx-auto p-6">
        {tab === 'dashboard' && <Dashboard data={data} />}
        {tab === 'keys' && <ApiKeys data={data} />}
        {tab === 'sessions' && <Sessions data={data} />}
      </main>
    </div>
  )
}

function Dashboard({ data }: { data: any }) {
  if (!data) return <div className="text-gray-400">Loading...</div>
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Requests" value={data.total_requests} />
        <StatCard label="Total Tokens" value={data.total_tokens?.toLocaleString()} />
        <StatCard label="Avg Efficiency" value={`${data.avg_efficiency}%`} />
      </div>
      <h2 className="text-lg font-semibold mb-3">Recent Requests</h2>
      <table className="w-full text-sm bg-white rounded border">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-2">Model</th>
            <th className="text-left p-2">Tokens</th>
            <th className="text-left p-2">Pattern</th>
            <th className="text-left p-2">Score</th>
            <th className="text-left p-2">Time</th>
          </tr>
        </thead>
        <tbody>
          {(data.recent_logs || []).map((log: any) => (
            <tr key={log.id} className="border-t">
              <td className="p-2">{log.model}</td>
              <td className="p-2">{log.total_tokens}</td>
              <td className="p-2">{log.detected_pattern || '-'}</td>
              <td className="p-2">{log.efficiency_score}</td>
              <td className="p-2 text-gray-400">{new Date(log.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ApiKeys({ data }: { data: any }) {
  if (!data) return <div className="text-gray-400">Loading...</div>
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">API Keys</h2>
      {(data as any[]).length === 0
        ? <div className="text-gray-400">No API keys yet. Use <code className="bg-gray-100 px-1 rounded">tflow config</code> to add one.</div>
        : <table className="w-full text-sm bg-white rounded border">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Provider</th>
                <th className="text-left p-2">Base URL</th>
                <th className="text-left p-2">Scenario</th>
              </tr>
            </thead>
            <tbody>
              {(data as any[]).map((key: any) => (
                <tr key={key.id} className="border-t">
                  <td className="p-2">{key.name}</td>
                  <td className="p-2">{key.provider}</td>
                  <td className="p-2 text-gray-500">{key.base_url}</td>
                  <td className="p-2">{key.scenario || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
      }
    </div>
  )
}

function Sessions({ data }: { data: any }) {
  if (!data) return <div className="text-gray-400">Loading...</div>
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Sessions</h2>
      {(data as any[]).length === 0
        ? <div className="text-gray-400">No sessions yet. Send requests through the proxy to see sessions.</div>
        : <table className="w-full text-sm bg-white rounded border">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Session</th>
                <th className="text-left p-2">Messages</th>
                <th className="text-left p-2">Tokens</th>
                <th className="text-left p-2">Pattern</th>
                <th className="text-left p-2">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {(data as any[]).map((s: any) => (
                <tr key={s.session_id} className="border-t">
                  <td className="p-2 font-mono text-xs">{s.session_id.slice(0, 12)}</td>
                  <td className="p-2">{s.message_count}</td>
                  <td className="p-2">{(s.total_prompt_tokens + s.total_completion_tokens).toLocaleString()}</td>
                  <td className="p-2">{s.current_pattern || '-'}</td>
                  <td className="p-2 text-gray-400">{new Date(s.last_activity).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
      }
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white rounded border p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value ?? 0}</div>
    </div>
  )
}
