import { useState, useEffect } from 'react'

type KeyData = {
  name: string
  provider: string
  upstream_key: string
  base_url: string
  scenario: string
}

const defaults: KeyData = { name: '', provider: 'openai', upstream_key: '', base_url: '', scenario: '' }

export function KeyModal({
  open,
  initial,
  onSubmit,
  onClose,
}: {
  open: boolean
  initial?: Partial<KeyData & { id: string }> | null
  onSubmit: (data: KeyData) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<KeyData>(defaults)
  const isEdit = !!initial?.id

  useEffect(() => {
    if (open) {
      setForm({
        name: initial?.name ?? '',
        provider: initial?.provider ?? 'openai',
        upstream_key: initial?.upstream_key ?? '',
        base_url: initial?.base_url ?? '',
        scenario: initial?.scenario ?? '',
      })
    }
  }, [open, initial])

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
          <Field label="Provider" value={form.provider} onChange={(v) => setForm({ ...form, provider: v })} required />
          <Field
            label="API Key"
            value={form.upstream_key}
            onChange={(v) => setForm({ ...form, upstream_key: v })}
            required
            placeholder={isEdit ? 'Leave empty to keep current' : undefined}
            type="password"
          />
          <Field label="Base URL" value={form.base_url} onChange={(v) => setForm({ ...form, base_url: v })} required />
          <Field label="Scenario" value={form.scenario} onChange={(v) => setForm({ ...form, scenario: v })} />
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
