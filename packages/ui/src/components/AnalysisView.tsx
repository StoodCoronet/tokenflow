import { useState, useEffect } from 'react'
import { fetchSessions, fetchAnalysis } from '../api'

export function AnalysisView() {
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchSessions({ limit: '50' })
      .then(r => {
        const d = r.data
        setSessions(d.sessions ?? d)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedId) { setAnalysis(null); return }
    setLoading(true)
    fetchAnalysis(selectedId)
      .then(r => setAnalysis(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedId])

  const grade = efficiencyToGrade(analysis)
  const gradeColor = gradeColorMap[grade]

  return (
    <div className="space-y-6">
      {/* Session selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-tf-muted">Session:</label>
        <select
          value={selectedId ?? ''}
          onChange={e => setSelectedId(e.target.value || null)}
          className="rounded-lg border border-tf-border bg-tf-bg px-3 py-1.5 text-sm text-tf-text flex-1 max-w-md"
        >
          <option value="">Select a session...</option>
          {sessions.map((s: any) => (
            <option key={s.session_id} value={s.session_id}>
              {s.session_id.slice(0, 12)} — {s.current_pattern || 'no pattern'} — {(s.total_prompt_tokens + s.total_completion_tokens).toLocaleString()} tok
            </option>
          ))}
        </select>
      </div>

      {!selectedId && (
        <div className="text-tf-muted text-sm py-12 text-center">Select a session to view analysis.</div>
      )}

      {loading && <div className="text-tf-muted text-sm py-8 text-center">Loading analysis...</div>}

      {!loading && analysis && (
        <>
          {/* Efficiency grade */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-tf-card border border-tf-border rounded-lg p-5 text-center">
              <div className="text-xs text-tf-muted uppercase tracking-wide mb-2">Efficiency Grade</div>
              <div className={`text-4xl font-bold ${gradeColor}`}>{grade}</div>
            </div>
            <div className="bg-tf-card border border-tf-border rounded-lg p-5">
              <div className="text-xs text-tf-muted uppercase tracking-wide mb-2">Requests Analyzed</div>
              <div className="text-2xl font-semibold text-tf-text">{analysis.logs?.length ?? 0}</div>
            </div>
            <div className="bg-tf-card border border-tf-border rounded-lg p-5">
              <div className="text-xs text-tf-muted uppercase tracking-wide mb-2">Patterns Detected</div>
              <div className="text-lg font-semibold text-tf-text">
                {[...new Set(analysis.logs?.map((l: any) => l.detected_pattern).filter(Boolean))].join(', ') || '—'}
              </div>
            </div>
          </div>

          {/* Per-request breakdown */}
          {analysis.logs?.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide mb-2">Per-Request Breakdown</h3>
              <div className="bg-tf-card border border-tf-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-tf-border">
                      <th className="text-left px-4 py-3 text-xs font-medium text-tf-muted uppercase">#</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-tf-muted uppercase">Time</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-tf-muted uppercase">Pattern</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-tf-muted uppercase">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.logs.map((log: any, i: number) => (
                      <tr key={i} className="border-b border-tf-border last:border-0 hover:bg-tf-border/30">
                        <td className="px-4 py-3 text-tf-muted">{i + 1}</td>
                        <td className="px-4 py-3 text-tf-text text-xs">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3 text-tf-text">{log.detected_pattern || '—'}</td>
                        <td className="px-4 py-3 text-tf-text">{log.efficiency_score ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Suggestions */}
          {grade === 'C' || grade === 'D' ? (
            <div className="bg-tf-card border border-tf-border rounded-lg p-4">
              <h3 className="text-xs font-medium text-tf-muted uppercase tracking-wide mb-2">Recommendations</h3>
              <ul className="space-y-1 text-sm text-tf-text">
                <li>Consider switching from <code className="bg-tf-border/50 px-1 py-0.5 rounded text-xs">full_context</code> to <code className="bg-tf-border/50 px-1 py-0.5 rounded text-xs">sliding_window</code> to reduce token waste.</li>
                <li>Review repeated context patterns — prompt tokens are growing each turn.</li>
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function efficiencyToGrade(analysis: any): string {
  if (!analysis?.logs?.length) return '—'
  const avg = analysis.logs.reduce((s: number, l: any) => s + (l.efficiency_score || 0), 0) / analysis.logs.length
  if (avg >= 80) return 'A'
  if (avg >= 60) return 'B'
  if (avg >= 40) return 'C'
  return 'D'
}

const gradeColorMap: Record<string, string> = {
  A: 'text-green-500',
  B: 'text-lime-500',
  C: 'text-yellow-500',
  D: 'text-red-500',
  '—': 'text-tf-muted',
}
