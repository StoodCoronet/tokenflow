import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { FieldRow, ToggleRow, SuccessMsg } from './components.js'
import type { AppConfig, Provider } from '@tokenflow/shared'

// ── Providers Page ──────────────────────────────────────────

export function ProvidersPage({ config, onSave, onBack }: {
  config: AppConfig
  onSave: (c: AppConfig) => void
  onBack: () => void
}) {
  const [idx, setIdx] = useState(0)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [draft, setDraft] = useState<Provider | null>(null)

  const providers = config.Providers
  const current = editing ? draft! : providers[idx]

  useInput((input, key) => {
    if (editing) {
      if (key.leftArrow) { setEditing(false); setDraft(null) }
      return
    }
    if (key.leftArrow) { onBack(); return }
    if (key.upArrow && idx > 0) { setIdx(idx - 1); setSaved(false) }
    if (key.downArrow && idx < providers.length - 1) { setIdx(idx + 1); setSaved(false) }
    if (key.rightArrow || key.return) {
      if (!providers.length) return
      setDraft({ ...providers[idx] })
      setEditing(true)
      setSaved(false)
    }
  })

  const save = (updated: Provider) => {
    const newProviders = [...providers]
    newProviders[idx] = updated
    onSave({ ...config, Providers: newProviders })
    setEditing(false)
    setDraft(null)
    setSaved(true)
  }

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">Providers</Text>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>{idx + 1}/{providers.length} — {providers[idx]?.name || 'none'}</Text>
        <Box marginTop={1} flexDirection="column">
          {current ? (
            <>
              <FieldRow label="Name" value={current.name} editing={editing} />
              <FieldRow label="Base URL" value={current.api_base_url} editing={editing} />
              <FieldRow label="API Key" value={current.api_key.slice(0, 8) + '***'} />
              <FieldRow label="Models" value={current.models.join(', ')} />
            </>
          ) : (
            <Text dimColor>No providers configured</Text>
          )}
        </Box>
      </Box>
      {editing && <ProviderEditForm provider={draft!} onSave={save} />}
      {!editing && saved && <SuccessMsg text="Saved" />}
      <Box marginTop={1}>
        <Text dimColor>↑↓ switch │ → edit │ ← back</Text>
      </Box>
    </Box>
  )
}

function ProviderEditForm({ provider, onSave }: {
  provider: Provider
  onSave: (p: Provider) => void
}) {
  const [field, setField] = useState(0)
  const [values, setValues] = useState({
    name: provider.name,
    api_base_url: provider.api_base_url,
    api_key: provider.api_key,
    models: provider.models.join(', '),
  })
  const fields = ['name', 'api_base_url', 'api_key', 'models'] as const

  useInput((input, key) => {
    if (key.leftArrow) { onSave(provider); return }
    if (key.return) {
      if (field < fields.length - 1) { setField(field + 1) }
      else {
        onSave({
          ...provider,
          name: values.name,
          api_base_url: values.api_base_url,
          api_key: values.api_key,
          models: values.models.split(',').map(m => m.trim()).filter(Boolean),
        })
      }
      return
    }
    if (key.backspace) {
      const k = fields[field]
      setValues({ ...values, [k]: values[k].slice(0, -1) })
      return
    }
    if (input && input.length === 1 && input >= ' ') {
      const k = fields[field]
      setValues({ ...values, [k]: values[k] + input })
    }
  })

  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="yellow" paddingX={1}>
      <Text color="yellow" bold>Edit Provider</Text>
      {fields.map((f, i) => (
        <FieldRow key={f} label={f} value={values[f]} editing={i === field} />
      ))}
      <Text dimColor>Enter next │ Enter on last = save │ ← cancel</Text>
    </Box>
  )
}

// ── Ports Page ──────────────────────────────────────────────

export function PortsPage({ config, onSave, onBack }: {
  config: AppConfig
  onSave: (c: AppConfig) => void
  onBack: () => void
}) {
  const [field, setField] = useState(0)
  const [values, setValues] = useState({
    PORT: String(config.PORT),
    UI_PORT: String(config.UI_PORT),
  })
  const [saved, setSaved] = useState(false)
  const fields = ['PORT', 'UI_PORT'] as const

  useInput((input, key) => {
    if (key.leftArrow) { onBack(); return }
    if (key.return) {
      if (field < fields.length - 1) { setField(field + 1) }
      else {
        onSave({
          ...config,
          PORT: parseInt(values.PORT, 10) || config.PORT,
          UI_PORT: parseInt(values.UI_PORT, 10) || config.UI_PORT,
        })
        setSaved(true)
      }
      return
    }
    if (key.backspace) {
      const k = fields[field]
      setValues({ ...values, [k]: values[k].slice(0, -1) })
      return
    }
    if (input && input.length === 1) {
      const k = fields[field]
      setValues({ ...values, [k]: values[k] + input })
    }
  })

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">Ports</Text>
      <Box marginTop={1} flexDirection="column">
        {fields.map((f, i) => (
          <FieldRow key={f} label={f} value={values[f]} editing={i === field} />
        ))}
      </Box>
      {saved && <SuccessMsg text="Saved" />}
      <Box marginTop={1}>
        <Text dimColor>Enter next/save │ ← back</Text>
      </Box>
    </Box>
  )
}

// ── Router Page ─────────────────────────────────────────────

export function RouterPage({ config, onSave, onBack }: {
  config: AppConfig
  onSave: (c: AppConfig) => void
  onBack: () => void
}) {
  const [field, setField] = useState(0)
  const [values, setValues] = useState({
    enabled: config.Router.enabled,
    default: config.Router.default,
  })
  const [saved, setSaved] = useState(false)

  useInput((input, key) => {
    if (key.leftArrow) { onBack(); return }
    if (key.return) {
      if (field === 0) {
        setValues({ ...values, enabled: !values.enabled })
      } else if (field === 1) {
        onSave({ ...config, Router: { ...config.Router, ...values } })
        setSaved(true)
      }
      return
    }
    if (key.upArrow || key.downArrow) { setField(field === 0 ? 1 : 0) }
    if (key.backspace && field === 1) {
      setValues({ ...values, default: values.default.slice(0, -1) })
      return
    }
    if (field === 1 && input && input.length === 1 && input >= ' ') {
      setValues({ ...values, default: values.default + input })
    }
  })

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">Smart Router</Text>
      <Box marginTop={1} flexDirection="column">
        <ToggleRow label="Enabled" value={values.enabled} selected={field === 0} />
        <FieldRow label="Default" value={values.default} editing={field === 1} />
      </Box>
      {saved && <SuccessMsg text="Saved" />}
      <Box marginTop={1}>
        <Text dimColor>↑↓ switch │ Enter toggle/save │ ← back</Text>
      </Box>
    </Box>
  )
}

// ── Detectors Page ──────────────────────────────────────────

export function DetectorsPage({ config, onSave, onBack }: {
  config: AppConfig
  onSave: (c: AppConfig) => void
  onBack: () => void
}) {
  const entries = Object.entries(config.Detectors)
  const [idx, setIdx] = useState(0)
  const [saved, setSaved] = useState(false)

  useInput((input, key) => {
    if (key.leftArrow) { onBack(); return }
    if (key.upArrow && idx > 0) { setIdx(idx - 1); setSaved(false) }
    if (key.downArrow && idx < entries.length - 1) { setIdx(idx + 1); setSaved(false) }
    if (key.return) {
      const [name] = entries[idx]
      const newDetectors = { ...config.Detectors }
      newDetectors[name] = { enabled: !newDetectors[name].enabled }
      onSave({ ...config, Detectors: newDetectors })
      setSaved(true)
    }
  })

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">Detectors</Text>
      <Box marginTop={1} flexDirection="column">
        {entries.map(([name, cfg], i) => (
          <ToggleRow key={name} label={name} value={cfg.enabled} selected={i === idx} />
        ))}
      </Box>
      {saved && <SuccessMsg text="Saved" />}
      <Box marginTop={1}>
        <Text dimColor>↑↓ switch │ Enter toggle │ ← back</Text>
      </Box>
    </Box>
  )
}

// ── General Page ────────────────────────────────────────────

export function GeneralPage({ config, onSave, onBack }: {
  config: AppConfig
  onSave: (c: AppConfig) => void
  onBack: () => void
}) {
  const [field, setField] = useState(0)
  const [values, setValues] = useState({
    LOG_LEVEL: config.LOG_LEVEL,
    DATABASE: config.DATABASE,
  })
  const [saved, setSaved] = useState(false)
  const fields = ['LOG_LEVEL', 'DATABASE'] as const

  useInput((input, key) => {
    if (key.leftArrow) { onBack(); return }
    if (key.return) {
      if (field < fields.length - 1) { setField(field + 1) }
      else {
        onSave({ ...config, ...values })
        setSaved(true)
      }
      return
    }
    if (key.backspace) {
      const k = fields[field]
      setValues({ ...values, [k]: values[k].slice(0, -1) })
      return
    }
    if (input && input.length === 1 && input >= ' ') {
      const k = fields[field]
      setValues({ ...values, [k]: values[k] + input })
    }
  })

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">General</Text>
      <Box marginTop={1} flexDirection="column">
        {fields.map((f, i) => (
          <FieldRow key={f} label={f} value={values[f]} editing={i === field} />
        ))}
      </Box>
      {saved && <SuccessMsg text="Saved" />}
      <Box marginTop={1}>
        <Text dimColor>Enter next/save │ ← back</Text>
      </Box>
    </Box>
  )
}
