import { useState, useEffect } from 'react'
import { fetchSessionStats } from '../api'

export function SessionsOverview() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessionStats()
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-tf-muted text-sm">Loading stats...</div>
  if (!stats) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Sessions" value={stats.total_sessions} />
        <StatCard label="Active Now" value={stats.active_sessions} />
        <StatCard label="Total Tokens" value={stats.total_tokens?.toLocaleString()} />
        <StatCard label="Avg Efficiency" value={`${stats.avg_efficiency}%`} />
      </div>

      {stats.pattern_distribution?.length > 0 && (
        <div className="bg-tf-card border border-tf-border rounded-lg p-5">
          <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide mb-3">Pattern Distribution</h3>
          <div className="space-y-2">
            {stats.pattern_distribution.map((p: any) => {
              const total = stats.pattern_distribution.reduce((s: number, x: any) => s + x.count, 0)
              const pct = Math.round((p.count / total) * 100)
              return (
                <div key={p.pattern} className="flex items-center gap-3">
                  <span className="text-sm text-tf-text w-36 truncate">{p.pattern}</span>
                  <div className="flex-1 bg-tf-border/30 rounded-full h-2">
                    <div className="bg-tf-accent rounded-full h-2" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-tf-muted w-12 text-right">{p.count} ({pct}%)</span>
                </div>
              )
            })}
          </div>
        </div>
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
