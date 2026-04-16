import chalk from 'chalk'
import { stopServer } from './stop.js'
import { startServer } from './start.js'

export function restartServer(portOverride?: number): void {
  stopServer()
  // Small delay to let port free up
  setTimeout(() => {
    startServer(portOverride)
  }, 500)
}
