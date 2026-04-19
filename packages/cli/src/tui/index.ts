import React from 'react'
import { render } from 'ink'
import { TuiApp } from './app.js'

export function startTui() {
  // Clear screen and move cursor to top-left
  process.stdout.write('\x1b[2J\x1b[H')
  // Hide cursor
  process.stdout.write('\x1b[?25l')

  const instance = render(React.createElement(TuiApp))

  // Restore cursor on exit
  instance.waitUntilExit().then(() => {
    process.stdout.write('\x1b[?25h')
  })
}
