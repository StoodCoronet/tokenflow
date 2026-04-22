import { useState, useEffect } from 'react'

type KeyData = {
  name: string
  provider: string
  upstream_key: string
  base_url: string
  scenario: string
}

const defaults: KeyData = { name: '', provider: '', upstream_key: '', base_url: '', scenario: '' }

export function KeyModal({
  open,
  initial,
  providers,
  scenarios,
  onSubmit,
  onClose,
}: {
  open: boolean
  initial?: Partial<KeyData & { id: string }> | null
  providers?: string[]
  scenarios?: string[]
  onSubmit: (data: KeyData) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<KeyData>(defaults)
  const isEdit = !!initial?.id

  useEffect(() => {
    if (open) {
      setForm({
        name: initial?.name ?? '',
        provider: initial?.provider ?? (providers?.[0] || ''),
        upstream_key: initial?.upstream_key ?? '',
        base_url: initial?.base_url ?? '',
        scenario: initial?.scenario ?? '',
      })
    }
  }, [open, initial, providers])

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-tf-card border border-tf-border rounded-xl shadow-lg w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-tf-text mb-4">{isEdit ? 'Edit API Key' : 'Add API Key'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />

          <label className="block">
            <span className="text-xs font-medium text-tf-muted">Provider</span>
            {providers && providers.length > 0 ? (
              <select
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                required
                className="mt-1 block w-full rounded-lg border border-tf-border bg-tf-bg px-3 py-1.5 text-sm text-tf-text focus:border-tf-accent focus:outline-none"
              >
                <option value="" disabled>Select provider</option>
                {providers.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                required
                placeholder="e.g. openai"
                className="mt-1 block w-full rounded-lg border border-tf-border bg-tf-bg px-3 py-1.5 text-sm text-tf-text placeholder:text-tf-muted/50 focus:border-tf-accent focus:outline-none"
              />
            )}
            {providers && providers.length === 0 && (
              <p className="text-xs text-tf-muted mt-1">No providers configured. Go to Settings &rarr; Providers first.</p>
            )}
          </label>

          <Field
            label="API Key"
            value={form.upstream_key}
            onChange={(v) => setForm({ ...form, upstream_key: v })}
            required={!isEdit}
            placeholder={isEdit ? 'Leave empty to keep current' : undefined}
            type="password"
          />
          <Field label="Base URL" value={form.base_url} onChange={(v) => setForm({ ...form, base_url: v })} required={!isEdit} placeholder="https://api.example.com/v1" />

          <label className="block">
            <span className="text-xs font-medium text-tf-muted">Scenario</span>
            <input
              type="text"
              value={form.scenario}
              onChange={(e) => setForm({ ...form, scenario: e.target.value })}
              list="scenario-list"
              placeholder="e.g. production, dev"
              className="mt-1 block w-full rounded-lg border border-tf-border bg-tf-bg px-3 py-1.5 text-sm text-tf-text placeholder:text-tf-muted/50 focus:border-tf-accent focus:outline-none"
            />
            <datalist id="scenario-list">
              {scenarios?.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-tf-muted hover:text-tf-text rounded-lg">
              Cancel
            </button>
            <button type="submit" className="px-3 py-1.5 text-sm bg-tf-accent text-white rounded-lg hover:opacity-90">
              {isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, required, placeholder, type }: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-tf-muted">{label}</span>
      <input
        type={type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-lg border border-tf-border bg-tf-bg px-3 py-1.5 text-sm text-tf-text placeholder:text-tf-muted/50 focus:border-tf-accent focus:outline-none"
      />
    </label>
  )
}
