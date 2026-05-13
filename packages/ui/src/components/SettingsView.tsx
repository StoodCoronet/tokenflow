import { useState, useEffect } from 'react'
import { fetchConfig, updateConfig } from '../api'

export function SettingsView() {
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    fetchConfig()
      .then(r => setConfig(r.data))
      .catch(() => setMessage({ text: 'Failed to load config', ok: false }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-tf-muted text-sm py-8 text-center">Loading settings...</div>
  if (!config) return <div className="text-tf-muted text-sm py-8 text-center">No config found.</div>

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const r = await updateConfig(config)
      setConfig(r.data.config)
      setMessage({ text: 'Settings saved successfully.', ok: true })
    } catch {
      setMessage({ text: 'Failed to save settings.', ok: false })
    } finally {
      setSaving(false)
    }
  }

  const toggleDetector = (key: string) => {
    setConfig({
      ...config,
      Detectors: {
        ...config.Detectors,
        [key]: { enabled: !config.Detectors[key]?.enabled },
      },
    })
  }

  const detectorLabels: Record<string, string> = {
    fullContext: 'Full Context',
    slidingWindow: 'Sliding Window',
    summarization: 'Summarization',
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.ok ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'}`}>
          {message.text}
        </div>
      )}

      {/* General */}
      <Section title="General">
        <FieldRow label="Server Port">
          <input value={config.PORT} readOnly className={inputClass} />
          <span className="text-xs text-tf-muted ml-2">requires restart</span>
        </FieldRow>
        <FieldRow label="UI Port">
          <input value={config.UI_PORT} readOnly className={inputClass} />
          <span className="text-xs text-tf-muted ml-2">requires restart</span>
        </FieldRow>
        <FieldRow label="Log Level">
          <select
            value={config.LOG_LEVEL}
            onChange={e => setConfig({ ...config, LOG_LEVEL: e.target.value })}
            className={inputClass}
          >
            {['debug', 'info', 'warn', 'error'].map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Proxy URL">
          <input
            value={config.PROXY_URL || ''}
            onChange={e => setConfig({ ...config, PROXY_URL: e.target.value })}
            placeholder="http://127.0.0.1:7890"
            className={inputClass}
          />
        </FieldRow>
        <FieldRow label="Pricing Source">
          <input
            value={config.pricingSource || ''}
            onChange={e => setConfig({ ...config, pricingSource: e.target.value })}
            placeholder="https://your-domain.com/pricing.json"
            className={inputClass}
          />
        </FieldRow>
      </Section>

      {/* Detectors */}
      <Section title="Detectors">
        <div className="space-y-3">
          {Object.entries(config.Detectors || {}).map(([key, val]: [string, any]) => (
            <div key={key} className="flex items-center justify-between py-2">
              <span className="text-sm text-tf-text">{detectorLabels[key] || key}</span>
              <Toggle checked={val?.enabled ?? true} onChange={() => toggleDetector(key)} />
            </div>
          ))}
        </div>
      </Section>

      {/* Pricing */}
      <Section title="Pricing" action={
        <button
          onClick={() => {
            const model = prompt('Model name:')
            if (!model) return
            setConfig({
              ...config,
              Pricing: {
                ...config.Pricing,
                [model]: { prompt: 0, completion: 0 },
              },
            })
          }}
          className="text-xs px-2 py-1 bg-tf-accent/10 text-tf-accent rounded hover:bg-tf-accent/20"
        >
          + Add Model
        </button>
      }>
        {Object.entries(config.Pricing || {}).length === 0 ? (
          <div className="text-sm text-tf-muted py-2">No custom pricing. Default prices will be used.</div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_80px_80px_32px] gap-2 text-xs text-tf-muted px-1">
              <span>Model</span>
              <span className="text-right">Prompt</span>
              <span className="text-right">Completion</span>
              <span />
            </div>
            {Object.entries(config.Pricing || {}).map(([model, p]: [string, any]) => (
              <div key={model} className="grid grid-cols-[1fr_80px_80px_32px] gap-2 items-center">
                <span className="text-sm text-tf-text truncate" title={model}>{model}</span>
                <input
                  type="number"
                  step="0.001"
                  value={p?.prompt ?? 0}
                  onChange={e => {
                    const val = parseFloat(e.target.value)
                    setConfig({
                      ...config,
                      Pricing: {
                        ...config.Pricing,
                        [model]: { ...p, prompt: Number.isNaN(val) ? 0 : val },
                      },
                    })
                  }}
                  className={`${inputClass} !py-1 !px-2 text-right`}
                />
                <input
                  type="number"
                  step="0.001"
                  value={p?.completion ?? 0}
                  onChange={e => {
                    const val = parseFloat(e.target.value)
                    setConfig({
                      ...config,
                      Pricing: {
                        ...config.Pricing,
                        [model]: { ...p, completion: Number.isNaN(val) ? 0 : val },
                      },
                    })
                  }}
                  className={`${inputClass} !py-1 !px-2 text-right`}
                />
                <button
                  onClick={() => {
                    const next = { ...config.Pricing }
                    delete next[model]
                    setConfig({ ...config, Pricing: next })
                  }}
                  className="text-xs text-red-500 hover:text-red-400"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Save */}
      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 text-sm bg-tf-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-tf-muted uppercase tracking-wide">{title}</h2>
        {action}
      </div>
      <div className="bg-tf-card border border-tf-border rounded-lg p-4">
        {children}
      </div>
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <label className="text-sm text-tf-muted w-40 shrink-0">{label}</label>
      <div className="flex items-center flex-1">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-tf-accent' : 'bg-tf-border'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}

const inputClass = 'rounded-lg border border-tf-border bg-tf-bg px-3 py-1.5 text-sm text-tf-text w-full focus:outline-none focus:border-tf-accent'
