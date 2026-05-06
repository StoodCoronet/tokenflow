import { useState, useEffect, useCallback } from 'react'
import { fetchDashboard, fetchKeyDetail } from '../api'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts'

type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d'

const RANGE_LABELS: Record<TimeRange, string> = {
  '1h': '1H',
  '6h': '6H',
  '24h': '24H',
  '7d': '7D',
  '30d': '30D',
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#a4de6c', '#d0ed57', '#83a6ed', '#8dd1e1']

export function AnalysisView() {
  const [view, setView] = useState<'overall' | 'key'>('overall')
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null)
  const [range, setRange] = useState<TimeRange>('24h')
  const [requestPage, setRequestPage] = useState(1)
  const [data, setData] = useState<any>(null)
  const [keyData, setKeyData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      if (view === 'overall') {
        const res = await fetchDashboard(range)
        setData(res.data)
      } else if (selectedKeyId) {
        const res = await fetchKeyDetail(selectedKeyId, range, requestPage)
        setKeyData(res.data)
      }
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Failed to fetch analysis data:', err)
    } finally {
      setLoading(false)
    }
  }, [view, selectedKeyId, range, requestPage])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleSelectKey = (keyId: string) => {
    setSelectedKeyId(keyId)
    setRequestPage(1)
    setKeyData(null)
    setView('key')
  }

  const handleBackToOverall = () => {
    setView('overall')
    setSelectedKeyId(null)
    setRequestPage(1)
    setKeyData(null)
  }

  const handlePageChange = (page: number) => {
    setRequestPage(page)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <TimeRangeSelector range={range} onChange={setRange} />
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-tf-muted">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="rounded-lg border border-tf-border bg-tf-card px-3 py-1.5 text-sm text-tf-text hover:bg-tf-border/50 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {view === 'overall' && (
        <OverallView data={data} loading={loading} onSelectKey={handleSelectKey} />
      )}

      {view === 'key' && selectedKeyId && (
        <KeyDetailView
          keyData={keyData}
          loading={loading}
          onBack={handleBackToOverall}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  )
}

function TimeRangeSelector({ range, onChange }: { range: TimeRange; onChange: (r: TimeRange) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-tf-border bg-tf-card p-1">
      {(Object.keys(RANGE_LABELS) as TimeRange[]).map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            range === r
              ? 'bg-tf-text text-tf-bg'
              : 'text-tf-muted hover:text-tf-text'
          }`}
        >
          {RANGE_LABELS[r]}
        </button>
      ))}
    </div>
  )
}

function OverviewCards({ data }: { data: any }) {
  if (!data) return null
  return (
    <div className="grid grid-cols-4 gap-4">
      <Card label="Total Requests" value={data.total_requests?.toLocaleString() ?? '—'} />
      <Card label="Prompt Tokens" value={data.total_prompt_tokens?.toLocaleString() ?? '—'} />
      <Card label="Completion Tokens" value={data.total_completion_tokens?.toLocaleString() ?? '—'} />
      <Card label="Avg Efficiency" value={`${data.avg_efficiency ?? '—'}/100`} />
    </div>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-tf-card border border-tf-border rounded-lg p-4 text-center">
      <div className="text-xs text-tf-muted uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-semibold text-tf-text">{value}</div>
    </div>
  )
}

function TrendChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return (
    <div className="bg-tf-card border border-tf-border rounded-lg p-8 text-center text-sm text-tf-muted">
      No trend data available
    </div>
  )
  const formatted = data.map((d: any) => ({
    ...d,
    label: new Date(d.window_start).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
  }))
  return (
    <div className="bg-tf-card border border-tf-border rounded-lg p-4">
      <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide mb-4">Token Usage Trend</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={formatted}>
          <defs>
            <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#888' }} />
          <YAxis tick={{ fontSize: 10, fill: '#888' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', fontSize: '12px' }}
            itemStyle={{ color: '#eee' }}
          />
          <Area type="monotone" dataKey="total_tokens" stroke="#8884d8" fillOpacity={1} fill="url(#colorTokens)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function KeyDistributionChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null
  return (
    <div className="bg-tf-card border border-tf-border rounded-lg p-4">
      <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide mb-4">Usage by Key</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} />
          <YAxis dataKey="key_name" type="category" width={80} tick={{ fontSize: 10, fill: '#888' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', fontSize: '12px' }}
            itemStyle={{ color: '#eee' }}
          />
          <Bar dataKey="total_tokens" fill="#82ca9d" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ModelDistributionChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null
  return (
    <div className="bg-tf-card border border-tf-border rounded-lg p-4">
      <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide mb-4">Usage by Model</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total_tokens"
            nameKey="model"
            cx="50%"
            cy="50%"
            outerRadius={70}
            label={({ model, percent }: any) => `${model} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((_: any, index: number) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', fontSize: '12px' }}
            itemStyle={{ color: '#eee' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function EfficiencyChart({ data }: { data: any }) {
  if (!data) return null
  const chartData = [
    { name: 'A', value: data.A || 0, fill: '#22c55e' },
    { name: 'B', value: data.B || 0, fill: '#84cc16' },
    { name: 'C', value: data.C || 0, fill: '#eab308' },
    { name: 'D', value: data.D || 0, fill: '#ef4444' },
  ].filter(d => d.value > 0)
  if (chartData.length === 0) return null
  return (
    <div className="bg-tf-card border border-tf-border rounded-lg p-4">
      <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide mb-4">Efficiency Grades</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={70}
            label={({ name, value }: any) => `${name}: ${value}`}
            labelLine={false}
          >
            {chartData.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', fontSize: '12px' }}
            itemStyle={{ color: '#eee' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function PatternBarChart({ data }: { data: any }) {
  if (!data) return null
  const chartData = [
    { name: 'Full Context', value: data.full_context || 0 },
    { name: 'Sliding Window', value: data.sliding_window || 0 },
    { name: 'Summarization', value: data.summarization || 0 },
    { name: 'None', value: data.none || 0 },
  ].filter(d => d.value > 0)
  if (chartData.length === 0) return null
  return (
    <div className="bg-tf-card border border-tf-border rounded-lg p-4">
      <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide mb-4">Context Patterns</h3>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} />
          <YAxis tick={{ fontSize: 10, fill: '#888' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', fontSize: '12px' }}
            itemStyle={{ color: '#eee' }}
          />
          <Bar dataKey="value" fill="#ffc658" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function AnomalyAlert({ anomalies }: { anomalies: any[] }) {
  if (!anomalies || anomalies.length === 0) return null
  return (
    <div className="space-y-2">
      {anomalies.map((a: any, i: number) => (
        <div key={i} className="bg-red-900/20 border border-red-800 rounded-lg p-3 flex items-center gap-3">
          <span className="text-red-400 text-sm font-semibold">⚠ Anomaly</span>
          <span className="text-red-200 text-sm">
            {a.key_name}: {a.message}
          </span>
        </div>
      ))}
    </div>
  )
}

function KeyListTable({ data, onSelectKey }: { data: any[]; onSelectKey: (id: string) => void }) {
  if (!data || data.length === 0) return null
  return (
    <div className="bg-tf-card border border-tf-border rounded-lg overflow-hidden">
      <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide px-4 pt-4 pb-2">API Keys</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-tf-border">
            <th className="text-left px-4 py-2 text-xs font-medium text-tf-muted uppercase">Key</th>
            <th className="text-right px-4 py-2 text-xs font-medium text-tf-muted uppercase">Requests</th>
            <th className="text-right px-4 py-2 text-xs font-medium text-tf-muted uppercase">Tokens</th>
          </tr>
        </thead>
        <tbody>
          {data.map((k: any) => (
            <tr
              key={k.api_key_id}
              className="border-b border-tf-border last:border-0 hover:bg-tf-border/30 cursor-pointer"
              onClick={() => onSelectKey(k.api_key_id)}
            >
              <td className="px-4 py-3 text-tf-text font-medium">{k.key_name || k.api_key_id.slice(0, 12)}</td>
              <td className="px-4 py-3 text-tf-text text-right">{k.request_count?.toLocaleString()}</td>
              <td className="px-4 py-3 text-tf-text text-right">{k.total_tokens?.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OverallView({ data, loading, onSelectKey }: { data: any; loading: boolean; onSelectKey: (id: string) => void }) {
  if (loading && !data) return <div className="text-tf-muted text-sm py-12 text-center">Loading dashboard...</div>
  if (!data) return <div className="text-tf-muted text-sm py-12 text-center">No data available</div>

  return (
    <div className="space-y-6">
      <OverviewCards data={data} />
      <TrendChart data={data.trend} />
      <div className="grid grid-cols-3 gap-4">
        <KeyDistributionChart data={data.key_distribution} />
        <ModelDistributionChart data={data.model_distribution} />
        <EfficiencyChart data={data.grade_distribution} />
      </div>
      <PatternBarChart data={data.pattern_distribution} />
      <AnomalyAlert anomalies={data.anomalies} />
      <KeyListTable data={data.key_distribution} onSelectKey={onSelectKey} />
    </div>
  )
}

function KeyDetailView({ keyData, loading, onBack, onPageChange }: { keyData: any; loading: boolean; onBack: () => void; onPageChange: (page: number) => void }) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  if (loading && !keyData) return <div className="text-tf-muted text-sm py-12 text-center">Loading key details...</div>
  if (!keyData) return <div className="text-tf-muted text-sm py-12 text-center">No data available</div>

  const { api_key, summary, trend, model_distribution, pattern_distribution, requests } = keyData

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="text-sm text-tf-muted hover:text-tf-text flex items-center gap-1"
      >
        ← Back to Overview
      </button>

      <div className="bg-tf-card border border-tf-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-tf-text">{api_key.name}</h2>
            <p className="text-xs text-tf-muted mt-1">
              {api_key.provider} {api_key.scenario ? `· ${api_key.scenario}` : ''}
            </p>
          </div>
        </div>
      </div>

      <OverviewCards data={{
        total_requests: summary.total_requests,
        total_prompt_tokens: summary.total_prompt_tokens,
        total_completion_tokens: summary.total_completion_tokens,
        avg_efficiency: summary.avg_efficiency,
      }} />

      <TrendChart data={trend} />
      <ModelDistributionChart data={model_distribution} />
      <PatternBarChart data={pattern_distribution} />

      <div className="bg-tf-card border border-tf-border rounded-lg overflow-hidden">
        <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide px-4 pt-4 pb-2">Requests</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-tf-border">
              <th className="text-left px-4 py-2 text-xs font-medium text-tf-muted uppercase">Time</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-tf-muted uppercase">Model</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-tf-muted uppercase">Tokens</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-tf-muted uppercase">Status</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-tf-muted uppercase">Pattern</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-tf-muted uppercase"></th>
            </tr>
          </thead>
          <tbody>
            {requests?.items?.map((req: any) => (
              <>
                <tr
                  key={req.id}
                  className="border-b border-tf-border last:border-0 hover:bg-tf-border/30 cursor-pointer"
                  onClick={() => setExpandedRow(expandedRow === req.id ? null : req.id)}
                >
                  <td className="px-4 py-3 text-tf-text text-xs">{new Date(req.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-tf-text">{req.model}</td>
                  <td className="px-4 py-3 text-tf-text text-right">{req.total_tokens?.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${req.status === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-tf-text text-xs">{req.detected_pattern || '—'}</td>
                  <td className="px-4 py-3 text-right text-tf-muted text-xs">{expandedRow === req.id ? '▲' : '▼'}</td>
                </tr>
                {expandedRow === req.id && (
                  <tr className="bg-tf-bg/50">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs text-tf-muted mb-1">Request</div>
                          <pre className="text-xs text-tf-text bg-tf-bg border border-tf-border rounded p-2 overflow-auto max-h-40">
                            {JSON.stringify(JSON.parse(req.request_data || '{}'), null, 2)}
                          </pre>
                        </div>
                        <div>
                          <div className="text-xs text-tf-muted mb-1">Response</div>
                          <pre className="text-xs text-tf-text bg-tf-bg border border-tf-border rounded p-2 overflow-auto max-h-40">
                            {JSON.stringify(JSON.parse(req.response_data || '{}'), null, 2)}
                          </pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {requests && requests.total > requests.page_size && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-tf-border">
            <button
              onClick={() => onPageChange(requests.page - 1)}
              disabled={requests.page <= 1}
              className="text-xs text-tf-muted hover:text-tf-text disabled:opacity-30"
            >
              ← Prev
            </button>
            <span className="text-xs text-tf-muted">
              Page {requests.page} of {Math.ceil(requests.total / requests.page_size)}
            </span>
            <button
              onClick={() => onPageChange(requests.page + 1)}
              disabled={requests.page >= Math.ceil(requests.total / requests.page_size)}
              className="text-xs text-tf-muted hover:text-tf-text disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
