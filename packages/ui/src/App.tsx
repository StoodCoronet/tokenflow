import { useState, useEffect, Component } from 'react'
import type { ReactNode } from 'react'
import { fetchKeys, fetchSessions } from './api'
import { ThemeToggle } from './components/ThemeToggle'
import { ProvidersPage } from './components/ProvidersPage'
import { SessionsOverview } from './components/SessionsOverview'
import { SessionFiltersBar, filtersToParams, defaultFilters } from './components/SessionFilters'
import type { SessionFilters } from './components/SessionFilters'
import { SessionCard } from './components/SessionCard'
import { SessionDetail } from './components/SessionDetail'
import { AnalysisView } from './components/AnalysisView'
import { SettingsView } from './components/SettingsView'

type Tab = 'providers' | 'sessions' | 'analysis' | 'settings'

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

function getInitialTab(): Tab {
  const hash = window.location.hash.replace('#', '')
  // Dashboard was removed; redirect old bookmarks to analysis
  if (hash === 'dashboard') return 'analysis'
  const valid: Tab[] = ['providers', 'sessions', 'analysis', 'settings']
  return valid.includes(hash as Tab) ? (hash as Tab) : 'providers'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(getInitialTab)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setData(null)
    setError(null)
    setLoading(true)

    const fetcher = tab === 'providers' ? fetchKeys
      : () => fetchSessions()

    fetcher()
      .then((r: any) => setData(r.data))
      .catch((err: Error) => setError(err.message || 'Failed to fetch'))
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(() => {
    window.location.hash = tab
  }, [tab])

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-tf-bg transition-colors">
      <nav className="bg-tf-card border-b border-tf-border px-6 py-3 flex items-center gap-6">
        <h1 className="text-lg font-semibold text-tf-text tracking-tight">Token Flow</h1>
        <div className="flex gap-1">
          {(['providers', 'sessions', 'analysis', 'settings'] as Tab[]).map(t => (
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
        {tab === 'providers' && <ProvidersPage />}
        {tab === 'sessions' && <SessionsPage />}
        {tab === 'analysis' && <AnalysisView />}
        {tab === 'settings' && <SettingsView />}
      </main>
    </div>
    </ErrorBoundary>
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

