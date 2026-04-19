import { useState, useEffect } from 'react'
import { fetchSession, fetchAnalysis } from '../api'

export function SessionDetail({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const [data, setData] = useState<any>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchSession(sessionId), fetchAnalysis(sessionId)])
      .then(([sessRes, analysisRes]) => {
        setData(sessRes.data)
        setAnalysis(analysisRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) return <div className="text-tf-muted text-sm py-8 text-center">Loading session details...</div>
  if (!data?.session) return <div className="text-tf-muted text-sm py-8 text-center">Session not found</div>

  const { session, logs, recent_messages } = data
  const totalTokens = (session.total_prompt_tokens || 0) + (session.total_completion_tokens || 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-tf-muted hover:text-tf-accent">← Back</button>
        <h2 className="text-sm font-medium text-tf-muted uppercase tracking-wide">Session Detail</h2>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-4 gap-4">
        <MiniCard label="Session" value={session.session_id?.slice(0, 12)} mono />
        <MiniCard label="Total Tokens" value={totalTokens.toLocaleString()} />
        <MiniCard label="Messages" value={session.message_count} />
        <MiniCard label="Key" value={session.key_name || '—'} />
      </div>

      {/* Token trend chart */}
      {logs?.length > 0 && <TokenTrendChart logs={logs} />}

      {/* Analysis report */}
      {analysis && <AnalysisReport analysis={analysis} />}

      {/* Request logs table */}
      {logs?.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide mb-2">Request Logs</h3>
          <div className="bg-tf-card border border-tf-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tf-border">
                  {['Time', 'Model', 'Prompt', 'Completion', 'Pattern', 'Score'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-tf-muted uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any, i: number) => (
                  <tr key={i} className="border-b border-tf-border last:border-0 hover:bg-tf-border/30">
                    <td className="px-4 py-3 text-tf-text text-xs">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-tf-text">{log.model}</td>
                    <td className="px-4 py-3 text-tf-text">{log.prompt_tokens?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-tf-text">{log.completion_tokens?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-tf-muted">{log.detected_pattern || '—'}</td>
                    <td className="px-4 py-3 text-tf-text">{log.efficiency_score ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent messages preview */}
      {recent_messages?.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide mb-2">Recent Messages</h3>
          <div className="bg-tf-card border border-tf-border rounded-lg p-4 space-y-2">
            {recent_messages.map((m: any, i: number) => (
              <div key={i} className="text-sm">
                <span className={`font-medium ${m.role === 'user' ? 'text-tf-accent' : 'text-tf-text'}`}>{m.role}: </span>
                <span className="text-tf-muted">{m.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MiniCard({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="bg-tf-card border border-tf-border rounded-lg p-4">
      <div className="text-xs text-tf-muted">{label}</div>
      <div className={`text-lg font-semibold text-tf-text mt-1 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}

function TokenTrendChart({ logs }: { logs: any[] }) {
  // Simple recharts-free bar chart using CSS (avoid heavy import until Phase 3C)
  const maxTokens = Math.max(...logs.map((l: any) => l.prompt_tokens + l.completion_tokens), 1)
  return (
    <div>
      <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide mb-2">Token Trend</h3>
      <div className="bg-tf-card border border-tf-border rounded-lg p-4">
        <div className="flex items-end gap-1 h-32">
          {logs.map((log: any, i: number) => {
            const promptH = (log.prompt_tokens / maxTokens) * 100
            const compH = (log.completion_tokens / maxTokens) * 100
            return (
              <div key={i} className="flex-1 flex flex-col justify-end gap-px min-w-0" title={`#${i + 1}: ${log.prompt_tokens}p / ${log.completion_tokens}c`}>
                <div className="bg-tf-accent/60 rounded-t-sm" style={{ height: `${compH}%` }} />
                <div className="bg-tf-accent/30 rounded-t-sm" style={{ height: `${promptH}%` }} />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-1 text-xs text-tf-muted">
          <span>#{1}</span>
          <span>#{logs.length}</span>
        </div>
        <div className="flex gap-4 mt-2 text-xs text-tf-muted">
          <span><span className="inline-block w-3 h-2 bg-tf-accent/30 rounded mr-1" />Prompt</span>
          <span><span className="inline-block w-3 h-2 bg-tf-accent/60 rounded mr-1" />Completion</span>
        </div>
      </div>
    </div>
  )
}

function AnalysisReport({ analysis }: { analysis: any }) {
  if (!analysis?.logs?.length) return null
  const avgScore = Math.round(analysis.logs.reduce((s: number, l: any) => s + (l.efficiency_score || 0), 0) / analysis.logs.length)
  const patterns = [...new Set(analysis.logs.map((l: any) => l.detected_pattern).filter(Boolean))]
  return (
    <div>
      <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide mb-2">Analysis</h3>
      <div className="bg-tf-card border border-tf-border rounded-lg p-4 space-y-2">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-tf-muted">Avg Score:</span> <span className="text-tf-text font-medium">{avgScore}</span></div>
          <div><span className="text-tf-muted">Patterns:</span> <span className="text-tf-text">{patterns.join(', ') || '—'}</span></div>
        </div>
      </div>
    </div>
  )
}
