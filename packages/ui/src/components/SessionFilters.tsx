import { useState } from 'react'

export type SessionFilters = {
  key_id: string
  pattern: string
  status: string
  efficiency_max: string
  time_range: string
  sort: string
}

const defaults: SessionFilters = { key_id: '', pattern: '', status: '', efficiency_max: '', time_range: '7d', sort: 'time_desc' }

export function SessionFiltersBar({ keys, filters, onChange }: {
  keys: { id: string; name: string }[]
  filters: SessionFilters
  onChange: (f: SessionFilters) => void
}) {
  const update = (patch: Partial<SessionFilters>) => onChange({ ...filters, ...patch })

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <select value={filters.time_range} onChange={e => update({ time_range: e.target.value })}
        className="rounded-lg border border-tf-border bg-tf-bg px-2 py-1.5 text-sm text-tf-text">
        <option value="">All time</option>
        <option value="today">Today</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
      </select>

      <select value={filters.key_id} onChange={e => update({ key_id: e.target.value })}
        className="rounded-lg border border-tf-border bg-tf-bg px-2 py-1.5 text-sm text-tf-text">
        <option value="">All keys</option>
        {keys.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
      </select>

      <select value={filters.pattern} onChange={e => update({ pattern: e.target.value })}
        className="rounded-lg border border-tf-border bg-tf-bg px-2 py-1.5 text-sm text-tf-text">
        <option value="">All patterns</option>
        <option value="full_context">Full Context</option>
        <option value="sliding_window">Sliding Window</option>
        <option value="summarization">Summarization</option>
      </select>

      <select value={filters.status} onChange={e => update({ status: e.target.value })}
        className="rounded-lg border border-tf-border bg-tf-bg px-2 py-1.5 text-sm text-tf-text">
        <option value="">All status</option>
        <option value="active">Active</option>
        <option value="idle">Idle</option>
      </select>

      <select value={filters.sort} onChange={e => update({ sort: e.target.value })}
        className="rounded-lg border border-tf-border bg-tf-bg px-2 py-1.5 text-sm text-tf-text">
        <option value="time_desc">Newest first</option>
        <option value="efficiency_asc">Worst efficiency</option>
        <option value="tokens_desc">Most tokens</option>
      </select>

      <button onClick={() => onChange(defaults)} className="text-xs text-tf-muted hover:text-tf-accent ml-1">Reset</button>
    </div>
  )
}

export function filtersToParams(filters: SessionFilters): Record<string, string> {
  const params: Record<string, string> = {}
  if (filters.key_id) params.key_id = filters.key_id
  if (filters.pattern) params.pattern = filters.pattern
  if (filters.status) params.status = filters.status
  if (filters.efficiency_max) params.efficiency_max = filters.efficiency_max
  if (filters.time_range) {
    const now = new Date()
    let start: Date
    if (filters.time_range === 'today') start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    else if (filters.time_range === '7d') start = new Date(now.getTime() - 7 * 86400000)
    else if (filters.time_range === '30d') start = new Date(now.getTime() - 30 * 86400000)
    else start = new Date(0)
    params.time_start = start.toISOString()
  }
  return params
}

export { defaults as defaultFilters }
