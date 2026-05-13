import { useState, useEffect, useRef } from 'react'
import { fetchConfig, updateConfig, fetchKeys, createKey, deleteKey, fetchProviderModels, fetchDashboard } from '../api'

// Simple pricing map: $ per 1M tokens (prompt, completion)
const MODEL_PRICES: Record<string, [number, number]> = {
  'gpt-4o': [5, 15],
  'gpt-4o-mini': [0.15, 0.6],
  'claude-3-5-sonnet': [3, 15],
  'claude-3-5-sonnet-20241022': [3, 15],
  'claude-3-opus-20240229': [15, 75],
  'deepseek-chat': [0.14, 0.28],
  'deepseek-coder': [0.14, 0.28],
  'gemini-1.5-pro': [1.25, 5],
  'gemini-1.5-flash': [0.075, 0.3],
  'llama-3.1-70b-versatile': [0.59, 0.79],
  'mixtral-8x7b-32768': [0.24, 0.24],
  'gemma-7b-it': [0.1, 0.1],
  'llama3.1-70b': [0.6, 1.2],
  'llama3.1-8b': [0.1, 0.2],
}

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const prices = MODEL_PRICES[model]
  if (!prices) return 0
  const [promptPrice, completionPrice] = prices
  return (promptTokens * promptPrice + completionTokens * completionPrice) / 1_000_000
}

interface Provider {
  name: string
  template: string
  api_base_url: string
  api_key: string
  models: string[]
  options?: Record<string, any>
}

type Endpoint = 'chat.completions' | 'messages'
type Lang = 'curl' | 'python' | 'typescript'

export function ProvidersPage() {
  const [config, setConfig] = useState<any>(null)
  const [keys, setKeys] = useState<any[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [showProviderForm, setShowProviderForm] = useState(false)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [showKeyForm, setShowKeyForm] = useState(false)
  const [keyFormProvider, setKeyFormProvider] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [cfgRes, keysRes, dashRes] = await Promise.all([
        fetchConfig(), fetchKeys(), fetchDashboard('7d')
      ])
      setConfig(cfgRes.data)
      setKeys(keysRes.data || [])
      setDashboard(dashRes.data)
    } catch (err: any) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const providers: Provider[] = config?.Providers || []

  const handleSaveProvider = async (form: Provider) => {
    const isNew = !providers.find(p => p.name === form.name)
    const newProviders = isNew
      ? [...providers, form]
      : providers.map(p => (p.name === form.name ? form : p))

    await updateConfig({ ...config, Providers: newProviders })

    if (isNew) {
      await createKey({ name: `${form.name} default`, provider: form.name })
    }

    setShowProviderForm(false)
    setEditingProvider(null)
    await loadData()
    if (isNew) setSelectedProvider(form.name)
  }

  const handleDeleteProvider = async (name: string) => {
    if (!confirm(`Delete provider "${name}"? All associated keys will stop working.`)) return
    const newProviders = providers.filter(p => p.name !== name)
    await updateConfig({ ...config, Providers: newProviders })
    await loadData()
    if (selectedProvider === name) setSelectedProvider(null)
  }

  const handleCreateKey = async (providerName: string, name: string, scenario?: string) => {
    await createKey({ name, provider: providerName, scenario })
    setShowKeyForm(false)
    setKeyFormProvider(null)
    await loadData()
  }

  const handleDeleteKey = async (id: string, name: string) => {
    if (!confirm(`Delete key "${name}"?`)) return
    await deleteKey(id)
    await loadData()
  }

  const selected = providers.find(p => p.name === selectedProvider)
  const providerKeys = keys.filter((k: any) => k.provider === selectedProvider)

  const endpointBase = `http://${window.location.hostname}:${config?.PORT || 3000}`

  if (loading) return <div className="text-tf-muted text-sm py-8 text-center">Loading providers...</div>
  if (error) return <div className="text-red-500 text-sm py-8 text-center">{error}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-tf-muted uppercase tracking-wide">Providers</h2>
        <button
          onClick={() => { setEditingProvider(null); setShowProviderForm(true) }}
          className="px-3 py-1.5 text-sm bg-tf-accent text-white rounded-lg hover:opacity-90"
        >
          Add Provider
        </button>
      </div>

      {providers.length === 0 ? (
        <div className="text-tf-muted text-sm py-8 text-center">
          No providers configured. Click "Add Provider" to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((p) => {
            const providerKeys = keys.filter((k: any) => k.provider === p.name)
            const keyCount = providerKeys.length
            const isSelected = selectedProvider === p.name
            const stats = computeProviderStats(p.name, providerKeys, dashboard)
            return (
              <div
                key={p.name}
                onClick={() => setSelectedProvider(isSelected ? null : p.name)}
                className={`bg-tf-card border rounded-xl p-4 cursor-pointer transition-all ${
                  isSelected ? 'border-tf-accent ring-1 ring-tf-accent/30' : 'border-tf-border hover:border-tf-accent/50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-tf-text">{p.name}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 bg-tf-border rounded-full capitalize text-tf-muted">
                      {p.template || 'openai'}
                    </span>
                  </div>
                  <span className="text-xs text-tf-muted">{keyCount} key{keyCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="text-xs text-tf-muted truncate mb-3">{p.api_base_url}</div>

                {/* Usage metadata */}
                {stats.totalTokens > 0 && (
                  <div className="mb-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-tf-muted">7d usage</span>
                      <span className="text-tf-text font-medium">{formatProviderTokens(stats.totalTokens)} tok</span>
                    </div>
                    {stats.sparkline.length > 0 && (
                      <div className="h-8 flex items-end gap-px">
                        {stats.sparkline.map((v: number, i: number) => {
                          const max = Math.max(...stats.sparkline, 1)
                          const h = Math.max(2, (v / max) * 100)
                          return (
                            <div
                              key={i}
                              className="flex-1 bg-tf-accent/40 rounded-t-sm"
                              style={{ height: `${h}%` }}
                              title={`${v} tokens`}
                            />
                          )
                        })}
                      </div>
                    )}
                    {stats.estimatedCost > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-tf-muted">Est. cost</span>
                        <span className="text-tf-text font-medium">${stats.estimatedCost.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingProvider(p); setShowProviderForm(true) }}
                    className="text-xs px-2 py-1 rounded border border-tf-border text-tf-muted hover:text-tf-accent hover:border-tf-accent/50 transition-colors"
                  >Edit</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteProvider(p.name) }}
                    className="text-xs px-2 py-1 rounded border border-tf-border text-tf-muted hover:text-red-500 hover:border-red-500/50 transition-colors"
                  >Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Provider detail + Keys + Examples */}
      {selected && (
        <div className="bg-tf-card border border-tf-border rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-tf-text">{selected.name}</h3>
              <span className="text-xs px-2 py-0.5 bg-tf-border rounded capitalize">{selected.template || 'openai'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-tf-muted mb-1">Base URL</div>
              <div className="text-tf-text text-xs break-all">{selected.api_base_url}</div>
            </div>
            <div>
              <div className="text-xs text-tf-muted mb-1">API Key</div>
              <div className="text-tf-text">{selected.api_key ? '••••••••' : 'Not set'}</div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-tf-muted mb-1">Models</div>
              <div className="text-tf-text text-xs">{(selected.models || []).join(', ') || 'All models allowed'}</div>
            </div>
            {selected.options && Object.keys(selected.options).length > 0 && (
              <div className="col-span-2">
                <div className="text-xs text-tf-muted mb-1">Options</div>
                <div className="text-tf-text text-xs font-mono">{JSON.stringify(selected.options)}</div>
              </div>
            )}
          </div>

          <div className="border-t border-tf-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-tf-muted uppercase tracking-wide">Keys</h4>
              <button
                onClick={() => { setKeyFormProvider(selected.name); setShowKeyForm(true) }}
                className="text-xs text-tf-accent hover:underline"
              >
                + Add Key
              </button>
            </div>

            {providerKeys.length === 0 ? (
              <div className="text-tf-muted text-xs py-2">No keys for this provider.</div>
            ) : (
              <div className="space-y-2">
                {providerKeys.map((k: any) => (
                  <div key={k.id} className="flex items-center justify-between bg-tf-bg border border-tf-border rounded-lg px-3 py-2">
                    <div>
                      <div className="text-sm text-tf-text">{k.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <code className="text-xs text-tf-muted font-mono">{k.id.slice(0, 8)}...{k.id.slice(-4)}</code>
                        <CopyKeyButton keyId={k.id} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {k.scenario && <span className="text-xs text-tf-muted bg-tf-border px-1.5 py-0.5 rounded">{k.scenario}</span>}
                      <button
                        onClick={() => handleDeleteKey(k.id, k.name)}
                        className="text-xs text-tf-muted hover:text-red-500"
                      >Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Usage Examples */}
            {providerKeys.length > 0 && (
              <div className="mt-4 bg-tf-bg border border-tf-border rounded-lg p-3 space-y-3">
                <ApiExampleTabs
                  endpointBase={endpointBase}
                  apiKey={providerKeys[0]?.id}
                  template={selected.template || 'openai'}
                  providerName={selected.name}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {showProviderForm && (
        <ProviderFormModal
          initial={editingProvider}
          onSubmit={handleSaveProvider}
          onClose={() => { setShowProviderForm(false); setEditingProvider(null) }}
        />
      )}

      {showKeyForm && keyFormProvider && (
        <KeyFormModal
          providerName={keyFormProvider}
          onSubmit={(name, scenario) => handleCreateKey(keyFormProvider, name, scenario)}
          onClose={() => { setShowKeyForm(false); setKeyFormProvider(null) }}
        />
      )}
    </div>
  )
}

function CopyKeyButton({ keyId }: { keyId: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(keyId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = keyId
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy full key'}
      className="text-[11px] px-1.5 py-0.5 rounded border border-tf-border text-tf-muted hover:text-tf-accent hover:border-tf-accent/50 transition-colors"
    >
      {copied ? '✓' : 'Copy'}
    </button>
  )
}

function formatProviderTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function computeProviderStats(providerName: string, providerKeys: any[], dashboard: any | null) {
  if (!dashboard?.key_distribution) {
    return { totalTokens: 0, sparkline: [], estimatedCost: 0 }
  }

  const keyIds = new Set(providerKeys.map((k) => k.id))

  // Total tokens from key_distribution
  let totalTokens = 0
  let totalRequests = 0
  for (const kd of dashboard.key_distribution) {
    if (keyIds.has(kd.api_key_id)) {
      totalTokens += kd.total_tokens || 0
      totalRequests += kd.request_count || 0
    }
  }

  // Sparkline from key_trends aggregated by window
  const windowMap = new Map<string, number>()
  if (dashboard.key_trends) {
    for (const kt of dashboard.key_trends) {
      if (keyIds.has(kt.api_key_id)) {
        const w = kt.window_start as string
        windowMap.set(w, (windowMap.get(w) || 0) + (kt.total_tokens || 0))
      }
    }
  }
  const sparkline = Array.from(windowMap.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([, v]) => v)

  // Rough cost estimate: use average of model prices if we have model distribution
  let estimatedCost = 0
  if (dashboard.model_distribution) {
    for (const md of dashboard.model_distribution) {
      const prices = MODEL_PRICES[md.model]
      if (prices) {
        // Rough: assume 70% prompt, 30% completion
        const prompt = md.total_tokens * 0.7
        const completion = md.total_tokens * 0.3
        estimatedCost += estimateCost(md.model, prompt, completion)
      }
    }
    // Scale down by provider's share of total tokens
    const globalTotal = dashboard.model_distribution.reduce(
      (s: number, m: any) => s + (m.total_tokens || 0), 0
    )
    if (globalTotal > 0) {
      estimatedCost = estimatedCost * (totalTokens / globalTotal)
    }
  }

  return { totalTokens, sparkline, estimatedCost }
}

function ApiExampleTabs({ endpointBase, apiKey, template, providerName }: {
  endpointBase: string
  apiKey: string
  template: string
  providerName: string
}) {
  const [endpoint, setEndpoint] = useState<Endpoint>('chat.completions')
  const [lang, setLang] = useState<Lang>('curl')
  const defaultModel = endpoint === 'messages'
    ? 'claude-3-5-sonnet-20241022'
    : template === 'anthropic'
      ? 'claude-3-5-sonnet'
      : 'gpt-4'
  const [customModel, setCustomModel] = useState(defaultModel)

  // Update default model when endpoint/template changes, but only if user hasn't typed something custom
  useEffect(() => {
    setCustomModel(prev => {
      const expected = endpoint === 'messages'
        ? 'claude-3-5-sonnet-20241022'
        : template === 'anthropic'
          ? 'claude-3-5-sonnet'
          : 'gpt-4'
      // If current value matches any known default, update it; otherwise keep user's custom value
      const knownDefaults = ['claude-3-5-sonnet-20241022', 'claude-3-5-sonnet', 'gpt-4']
      return knownDefaults.includes(prev) ? expected : prev
    })
  }, [endpoint, template])

  const url = `${endpointBase}${endpoint === 'chat.completions' ? '/v1/chat/completions' : '/v1/messages'}`
  const code = makeExample(lang, endpoint, url, apiKey, customModel)

  return (
    <div className="space-y-3">
      {/* Endpoint tabs */}
      <div className="flex gap-1 bg-tf-card rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setEndpoint('chat.completions')}
          className={`text-xs px-3 py-1 rounded-md transition-colors ${
            endpoint === 'chat.completions' ? 'bg-tf-accent text-white' : 'text-tf-muted hover:text-tf-text'
          }`}
        >
          Chat Completions
        </button>
        <button
          onClick={() => setEndpoint('messages')}
          className={`text-xs px-3 py-1 rounded-md transition-colors ${
            endpoint === 'messages' ? 'bg-tf-accent text-white' : 'text-tf-muted hover:text-tf-text'
          }`}
        >
          Messages
        </button>
      </div>

      {/* Model input */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-tf-muted shrink-0">Model</label>
        <input
          value={customModel}
          onChange={e => setCustomModel(e.target.value)}
          placeholder="e.g. gpt-4, claude-3-5-sonnet"
          className="flex-1 min-w-0 rounded border border-tf-border bg-tf-bg px-2 py-1 text-xs text-tf-text focus:border-tf-accent focus:outline-none"
        />
      </div>

      {/* Conversion hint */}
      <ConversionHint endpoint={endpoint} template={template} />

      {/* Language tabs */}
      <div className="flex gap-3 border-b border-tf-border pb-1">
        {(['curl', 'python', 'typescript'] as Lang[]).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`text-xs pb-1 transition-colors capitalize ${
              lang === l ? 'text-tf-accent border-b border-tf-accent' : 'text-tf-muted hover:text-tf-text'
            }`}
          >
            {l === 'curl' ? 'cURL' : l}
          </button>
        ))}
      </div>

      <div className="relative">
        <CopyButton text={code} />
        <pre className="text-xs text-tf-text font-mono bg-tf-card p-3 pt-8 rounded-lg overflow-x-auto leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>

      <div className="text-xs text-tf-muted">
        Using key <span className="font-mono text-tf-text">{apiKey.slice(0, 8)}...{apiKey.slice(-4)}</span> via <span className="font-mono text-tf-text">{providerName}</span>
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Fallback for older browsers or non-secure contexts
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 z-10 text-[11px] px-2 py-1 rounded border border-tf-border bg-tf-bg text-tf-muted hover:text-tf-accent hover:border-tf-accent/50 transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function ConversionHint({ endpoint, template }: { endpoint: Endpoint; template: string }) {
  const isDirect = (endpoint === 'chat.completions' && template === 'openai') || (endpoint === 'messages' && template === 'anthropic')

  if (isDirect) {
    const style = endpoint === 'chat.completions' ? 'OpenAI' : 'Anthropic'
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>直接转发 — 客户端 {style} 格式 → 上游 {style} 格式，无转换</span>
      </div>
    )
  }

  if (endpoint === 'messages' && template === 'openai') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17l9.2-9.2M17 17V7H7" />
        </svg>
        <span>格式转换 — 客户端 Anthropic 格式 → Token Flow 转换为 OpenAI 格式 → 上游 OpenAI 格式</span>
      </div>
    )
  }

  if (endpoint === 'chat.completions' && template === 'anthropic') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17l9.2-9.2M17 17V7H7" />
        </svg>
        <span>格式转换 — 客户端 OpenAI 格式 → Token Flow 转换为 Anthropic 格式 → 上游 Anthropic 格式</span>
      </div>
    )
  }

  // Generic conversion hint for other templates
  const templateLabel = template.charAt(0).toUpperCase() + template.slice(1)
  const clientFormat = endpoint === 'messages' ? 'Anthropic' : 'OpenAI'
  return (
    <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17l9.2-9.2M17 17V7H7" />
      </svg>
      <span>格式转换 — 客户端 {clientFormat} 格式 → Token Flow 转换为 {templateLabel} 格式</span>
    </div>
  )
}

function makeExample(lang: Lang, endpoint: Endpoint, url: string, apiKey: string, model: string): string {
  if (lang === 'curl') {
    if (endpoint === 'chat.completions') {
      return `curl ${url} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '{
    "model": "${model}",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'`
    }
    return `curl ${url} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{
    "model": "${model}",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'`
  }

  if (lang === 'python') {
    if (endpoint === 'chat.completions') {
      return `import requests

response = requests.post(
    "${url}",
    headers={
        "Content-Type": "application/json",
        "X-API-Key": "${apiKey}",
    },
    json={
        "model": "${model}",
        "messages": [
            {"role": "user", "content": "Hello"}
        ]
    }
)
print(response.json())`
    }
    return `import requests

response = requests.post(
    "${url}",
    headers={
        "Content-Type": "application/json",
        "X-API-Key": "${apiKey}",
        "anthropic-version": "2023-06-01",
    },
    json={
        "model": "${model}",
        "max_tokens": 1024,
        "messages": [
            {"role": "user", "content": "Hello"}
        ]
    }
)
print(response.json())`
  }

  // typescript
  if (endpoint === 'chat.completions') {
    return `const response = await fetch("${url}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${apiKey}",
  },
  body: JSON.stringify({
    model: "${model}",
    messages: [
      { role: "user", content: "Hello" }
    ]
  })
});

const data = await response.json();
console.log(data);`
  }
  return `const response = await fetch("${url}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${apiKey}",
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({
    model: "${model}",
    max_tokens: 1024,
    messages: [
      { role: "user", content: "Hello" }
    ]
  })
});

const data = await response.json();
console.log(data);`
}

function ProviderFormModal({
  initial,
  onSubmit,
  onClose,
}: {
  initial: Provider | null
  onSubmit: (p: Provider) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<Provider>({
    name: initial?.name || '',
    template: initial?.template || 'openai',
    api_base_url: initial?.api_base_url || '',
    api_key: initial?.api_key || '',
    models: initial?.models ? [...initial.models] : [],
    options: initial?.options ? { ...initial.options } : {},
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [extraHeaders, setExtraHeaders] = useState<{ key: string; value: string }[]>(
    Object.entries(initial?.options?.extra_headers || {}).map(([key, value]) => ({
      key,
      value: String(value),
    }))
  )

  const isEdit = !!initial

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-tf-card border border-tf-border rounded-xl shadow-lg w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-tf-text mb-4">{isEdit ? 'Edit Provider' : 'Add Provider'}</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const headers: Record<string, string> = {}
            for (const h of extraHeaders) {
              if (h.key.trim()) headers[h.key.trim()] = h.value
            }
            const nextOptions: Record<string, any> = { ...form.options }
            if (Object.keys(headers).length > 0) {
              nextOptions.extra_headers = headers
            } else {
              delete nextOptions.extra_headers
            }
            const payload: Provider = {
              ...form,
              options: Object.keys(nextOptions).length > 0 ? nextOptions : undefined,
            }
            onSubmit(payload)
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="text-xs font-medium text-tf-muted">Name</span>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
              disabled={isEdit}
              placeholder="e.g. OpenRouter"
              className="mt-1 block w-full rounded-lg border border-tf-border bg-tf-bg px-3 py-1.5 text-sm text-tf-text placeholder:text-tf-muted/50 focus:border-tf-accent focus:outline-none disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-tf-muted">Template</span>
            <select
              value={form.template}
              onChange={e => setForm({ ...form, template: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-tf-border bg-tf-bg px-3 py-1.5 text-sm text-tf-text focus:border-tf-accent focus:outline-none"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="openai-responses">OpenAI (Responses API)</option>
              <option value="gemini">Gemini</option>
              <option value="deepseek">DeepSeek</option>
              <option value="openrouter">OpenRouter</option>
              <option value="groq">Groq</option>
              <option value="cerebras">Cerebras</option>
              <option value="vercel">Vercel</option>
              <option value="vertex-gemini">Vertex Gemini</option>
              <option value="vertex-claude">Vertex Claude</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-tf-muted">Base URL</span>
            <input
              value={form.api_base_url}
              onChange={e => setForm({ ...form, api_base_url: e.target.value })}
              required
              placeholder="https://api.example.com/v1"
              className="mt-1 block w-full rounded-lg border border-tf-border bg-tf-bg px-3 py-1.5 text-sm text-tf-text placeholder:text-tf-muted/50 focus:border-tf-accent focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-tf-muted">API Key</span>
            <input
              type="password"
              value={form.api_key}
              onChange={e => setForm({ ...form, api_key: e.target.value })}
              required={!isEdit}
              placeholder={isEdit ? 'Leave empty to keep current' : 'sk-...'}
              className="mt-1 block w-full rounded-lg border border-tf-border bg-tf-bg px-3 py-1.5 text-sm text-tf-text placeholder:text-tf-muted/50 focus:border-tf-accent focus:outline-none"
            />
          </label>

          <ModelSelector
            models={form.models}
            onChange={models => setForm({ ...form, models })}
            providerName={form.name}
            disabled={!form.name || !form.api_base_url}
          />

          {/* Advanced Options */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="text-xs text-tf-muted hover:text-tf-text flex items-center gap-1"
            >
              <span>{showAdvanced ? '▼' : '▶'}</span>
              Advanced Options
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 border border-tf-border rounded-lg p-3 bg-tf-bg/50">
                {/* Extra Headers */}
                <div>
                  <div className="text-xs font-medium text-tf-muted mb-2">Extra Headers</div>
                  {extraHeaders.length === 0 && (
                    <div className="text-xs text-tf-muted mb-2">No extra headers configured.</div>
                  )}
                  <div className="space-y-2">
                    {extraHeaders.map((h, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          value={h.key}
                          onChange={e => {
                            const next = [...extraHeaders]
                            next[i].key = e.target.value
                            setExtraHeaders(next)
                          }}
                          placeholder="Header name"
                          className="flex-1 min-w-0 rounded border border-tf-border bg-tf-bg px-2 py-1 text-xs text-tf-text placeholder:text-tf-muted/50 focus:border-tf-accent focus:outline-none"
                        />
                        <input
                          value={h.value}
                          onChange={e => {
                            const next = [...extraHeaders]
                            next[i].value = e.target.value
                            setExtraHeaders(next)
                          }}
                          placeholder="Value"
                          className="flex-1 min-w-0 rounded border border-tf-border bg-tf-bg px-2 py-1 text-xs text-tf-text placeholder:text-tf-muted/50 focus:border-tf-accent focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setExtraHeaders(extraHeaders.filter((_, idx) => idx !== i))}
                          className="text-xs text-tf-muted hover:text-red-500 px-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setExtraHeaders([...extraHeaders, { key: '', value: '' }])}
                    className="mt-2 text-xs text-tf-accent hover:underline"
                  >
                    + Add header
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-tf-muted hover:text-tf-text rounded-lg">Cancel</button>
            <button
              type="submit"
              className="px-3 py-1.5 text-sm bg-tf-accent text-white rounded-lg hover:opacity-90"
            >
              {isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModelSelector({
  models,
  onChange,
  providerName,
  disabled,
}: {
  models: string[]
  onChange: (models: string[]) => void
  providerName: string
  disabled?: boolean
}) {
  const [input, setInput] = useState('')
  const [available, setAvailable] = useState<string[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadModels = async () => {
    if (!providerName) return
    setLoading(true)
    try {
      const res = await fetchProviderModels(providerName)
      setAvailable(res.data.models || [])
      setFetchedAt(res.data.fetched_at || null)
    } catch {
      // silent fallback
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = available.filter(
    m => m.toLowerCase().includes(input.toLowerCase()) && !models.includes(m)
  )

  const addModel = (model: string) => {
    if (!models.includes(model)) {
      onChange([...models, model])
    }
    setInput('')
    setShowDropdown(false)
  }

  const removeModel = (model: string) => {
    onChange(models.filter(m => m !== model))
  }

  return (
    <div className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-tf-muted">Models</span>
        <button
          type="button"
          onClick={loadModels}
          disabled={loading || disabled}
          title={fetchedAt ? `Last fetched: ${fetchedAt}` : 'Fetch available models'}
          className="text-xs px-2 py-0.5 rounded border border-tf-border text-tf-muted hover:text-tf-accent hover:border-tf-accent/50 transition-colors disabled:opacity-40"
        >
          {loading ? '...' : '🔄 Fetch'}
        </button>
      </div>

      {/* Tags */}
      {models.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {models.map(m => (
            <span
              key={m}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-tf-border text-tf-text"
            >
              {m}
              <button
                type="button"
                onClick={() => removeModel(m)}
                className="text-tf-muted hover:text-red-500 leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input + Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <input
          value={input}
          onChange={e => { setInput(e.target.value); setShowDropdown(true) }}
          onFocus={() => setShowDropdown(true)}
          placeholder={available.length > 0 ? 'Type to search models...' : 'Type model name and press Enter'}
          disabled={disabled}
          onKeyDown={e => {
            if (e.key === 'Enter' && input.trim()) {
              e.preventDefault()
              addModel(input.trim())
            }
          }}
          className="block w-full rounded-lg border border-tf-border bg-tf-bg px-3 py-1.5 text-sm text-tf-text placeholder:text-tf-muted/50 focus:border-tf-accent focus:outline-none disabled:opacity-50"
        />
        {showDropdown && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto bg-tf-card border border-tf-border rounded-lg shadow-lg">
            {filtered.slice(0, 50).map(m => (
              <div
                key={m}
                onClick={() => addModel(m)}
                className="px-3 py-1.5 text-xs text-tf-text hover:bg-tf-border cursor-pointer truncate"
              >
                {m}
              </div>
            ))}
          </div>
        )}
      </div>

      {available.length === 0 && !loading && !disabled && (
        <div className="text-[11px] text-tf-muted mt-1">
          Click 🔄 Fetch to load available models from upstream, or type manually.
        </div>
      )}
    </div>
  )
}

function KeyFormModal({
  providerName,
  onSubmit,
  onClose,
}: {
  providerName: string
  onSubmit: (name: string, scenario?: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [scenario, setScenario] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-tf-card border border-tf-border rounded-xl shadow-lg w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-tf-text mb-4">Add Key for {providerName}</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit(name, scenario || undefined)
            setName('')
            setScenario('')
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="text-xs font-medium text-tf-muted">Name</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="e.g. production"
              className="mt-1 block w-full rounded-lg border border-tf-border bg-tf-bg px-3 py-1.5 text-sm text-tf-text placeholder:text-tf-muted/50 focus:border-tf-accent focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-tf-muted">Scenario</span>
            <input
              value={scenario}
              onChange={e => setScenario(e.target.value)}
              placeholder="e.g. dev, staging"
              className="mt-1 block w-full rounded-lg border border-tf-border bg-tf-bg px-3 py-1.5 text-sm text-tf-text placeholder:text-tf-muted/50 focus:border-tf-accent focus:outline-none"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-tf-muted hover:text-tf-text rounded-lg">Cancel</button>
            <button type="submit" className="px-3 py-1.5 text-sm bg-tf-accent text-white rounded-lg hover:opacity-90">Create</button>
          </div>
        </form>
      </div>
    </div>
  )
}
