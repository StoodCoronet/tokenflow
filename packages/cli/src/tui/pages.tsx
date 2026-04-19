import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { FieldRow, ToggleRow, SuccessMsg } from './components.js'
import type { AppConfig, Provider } from '@tokenflow/shared'

// ── Providers Page ──────────────────────────────────────────

type View = 'list' | 'edit'

export function ProvidersPage({ config, onSave, onBack }: {
  config: AppConfig
  onSave: (c: AppConfig) => void
  onBack: () => void
}) {
  const providers = config.Providers
  const [view, setView] = useState<View>('list')
  const [idx, setIdx] = useState(0)
  const [saved, setSaved] = useState(false)

  // list has N providers + 1 "Add new" row at bottom
  const rows = providers.length + 1
  const effectiveIdx = Math.min(idx, rows - 1)

  useInput((input, key) => {
    if (view === 'edit') return
    if (key.leftArrow) { onBack(); return }
    if (key.upArrow && effectiveIdx > 0) { setIdx(effectiveIdx - 1); setSaved(false) }
    if (key.downArrow && effectiveIdx < rows - 1) { setIdx(effectiveIdx + 1); setSaved(false) }

    if (key.rightArrow || key.return) {
      setSaved(false)
      if (effectiveIdx === providers.length) {
        // "Add new" row → enter edit with empty provider
        setView('edit')
      } else {
        // Existing provider → enter edit
        setView('edit')
      }
    }
  })

  const handleSave = (provider: Provider, isNew: boolean) => {
    const newProviders = [...providers]
    if (isNew) {
      newProviders.push(provider)
      setIdx(newProviders.length) // move to newly added
    } else {
      newProviders[effectiveIdx] = provider
    }
    onSave({ ...config, Providers: newProviders })
    setView('list')
    setSaved(true)
  }

  const handleDelete = () => {
    if (effectiveIdx >= providers.length) return
    const name = providers[effectiveIdx].name
    const newProviders = providers.filter((_, i) => i !== effectiveIdx)
    onSave({ ...config, Providers: newProviders })
    setIdx(Math.max(0, effectiveIdx - 1))
    setSaved(true)
  }

  if (view === 'edit') {
    const isNew = effectiveIdx === providers.length
    const existing = isNew ? { name: '', api_base_url: '', api_key: '', models: [] } : providers[effectiveIdx]
    return (
      <ProviderEditForm
        isNew={isNew}
        provider={existing}
        onSave={(p) => handleSave(p, isNew)}
        onCancel={() => setView('list')}
      />
    )
  }

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">Providers</Text>
      <Box marginTop={1} flexDirection="column">
        {providers.map((p, i) => (
          <Box key={p.name}>
            <Text color={i === effectiveIdx ? 'cyan' : 'white'} bold={i === effectiveIdx}>
              {i === effectiveIdx ? '› ' : '  '}{p.name}
            </Text>
            <Text dimColor> — {p.models.join(', ') || 'no models'}</Text>
          </Box>
        ))}
        <Box>
          <Text color={effectiveIdx === providers.length ? 'green' : 'gray'} bold={effectiveIdx === providers.length}>
            {effectiveIdx === providers.length ? '› ' : '  '}+ Add new provider
          </Text>
        </Box>
      </Box>

      {effectiveIdx < providers.length && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>── {providers[effectiveIdx].name} ──</Text>
          <FieldRow label="Base URL" value={providers[effectiveIdx].api_base_url} />
          <FieldRow label="API Key" value={providers[effectiveIdx].api_key.slice(0, 8) + '***'} />
          <FieldRow label="Models" value={providers[effectiveIdx].models.join(', ')} />
        </Box>
      )}

      {saved && <SuccessMsg text="Saved" />}
      <Box marginTop={1}>
        <Text dimColor>↑↓ select │ → edit/add │ ← back</Text>
      </Box>
    </Box>
  )
}

function ProviderEditForm({ isNew, provider, onSave, onCancel }: {
  isNew: boolean
  provider: Provider
  onSave: (p: Provider) => void
  onCancel: () => void
}) {
  const [field, setField] = useState(0)
  const [values, setValues] = useState({
    name: provider.name,
    api_base_url: provider.api_base_url || 'https://api.openai.com',
    api_key: provider.api_key,
    models: provider.models.join(', '),
  })
  const fields = ['name', 'api_base_url', 'api_key', 'models'] as const
  const labels = ['Name', 'Base URL', 'API Key', 'Models (comma-sep)'] as const

  useInput((input, key) => {
    if (key.leftArrow) { onCancel(); return }
    if (key.return) {
      if (field < fields.length - 1) { setField(field + 1) }
      else {
        if (!values.name.trim()) return
        onSave({
          name: values.name.trim(),
          api_base_url: values.api_base_url.trim(),
          api_key: values.api_key.trim(),
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
    <Box flexDirection="column">
      <Text bold color="yellow">{isNew ? 'Add Provider' : 'Edit Provider'}</Text>
      <Box marginTop={1} flexDirection="column">
        {fields.map((f, i) => (
          <FieldRow key={f} label={labels[i]} value={values[f]} editing={i === field} />
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Enter next │ Enter on last = save │ ← cancel</Text>
      </Box>
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
