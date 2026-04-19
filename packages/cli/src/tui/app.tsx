import React, { useState, useCallback } from 'react'
import { Box, Text, useInput, useApp, useStdout } from 'ink'
import { OverviewPage, ProvidersPage, PortsPage, RouterPage, DetectorsPage, GeneralPage, ConfigPage } from './pages.js'
import { loadConfig, saveConfig } from '../utils/configLoader.js'
import type { AppConfig } from '@tokenflow/shared'

type Page = 'overview' | 'providers' | 'ports' | 'router' | 'detectors' | 'general' | 'config'

const pages: { key: Page; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'providers', label: 'Providers' },
  { key: 'ports', label: 'Ports' },
  { key: 'router', label: 'Router' },
  { key: 'detectors', label: 'Detectors' },
  { key: 'general', label: 'General' },
  { key: 'config', label: 'Config' },
]

export function TuiApp() {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const termHeight = stdout?.rows || 24
  const termWidth = stdout?.columns || 80

  const [selected, setSelected] = useState(0)
  const [page, setPage] = useState<Page>('overview')
  const [config, setConfig] = useState<AppConfig>(loadConfig())
  const [inPage, setInPage] = useState(false)

  const handleSave = useCallback((updated: AppConfig) => {
    saveConfig(updated)
    setConfig(updated)
  }, [])

  const handleBack = useCallback(() => {
    setInPage(false)
  }, [])

  useInput((input, key) => {
    if (input === 'q' && !inPage) { exit(); return }

    // Left arrow: go back to sidebar from any page
    if (key.leftArrow && inPage) { setInPage(false); return }

    // Sidebar mode
    if (!inPage) {
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
      if (key.rightArrow || key.return) { setInPage(true) }
    }
  })

  const hints = inPage
    ? '← back │ Enter save/toggle'
    : '↑↓ navigate │ → enter │ q quit'

  const headerHeight = 1
  const statusHeight = 1
  const bodyHeight = termHeight - headerHeight - statusHeight - 2

  return (
    <Box flexDirection="column" height={termHeight}>
      {/* Header */}
      <Box width={termWidth}>
        <Text bold color="cyan"> Token Flow Config</Text>
        <Text dimColor>{'─'.repeat(termWidth - 18)}</Text>
      </Box>

      {/* Body */}
      <Box flexDirection="row" height={bodyHeight} width={termWidth}>
        {/* Sidebar */}
        <Box flexDirection="column" width={20} borderStyle="single" borderColor="gray" paddingX={1}>
          {pages.map((p, i) => (
            <Box key={p.key}>
              <Text color={i === selected ? 'cyan' : 'white'} bold={i === selected}>
                {i === selected ? '› ' : '  '}{p.label}
              </Text>
            </Box>
          ))}
          {/* Push help to bottom */}
          <Box flexGrow={1} />
          <Text dimColor wrap="wrap"> q quit</Text>
        </Box>

        {/* Content */}
        <Box flexGrow={1} flexDirection="column" paddingX={1}>
          {page === 'overview' && <OverviewPage config={config} active={inPage} onBack={handleBack} />}
          {page === 'providers' && <ProvidersPage config={config} active={inPage} onSave={handleSave} onBack={handleBack} />}
          {page === 'ports' && <PortsPage config={config} active={inPage} onSave={handleSave} onBack={handleBack} />}
          {page === 'router' && <RouterPage config={config} active={inPage} onSave={handleSave} onBack={handleBack} />}
          {page === 'detectors' && <DetectorsPage config={config} active={inPage} onSave={handleSave} onBack={handleBack} />}
          {page === 'general' && <GeneralPage config={config} active={inPage} onSave={handleSave} onBack={handleBack} />}
          {page === 'config' && <ConfigPage active={inPage} onBack={handleBack} />}
        </Box>
      </Box>

      {/* Status bar */}
      <Box width={termWidth} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>{hints}</Text>
      </Box>
    </Box>
  )
}
