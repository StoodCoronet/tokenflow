import { startTui } from '../tui/index.js'

export async function configure(): Promise<void> {
  await startTui()
  process.exit(0)
}
