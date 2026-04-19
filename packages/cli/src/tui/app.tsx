import React, { useState, useCallback } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import { Sidebar, StatusBar } from './components.js'
import { ProvidersPage, PortsPage, RouterPage, DetectorsPage, GeneralPage } from './pages.js'
import { loadConfig, saveConfig } from '../utils/configLoader.js'
import type { AppConfig } from '@tokenflow/shared'

type Page = 'providers' | 'ports' | 'router' | 'detectors' | 'general'

const pages: { key: Page; label: string }[] = [
  { key: 'providers', label: 'Providers' },
  { key: 'ports', label: 'Ports' },
  { key: 'router', label: 'Router' },
  { key: 'detectors', label: 'Detectors' },
  { key: 'general', label: 'General' },
]

export function TuiApp() {
  const { exit } = useApp()
  const [selected, setSelected] = useState(0)
  const [page, setPage] = useState<Page>('providers')
  const [config, setConfig] = useState<AppConfig>(loadConfig())
  const [inPage, setInPage] = useState(true)

  const handleSave = useCallback((updated: AppConfig) => {
    saveConfig(updated)
    setConfig(updated)
  }, [])

  const handleBack = useCallback(() => {
    setInPage(true)
  }, [])

  useInput((input, key) => {
    if (!inPage) return

    if (input === 'q') { exit(); return }
    if (key.upArrow) {
      const next = selected > 0 ? selected - 1 : pages.length - 1
      setSelected(next)
      setPage(pages[next].key)
    }
    if (key.downArrow) {
      const next = selected < pages.length - 1 ? selected + 1 : 0
      setSelected(next)
      setPage(pages[next].key)
    }
    if (key.return) { setInPage(false) }
  })

  const hints = inPage
    ? '↑↓ navigate │ Enter select │ q quit'
    : 'ESC back │ Enter save/toggle'

  return (
    <Box flexDirection="column" height="100%">
      <Box>
        <Text bold color="cyan"> Token Flow Config</Text>
        <Text dimColor> ──────────────────────────────────────</Text>
      </Box>
      <Box flexGrow={1} flexDirection="row" marginTop={1}>
        <Box flexDirection="column" width={20} borderStyle="single" borderColor="gray" paddingX={1}>
          {pages.map((p, i) => (
            <Box key={p.key}>
              <Text color={i === selected ? 'cyan' : 'white'} bold={i === selected}>
                {i === selected ? '› ' : '  '}{p.label}
              </Text>
            </Box>
          ))}
        </Box>
        <Box flexGrow={1} paddingX={1}>
          {!inPage && page === 'providers' && <ProvidersPage config={config} onSave={handleSave} onBack={handleBack} />}
          {!inPage && page === 'ports' && <PortsPage config={config} onSave={handleSave} onBack={handleBack} />}
          {!inPage && page === 'router' && <RouterPage config={config} onSave={handleSave} onBack={handleBack} />}
          {!inPage && page === 'detectors' && <DetectorsPage config={config} onSave={handleSave} onBack={handleBack} />}
          {!inPage && page === 'general' && <GeneralPage config={config} onSave={handleSave} onBack={handleBack} />}
          {inPage && (
            <Box flexDirection="column">
              <Text dimColor>Select a section and press Enter to edit.</Text>
              <Box marginTop={1} flexDirection="column">
                <Text>Providers: <Text color="green">{config.Providers.length}</Text></Text>
                <Text>Server Port: <Text color="cyan">{config.PORT}</Text></Text>
                <Text>UI Port: <Text color="cyan">{config.UI_PORT}</Text></Text>
                <Text>Router: <Text color={config.Router.enabled ? 'green' : 'red'}>{config.Router.enabled ? 'ON' : 'OFF'}</Text></Text>
                <Text>Log Level: <Text color="cyan">{config.LOG_LEVEL}</Text></Text>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
      <StatusBar hints={hints} />
    </Box>
  )
}
