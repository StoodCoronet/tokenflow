import { useState, useEffect } from 'react'
import { fetchConfig, updateConfig, fetchKeys, createKey, deleteKey } from '../api'

interface Provider {
  name: string
  template: string
  api_base_url: string
  api_key: string
  models: string[]
}

export function ProvidersPage() {
  const [config, setConfig] = useState<any>(null)
  const [keys, setKeys] = useState<any[]>([])
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
      const [cfgRes, keysRes] = await Promise.all([fetchConfig(), fetchKeys()])
      setConfig(cfgRes.data)
      setKeys(keysRes.data || [])
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
      // Auto-create a default key for the new provider
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
      {/* Provider list */}
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
        <div className="bg-tf-card border border-tf-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tf-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-tf-muted uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-tf-muted uppercase tracking-wide">Template</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-tf-muted uppercase tracking-wide">Base URL</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-tf-muted uppercase tracking-wide">Keys</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => {
                const keyCount = keys.filter((k: any) => k.provider === p.name).length
                const isSelected = selectedProvider === p.name
                return (
                  <tr
                    key={p.name}
                    className={`border-b border-tf-border last:border-0 cursor-pointer transition-colors ${isSelected ? 'bg-tf-accent/5' : 'hover:bg-tf-border/30'}`}
                    onClick={() => setSelectedProvider(isSelected ? null : p.name)}
                  >
                    <td className="px-4 py-3 text-tf-text font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-tf-text capitalize">{p.template || 'openai'}</td>
                    <td className="px-4 py-3 text-tf-muted text-xs">{p.api_base_url}</td>
                    <td className="px-4 py-3 text-tf-text">{keyCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3 justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingProvider(p); setShowProviderForm(true) }}
                          className="text-xs text-tf-muted hover:text-tf-accent"
                        >Edit</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteProvider(p.name) }}
                          className="text-xs text-tf-muted hover:text-red-500"
                        >Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Provider detail + Keys */}
      {selected && (
        <div className="bg-tf-card border border-tf-border rounded-lg p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-tf-text">{selected.name}</h3>
            <span className="text-xs px-2 py-0.5 bg-tf-border rounded capitalize">{selected.template || 'openai'}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-tf-muted mb-1">Base URL</div>
              <div className="text-tf-text">{selected.api_base_url}</div>
            </div>
            <div>
              <div className="text-xs text-tf-muted mb-1">API Key</div>
              <div className="text-tf-text">{selected.api_key ? '••••••••' : 'Not set'}</div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-tf-muted mb-1">Models</div>
              <div className="text-tf-text">{(selected.models || []).join(', ') || 'All models allowed'}</div>
            </div>
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
                      <div className="text-xs text-tf-muted font-mono mt-0.5">{k.id}</div>
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

            {/* Usage info */}
            {providerKeys.length > 0 && (
              <div className="mt-4 bg-tf-bg border border-tf-border rounded-lg p-3">
                <div className="text-xs font-medium text-tf-muted mb-2">Endpoint</div>
                <code className="text-xs text-tf-text font-mono block mb-1">{endpointBase}/v1/chat/completions</code>
                <code className="text-xs text-tf-text font-mono block mb-2">{endpointBase}/v1/messages</code>
                <div className="text-xs text-tf-muted mb-1">Example</div>
                <pre className="text-xs text-tf-text font-mono bg-tf-card p-2 rounded overflow-x-auto">
{`curl ${endpointBase}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${providerKeys[0]?.id}" \\
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"Hello"}]}'`}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Provider Form Modal */}
      {showProviderForm && (
        <ProviderFormModal
          initial={editingProvider}
          onSubmit={handleSaveProvider}
          onClose={() => { setShowProviderForm(false); setEditingProvider(null) }}
        />
      )}

      {/* Key Form Modal */}
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
  })

  const isEdit = !!initial

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-tf-card border border-tf-border rounded-xl shadow-lg w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-tf-text mb-4">{isEdit ? 'Edit Provider' : 'Add Provider'}</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit(form)
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

          <label className="block">
            <span className="text-xs font-medium text-tf-muted">Models (comma separated, leave empty for all)</span>
            <input
              value={form.models.join(', ')}
              onChange={e => setForm({ ...form, models: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              placeholder="gpt-4, gpt-3.5-turbo"
              className="mt-1 block w-full rounded-lg border border-tf-border bg-tf-bg px-3 py-1.5 text-sm text-tf-text placeholder:text-tf-muted/50 focus:border-tf-accent focus:outline-none"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-tf-muted hover:text-tf-text rounded-lg">Cancel</button>
            <button type="submit" className="px-3 py-1.5 text-sm bg-tf-accent text-white rounded-lg hover:opacity-90">
              {isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
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
