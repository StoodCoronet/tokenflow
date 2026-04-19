import { spawnSync } from 'child_process'
import React from 'react'
import { render } from 'ink'
import { TuiApp } from './app.js'
import { pendingEditor, clearPendingEditor } from './state.js'
import { getConfigPath } from '../utils/configLoader.js'

function restoreTerminal() {
  process.stdout.write('\x1b[?25h')        // show cursor
  process.stdout.write('\x1b[2J\x1b[H')    // clear + home
  if (process.stdin.isTTY) {
    try { process.stdin.setRawMode(false) } catch {}
  }
}

function openEditor(editor: string) {
  const file = getConfigPath()
  restoreTerminal()
  spawnSync(editor, [file], { stdio: 'inherit' })
}

async function runTuiOnce(): Promise<void> {
  process.stdout.write('\x1b[2J\x1b[H')    // clear + home
  process.stdout.write('\x1b[?25l')         // hide cursor

  const exitCodes: Record<string, number> = { SIGINT: 130, SIGTERM: 143, SIGQUIT: 131, SIGHUP: 129 }
  const handlers: Array<{ sig: NodeJS.Signals; fn: () => void }> = []

  for (const sig of Object.keys(exitCodes) as NodeJS.Signals[]) {
    const handler = () => {
      restoreTerminal()
      for (const h of handlers) { process.removeListener(h.sig, h.fn) }
      process.exit(exitCodes[sig])
    }
    handlers.push({ sig, fn: handler })
    process.prependOnceListener(sig, handler)
  }

  const instance = render(React.createElement(TuiApp))

  await instance.waitUntilExit().finally(() => {
    for (const h of handlers) { process.removeListener(h.sig, h.fn) }
    restoreTerminal()
  })
}

export async function startTui(): Promise<void> {
  while (true) {
    clearPendingEditor()
    await runTuiOnce()

    if (pendingEditor) {
      openEditor(pendingEditor)
      // loop continues → re-render TUI
    } else {
      break
    }
  }
}
