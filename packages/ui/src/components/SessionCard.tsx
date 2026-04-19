import { useState } from 'react'

export function SessionCard({ session, onClick }: { session: any; onClick: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const isActive = isRecent(session.last_activity)
  const totalTokens = (session.total_prompt_tokens || 0) + (session.total_completion_tokens || 0)
  const grade = efficiencyToGrade(session.message_count > 0 ? totalTokens / session.message_count : 0)
  const gradeColor = gradeColorMap[grade] || 'text-tf-muted'

  return (
    <div
      className={`bg-tf-card border border-tf-border rounded-lg overflow-hidden cursor-pointer transition-colors hover:border-tf-accent/40`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Collapsed header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-green-500' : 'bg-tf-muted/50'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-tf-text truncate">{session.session_id?.slice(0, 16)}</span>
            <span className="text-xs text-tf-muted">{session.message_count} msgs</span>
          </div>
          <div className="text-xs text-tf-muted mt-0.5">
            {session.key_name || session.api_key_id?.slice(0, 8)} · {session.current_pattern || '—'}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-medium text-tf-text">{totalTokens.toLocaleString()} tok</div>
          <div className={`text-xs font-semibold ${gradeColor}`}>{grade}</div>
        </div>
        {/* Token heat indicator */}
        <div className={`w-1 self-stretch rounded-full ${tokenHeatColor(totalTokens)}`} />
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-tf-border px-4 py-3 space-y-2" onClick={e => e.stopPropagation()}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-tf-muted">Pattern:</span> <span className="text-tf-text">{session.current_pattern || '—'}</span></div>
            <div><span className="text-tf-muted">Key:</span> <span className="text-tf-text">{session.key_name || '—'}</span></div>
            <div><span className="text-tf-muted">Prompt:</span> <span className="text-tf-text">{session.total_prompt_tokens?.toLocaleString()}</span></div>
            <div><span className="text-tf-muted">Completion:</span> <span className="text-tf-text">{session.total_completion_tokens?.toLocaleString()}</span></div>
            <div><span className="text-tf-muted">Started:</span> <span className="text-tf-text">{new Date(session.start_time).toLocaleString()}</span></div>
            <div><span className="text-tf-muted">Last activity:</span> <span className="text-tf-text">{new Date(session.last_activity).toLocaleString()}</span></div>
          </div>
          <button onClick={onClick} className="text-xs text-tf-accent hover:underline mt-1">
            View full details →
          </button>
        </div>
      )}
    </div>
  )
}

function isRecent(time: string) {
  return Date.now() - new Date(time).getTime() < 5 * 60 * 1000
}

function efficiencyToGrade(avgTokensPerMsg: number) {
  if (avgTokensPerMsg <= 500) return 'A'
  if (avgTokensPerMsg <= 1500) return 'B'
  if (avgTokensPerMsg <= 3000) return 'C'
  return 'D'
}

const gradeColorMap: Record<string, string> = {
  A: 'text-green-500',
  B: 'text-lime-500',
  C: 'text-yellow-500',
  D: 'text-red-500',
}

function tokenHeatColor(tokens: number) {
  if (tokens < 5000) return 'bg-green-400/60'
  if (tokens < 20000) return 'bg-yellow-400/60'
  if (tokens < 100000) return 'bg-orange-400/60'
  return 'bg-red-500/60'
}
