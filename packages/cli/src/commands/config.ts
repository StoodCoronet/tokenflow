import chalk from 'chalk'
import { startTui } from '../tui/index.js'

export async function configure(): Promise<void> {
  startTui()
}
