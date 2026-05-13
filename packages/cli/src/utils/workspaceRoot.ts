import { resolve, dirname } from 'path'
import { existsSync } from 'fs'

export function findWorkspaceRoot(from: string = import.meta.dirname): string {
  let dir = from
  while (dir !== dirname(dir)) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir
    dir = dirname(dir)
  }
  throw new Error('Could not find workspace root (no pnpm-workspace.yaml found)')
}
