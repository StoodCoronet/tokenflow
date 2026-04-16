import { useState, useEffect } from 'react'
import { fetchSettings, updateSettings } from '../api'

function Settings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await fetchSettings()
      setSettings(data)
    } catch (error) {
      console.error('Failed to load settings:', error)
      setSettings({})
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const updated = await updateSettings(settings)
      setSettings(updated)
      setMessage({ type: 'success', text: 'Settings saved successfully' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleChange = (key, value) => {
    setSettings({ ...settings, [key]: value })
  }

  if (loading) {
    return <div className="loading">Loading settings...</div>
  }

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Configure Token Flow behavior</p>
      </div>

      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '24px',
          background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: message.type === 'success' ? '#065f46' : '#991b1b',
          fontSize: '14px',
        }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gap: '24px' }}>
        {/* Analysis Settings */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Analysis</h3>
          </div>
          <div className="card-body">
            <ToggleRow
              label="Enable Analysis"
              description="Analyze requests for context pattern detection"
              checked={settings?.analysis_enabled ?? true}
              onChange={(v) => handleChange('analysis_enabled', v)}
            />
            <div style={{ borderTop: '1px solid #e5e5e5', margin: '16px 0' }} />
            <h4 style={{ marginBottom: '12px', fontSize: '14px' }}>Detectors</h4>
            <ToggleRow
              label="Full Context"
              description="Detect when all conversation history is retained"
              checked={settings?.detector_full_context ?? true}
              onChange={(v) => handleChange('detector_full_context', v)}
            />
            <ToggleRow
              label="Sliding Window"
              description="Detect sliding window context management"
              checked={settings?.detector_sliding_window ?? true}
              onChange={(v) => handleChange('detector_sliding_window', v)}
            />
            <ToggleRow
              label="Summarization"
              description="Detect conversation summarization patterns"
              checked={settings?.detector_summarization ?? true}
              onChange={(v) => handleChange('detector_summarization', v)}
            />
          </div>
        </div>

        {/* Proxy Settings */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Proxy</h3>
          </div>
          <div className="card-body">
            <InputRow
              label="Proxy Timeout (seconds)"
              description="Maximum time to wait for upstream API response"
              type="number"
              value={settings?.proxy_timeout ?? 120}
              onChange={(v) => handleChange('proxy_timeout', parseInt(v) || 120)}
              min={10}
              max={600}
            />
          </div>
        </div>

        {/* Display Settings */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Display</h3>
          </div>
          <div className="card-body">
            <InputRow
              label="Dashboard Refresh Interval (seconds)"
              description="How often the dashboard auto-refreshes data"
              type="number"
              value={settings?.dashboard_refresh_interval ?? 30}
              onChange={(v) => handleChange('dashboard_refresh_interval', parseInt(v) || 30)}
              min={5}
              max={300}
            />
          </div>
        </div>

        {/* System Settings */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">System</h3>
          </div>
          <div className="card-body">
            <SelectRow
              label="Log Level"
              description="Controls the verbosity of application logs"
              value={settings?.log_level ?? 'INFO'}
              onChange={(v) => handleChange('log_level', v)}
              options={[
                { value: 'DEBUG', label: 'DEBUG' },
                { value: 'INFO', label: 'INFO' },
                { value: 'WARNING', label: 'WARNING' },
                { value: 'ERROR', label: 'ERROR' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ minWidth: '120px' }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
      <div>
        <div style={{ fontSize: '14px', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: '13px', color: '#6e6e80' }}>{description}</div>
      </div>
      <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0 }}
        />
        <span style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: checked ? '#10a37f' : '#d1d5db',
          borderRadius: '12px',
          transition: 'background 0.2s',
        }} />
        <span style={{
          position: 'absolute', top: '2px',
          left: checked ? '22px' : '2px',
          width: '20px', height: '20px',
          background: 'white',
          borderRadius: '50%',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }} />
      </label>
    </div>
  )
}

function InputRow({ label, description, type, value, onChange, min, max }) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
        {label}
      </label>
      {description && <div style={{ fontSize: '13px', color: '#6e6e80', marginBottom: '8px' }}>{description}</div>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        style={{
          width: '200px',
          padding: '8px 12px',
          border: '1px solid #e5e5e5',
          borderRadius: '6px',
          fontSize: '14px',
        }}
      />
    </div>
  )
}

function SelectRow({ label, description, value, onChange, options }) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
        {label}
      </label>
      {description && <div style={{ fontSize: '13px', color: '#6e6e80', marginBottom: '8px' }}>{description}</div>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '8px 12px',
          border: '1px solid #e5e5e5',
          borderRadius: '6px',
          fontSize: '14px',
          background: 'white',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

export default Settings
