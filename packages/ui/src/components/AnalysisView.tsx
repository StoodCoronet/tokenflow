import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchDashboard, fetchKeyDetail } from '../api'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'

type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d'

const RANGE_LABELS: Record<TimeRange, string> = {
  '1h': '1H',
  '6h': '6H',
  '24h': '24H',
  '7d': '7D',
  '30d': '30D',
}

const COLOR_SCHEMES: Record<string, string[]> = {
  default: ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#a4de6c', '#d0ed57', '#83a6ed', '#8dd1e1'],
  carbon: ['#6929c4', '#1192e8', '#005d5d', '#9f1853', '#fa4d56', '#198038', '#002d9c', '#ee538b', '#b28600', '#009d9a', '#8a3800', '#a56eff'],
  tableau: ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'],
  material: ['#E53935', '#FB8C00', '#FDD835', '#43A047', '#1E88E5', '#3949AB', '#8E24AA', '#00ACC1', '#6D4C41', '#546E7A'],
  tailwind: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'],
}

const COLORS = COLOR_SCHEMES.default

function renderPieLabel(props: any, maxLen = 14) {
  const { cx, cy, midAngle, outerRadius, percent, name } = props
  const RADIAN = Math.PI / 180
  const radius = outerRadius + 12
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  const short = name && name.length > maxLen ? name.slice(0, maxLen) + '…' : name
  return (
    <text
      x={x}
      y={y}
      fill="#888"
      fontSize={11}
      fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      fontWeight={400}
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
    >
      {`${short} ${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export function AnalysisView() {
  const [view, setView] = useState<'overall' | 'key'>('overall')
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null)
  const [range, setRange] = useState<TimeRange>('7d')
  const [requestPage, setRequestPage] = useState(1)
  const [data, setData] = useState<any>(null)
  const [keyData, setKeyData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [colorScheme, setColorScheme] = useState('default')

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
        <OverallView data={data} loading={loading} onSelectKey={handleSelectKey} colorScheme={colorScheme} onColorSchemeChange={setColorScheme} />
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
    <div className="grid grid-cols-5 gap-4">
      <Card label="Total Requests" value={data.total_requests?.toLocaleString() ?? '—'} />
      <Card label="Prompt Tokens" value={data.total_prompt_tokens != null ? formatTokens(data.total_prompt_tokens) : '—'} />
      <Card label="Completion Tokens" value={data.total_completion_tokens != null ? formatTokens(data.total_completion_tokens) : '—'} />
      <Card label="Avg Efficiency" value={`${data.avg_efficiency ?? '—'}/100`} />
      <Card label="Est. Cost" value={data.total_cost != null ? `$${data.total_cost.toFixed(2)}` : '—'} />
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

function TrendChart({ trend, keyTrends, colors }: { trend: any[]; keyTrends?: any[]; colors?: string[] }) {
  const hasKeys = keyTrends && keyTrends.length > 0
  const [showPerKey, setShowPerKey] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  // Initialize selected keys when keyTrends changes
  useEffect(() => {
    if (keyTrends && keyTrends.length > 0) {
      const allKeyNames = Array.from(new Set(keyTrends.map((k) => k.key_name || k.api_key_id)))
      setSelectedKeys(new Set(allKeyNames))
    }
  }, [keyTrends])

  const allKeyNames = useMemo(() => {
    if (!keyTrends) return []
    return Array.from(new Set(keyTrends.map((k) => k.key_name || k.api_key_id)))
  }, [keyTrends])

  const toggleKey = (keyName: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(keyName)) next.delete(keyName)
      else next.add(keyName)
      return next
    })
  }

  const formatted = useMemo(() => {
    if (!trend || trend.length === 0) return []

    const windows = new Map<string, any>()

    for (const d of trend) {
      const label = new Date(d.window_start).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      windows.set(d.window_start, { window_start: d.window_start, label, Total: d.total_tokens || 0 })
    }

    if (keyTrends) {
      for (const d of keyTrends) {
        const entry = windows.get(d.window_start)
        if (entry) {
          const keyName = d.key_name || d.api_key_id
          entry[keyName] = d.total_tokens || 0
        }
      }
    }

    return Array.from(windows.values()).sort((a, b) => new Date(a.window_start).getTime() - new Date(b.window_start).getTime())
  }, [trend, keyTrends])

  if (!trend || trend.length === 0) return (
    <div className="bg-tf-card border border-tf-border rounded-lg p-8 text-center text-sm text-tf-muted">
      No trend data available
    </div>
  )

  const activeKeys = showPerKey ? allKeyNames.filter((k) => selectedKeys.has(k)) : []

  return (
    <div className="bg-tf-card border border-tf-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide">Token Usage Trend</h3>
        {hasKeys && (
          <button
            onClick={() => setShowPerKey(!showPerKey)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              showPerKey ? 'bg-tf-accent/20 text-tf-accent' : 'text-tf-muted hover:text-tf-text'
            }`}
          >
            {showPerKey ? 'Hide Keys' : 'Show Keys'}
          </button>
        )}
      </div>

      {showPerKey && hasKeys && (
        <div className="flex flex-wrap gap-2 mb-4">
          {allKeyNames.map((keyName, i) => (
            <button
              key={keyName}
              onClick={() => toggleKey(keyName)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                selectedKeys.has(keyName)
                  ? 'text-tf-text'
                  : 'text-tf-muted border-tf-border opacity-50'
              }`}
              style={selectedKeys.has(keyName) ? { borderColor: (colors || COLORS)[i % (colors || COLORS).length], backgroundColor: (colors || COLORS)[i % (colors || COLORS).length] + '22' } : {}}
            >
              {keyName}
            </button>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={formatted}>
          <defs>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={(colors || COLORS)[0]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={(colors || COLORS)[0]} stopOpacity={0} />
            </linearGradient>
            {activeKeys.map((keyName) => {
              const ci = allKeyNames.indexOf(keyName)
              return (
                <linearGradient key={keyName} id={`color${ci}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={(colors || COLORS)[ci % (colors || COLORS).length]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={(colors || COLORS)[ci % (colors || COLORS).length]} stopOpacity={0} />
                </linearGradient>
              )
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#888' }} />
          <YAxis tick={{ fontSize: 10, fill: '#888' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', fontSize: '12px' }}
            itemStyle={{ color: '#eee' }}
          />
          {!showPerKey && (
            <Area type="monotone" dataKey="Total" stroke={(colors || COLORS)[0]} fillOpacity={1} fill="url(#colorTotal)" />
          )}
          {showPerKey && activeKeys.map((keyName) => {
            const ci = allKeyNames.indexOf(keyName)
            return (
              <Area
                key={keyName}
                type="monotone"
                dataKey={keyName}
                stroke={(colors || COLORS)[ci % (colors || COLORS).length]}
                fillOpacity={1}
                fill={`url(#color${ci})`}
                stackId="1"
              />
            )
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function KeyDistributionChart({ data, colors }: { data: any[]; colors?: string[] }) {
  if (!data || data.length === 0) return null
  const chartHeight = Math.max(200, data.length * 32)
  return (
    <div className="bg-tf-card border border-tf-border rounded-lg p-4">
      <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide mb-4">Usage by Key</h3>
      <div style={{ overflowY: 'auto', maxHeight: 420 }}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} />
            <YAxis
              dataKey="key_name"
              type="category"
              width={180}
              tick={{ fontSize: 10, fill: '#888' }}
              tickFormatter={(name: string) => name && name.length > 24 ? name.slice(0, 24) + '…' : name || '—'}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', fontSize: '12px' }}
              itemStyle={{ color: '#eee' }}
            />
            <Bar dataKey="total_tokens" fill={(colors || COLORS)[0]} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ModelDistributionChart({ data, colors }: { data: any[]; colors?: string[] }) {
  if (!data || data.length === 0) return null
  return (
    <div className="bg-tf-card border border-tf-border rounded-lg p-4 h-full flex flex-col">
      <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide mb-4">Usage by Model</h3>
      <div className="flex-1 flex items-center justify-center min-h-0">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart margin={{ top: 15, right: 20, bottom: 15, left: 20 }}>
            <Pie
              data={data}
              dataKey="total_tokens"
              nameKey="model"
              cx="50%"
              cy="50%"
              outerRadius={85}
              label={(props: any) => renderPieLabel({ ...props, name: props.model })}
              labelLine={true}
            >
            {data.map((_: any, index: number) => (
              <Cell key={`cell-${index}`} fill={(colors || COLORS)[index % (colors || COLORS).length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', fontSize: '12px' }}
            itemStyle={{ color: '#eee' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
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
    <div className="bg-tf-card border border-tf-border rounded-lg p-4 h-full flex flex-col">
      <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide mb-4">Efficiency Grades</h3>
      <div className="flex-1 flex items-center justify-center min-h-0">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart margin={{ top: 15, right: 20, bottom: 15, left: 20 }}>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={85}
              label={(props: any) => renderPieLabel({ ...props, name: `${props.name}: ${props.value}` })}
              labelLine={true}
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
  </div>
  )
}

function PatternBarChart({ data, colors }: { data: any; colors?: string[] }) {
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
          <Bar dataKey="value" fill={(colors || COLORS)[1]} radius={[4, 4, 0, 0]} />
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
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide">API Keys</h3>
        <span className="text-[11px] text-tf-muted">Click a row to view details</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-tf-border">
            <th className="text-left px-4 py-2 text-xs font-medium text-tf-muted uppercase">Key</th>
            <th className="text-right px-4 py-2 text-xs font-medium text-tf-muted uppercase">Requests</th>
            <th className="text-right px-4 py-2 text-xs font-medium text-tf-muted uppercase">Tokens</th>
            <th className="px-4 py-2 w-12"></th>
          </tr>
        </thead>
        <tbody>
          {data.map((k: any) => (
            <tr
              key={k.api_key_id}
              className="border-b border-tf-border last:border-0 hover:bg-tf-border/30 cursor-pointer group transition-colors"
              onClick={() => onSelectKey(k.api_key_id)}
            >
              <td className="px-4 py-3 text-tf-text font-medium">{k.key_name || k.api_key_id.slice(0, 12)}</td>
              <td className="px-4 py-3 text-tf-text text-right">{k.request_count?.toLocaleString()}</td>
              <td className="px-4 py-3 text-tf-text text-right">{k.total_tokens != null ? formatTokens(k.total_tokens) : '—'}</td>
              <td className="px-4 py-3 text-right">
                <span className="text-xs text-tf-muted group-hover:text-tf-accent transition-colors">View →</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OverallView({ data, loading, onSelectKey, colorScheme, onColorSchemeChange }: { data: any; loading: boolean; onSelectKey: (id: string) => void; colorScheme: string; onColorSchemeChange: (s: string) => void }) {
  if (loading && !data) return <div className="text-tf-muted text-sm py-12 text-center">Loading dashboard...</div>
  if (!data) return <div className="text-tf-muted text-sm py-12 text-center">No data available</div>

  const colors = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.default

  return (
    <div className="space-y-6">
      <OverviewCards data={data} />
      <TrendChart trend={data.trend} keyTrends={data.key_trends} colors={colors} />
      <KeyDistributionChart data={data.key_distribution} colors={colors} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ModelDistributionChart data={data.model_distribution} colors={colors} />
        <EfficiencyChart data={data.grade_distribution} />
      </div>

      <PatternBarChart data={data.pattern_distribution} colors={colors} />
      <AnomalyAlert anomalies={data.anomalies} />
      <KeyListTable data={data.key_distribution} onSelectKey={onSelectKey} />
      <RecentRequests logs={data.recent_logs} />
    </div>
  )
}

function RecentRequests({ logs }: { logs: any[] }) {
  if (!logs || logs.length === 0) return null
  return (
    <div className="bg-tf-card border border-tf-border rounded-lg overflow-hidden">
      <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide px-4 pt-4 pb-2">Recent Requests</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-tf-border">
            {['Model', 'Tokens', 'Pattern', 'Score', 'Time'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-medium text-tf-muted uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log: any, i: number) => (
            <tr key={i} className="border-b border-tf-border last:border-0 hover:bg-tf-border/30 transition-colors">
              <td className="px-4 py-3 text-tf-text">{log.model}</td>
              <td className="px-4 py-3 text-tf-text">{log.total_tokens?.toLocaleString()}</td>
              <td className="px-4 py-3 text-tf-muted">{log.detected_pattern || '—'}</td>
              <td className="px-4 py-3 text-tf-text">{log.efficiency_score ?? '—'}</td>
              <td className="px-4 py-3 text-tf-text text-xs">{new Date(log.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
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

      <TrendChart trend={trend} />
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
