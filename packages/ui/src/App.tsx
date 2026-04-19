import { useState, useEffect, Component } from 'react'
import type { ReactNode } from 'react'
import { fetchDashboard, fetchKeys, fetchSessions, createKey, updateKey, deleteKey } from './api'
import { ThemeToggle } from './components/ThemeToggle'
import { KeyModal } from './components/KeyModal'
import { SessionsOverview } from './components/SessionsOverview'
import { SessionFiltersBar, filtersToParams, defaultFilters } from './components/SessionFilters'
import type { SessionFilters } from './components/SessionFilters'
import { SessionCard } from './components/SessionCard'
import { SessionDetail } from './components/SessionDetail'
import { AnalysisView } from './components/AnalysisView'
import { SettingsView } from './components/SettingsView'

type Tab = 'dashboard' | 'keys' | 'sessions' | 'analysis' | 'settings'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(e: Error) { return { error: e.message } }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-tf-bg flex items-center justify-center">
          <div className="bg-tf-card border border-tf-border rounded-lg p-6 max-w-md text-center">
            <p className="text-red-500 dark:text-red-400 text-sm mb-3">{this.state.error}</p>
            <button onClick={() => this.setState({ error: null })} className="text-sm text-tf-accent hover:underline">Retry</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setData(null)
    setError(null)
    setLoading(true)

    const fetcher = tab === 'dashboard' ? fetchDashboard
      : tab === 'keys' ? fetchKeys
      : () => fetchSessions()

    fetcher()
      .then((r: any) => setData(r.data))
      .catch((err: Error) => setError(err.message || 'Failed to fetch'))
      .finally(() => setLoading(false))
  }, [tab])

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-tf-bg transition-colors">
      <nav className="bg-tf-card border-b border-tf-border px-6 py-3 flex items-center gap-6">
        <h1 className="text-lg font-semibold text-tf-text tracking-tight">Token Flow</h1>
        <div className="flex gap-1">
          {(['dashboard', 'keys', 'sessions', 'analysis', 'settings'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                tab === t
                  ? 'bg-tf-accent/10 text-tf-accent font-medium'
                  : 'text-tf-muted hover:text-tf-text hover:bg-tf-border/50'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <a
            href={`http://${window.location.hostname}:40003`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-tf-muted hover:text-tf-text transition-colors"
          >
            Docs
          </a>
          <ThemeToggle />
        </div>
      </nav>
      <main className="max-w-6xl mx-auto p-6">
        {error && (
          <div className="bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}
        {loading && !data && (
          <div className="flex items-center gap-2 text-tf-muted">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading...
          </div>
        )}
        {!loading && !error && tab === 'dashboard' && <Dashboard data={data} />}
        {!loading && !error && tab === 'keys' && <ApiKeys data={data} onRefresh={() => { setData(null); setLoading(true); fetchKeys().then(r => setData(r.data)).catch(err => setError(err.message)).finally(() => setLoading(false)) }} />}
        {tab === 'sessions' && <SessionsPage />}
        {tab === 'analysis' && <AnalysisView />}
        {tab === 'settings' && <SettingsView />}
      </main>
    </div>
    </ErrorBoundary>
  )
}

function Dashboard({ data }: { data: any }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Requests" value={data.total_requests} />
        <StatCard label="Total Tokens" value={data.total_tokens?.toLocaleString()} />
        <StatCard label="Avg Efficiency" value={`${data.avg_efficiency}%`} />
      </div>
      <h2 className="text-sm font-medium text-tf-muted uppercase tracking-wide mb-3">Recent Requests</h2>
      <Table
        headers={['Model', 'Tokens', 'Pattern', 'Score', 'Time']}
        rows={(data.recent_logs || []).map((log: any) => [
          log.model,
          log.total_tokens,
          log.detected_pattern || '-',
          log.efficiency_score,
          new Date(log.created_at).toLocaleString(),
        ])}
      />
    </div>
  )
}

function ApiKeys({ data, onRefresh }: { data: any; onRefresh: () => void }) {
  const keys = Array.isArray(data) ? data : []
  const [modal, setModal] = useState<{ open: boolean; initial?: any }>({ open: false })

  const handleSave = async (formData: any) => {
    if (modal.initial?.id) {
      const payload = { ...formData }
      if (!payload.upstream_key) delete payload.upstream_key
      await updateKey(modal.initial.id, payload)
    } else {
      await createKey(formData)
    }
    setModal({ open: false })
    onRefresh()
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete key "${name}"?`)) return
    await deleteKey(id)
    onRefresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-tf-muted uppercase tracking-wide">API Keys</h2>
        <button
          onClick={() => setModal({ open: true })}
          className="px-3 py-1.5 text-sm bg-tf-accent text-white rounded-lg hover:opacity-90"
        >
          Add Key
        </button>
      </div>
      {keys.length === 0 ? (
        <div className="text-tf-muted text-sm py-8 text-center">
          No API keys yet. Click "Add Key" to create one.
        </div>
      ) : (
        <Table
          headers={['Name', 'Provider', 'Base URL', 'Scenario', '']}
          rows={keys.map((key: any) => [
            key.name,
            key.provider,
            <span key="url" className="text-tf-muted">{key.base_url}</span>,
            key.scenario || '-',
            <div key="actions" className="flex gap-2">
              <button
                onClick={() => setModal({ open: true, initial: key })}
                className="text-xs text-tf-muted hover:text-tf-accent"
              >Edit</button>
              <button
                onClick={() => handleDelete(key.id, key.name)}
                className="text-xs text-tf-muted hover:text-red-500"
              >Delete</button>
            </div>,
          ])}
        />
      )}
      <KeyModal
        open={modal.open}
        initial={modal.initial}
        onSubmit={handleSave}
        onClose={() => setModal({ open: false })}
      />
    </div>
  )
}

function SessionsPage() {
  const [subTab, setSubTab] = useState<'overview' | 'list'>('list')
  const [sessions, setSessions] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<SessionFilters>(defaultFilters)
  const [pageLoading, setPageLoading] = useState(true)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [keys, setKeys] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    fetchKeys().then(r => setKeys(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (detailId) return
    setPageLoading(true)
    const params = filtersToParams(filters)
    fetchSessions(params)
      .then(r => {
        const d = r.data
        setSessions(d.sessions ?? d)
        setTotal(d.total ?? (Array.isArray(d) ? d.length : 0))
      })
      .catch(() => {})
      .finally(() => setPageLoading(false))
  }, [filters, detailId])

  if (detailId) {
    return <SessionDetail sessionId={detailId} onBack={() => setDetailId(null)} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex gap-1">
          <button onClick={() => setSubTab('overview')} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${subTab === 'overview' ? 'bg-tf-accent/10 text-tf-accent font-medium' : 'text-tf-muted hover:text-tf-text'}`}>Overview</button>
          <button onClick={() => setSubTab('list')} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${subTab === 'list' ? 'bg-tf-accent/10 text-tf-accent font-medium' : 'text-tf-muted hover:text-tf-text'}`}>Sessions</button>
        </div>
      </div>

      {subTab === 'overview' && <SessionsOverview />}

      {subTab === 'list' && (
        <>
          <SessionFiltersBar keys={keys} filters={filters} onChange={setFilters} />
          {pageLoading ? (
            <div className="text-tf-muted text-sm py-8 text-center">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="text-tf-muted text-sm py-8 text-center">No sessions found.</div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s: any) => (
                <SessionCard key={s.session_id} session={s} onClick={() => setDetailId(s.session_id)} />
              ))}
            </div>
          )}
          {total > sessions.length && (
            <div className="text-xs text-tf-muted text-center py-2">Showing {sessions.length} of {total}</div>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-tf-card border border-tf-border rounded-lg p-5">
      <div className="text-xs font-medium text-tf-muted uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold text-tf-text mt-2">{value ?? 0}</div>
    </div>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: any[][] }) {
  return (
    <div className="bg-tf-card border border-tf-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-tf-border">
            {headers.map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-medium text-tf-muted uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-tf-border last:border-0 hover:bg-tf-border/30 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-tf-text">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
