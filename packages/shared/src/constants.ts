export const APP_NAME = 'Token Flow'
export const APP_VERSION = '0.1.0'

export const DEFAULT_PORT = 40001
export const DEFAULT_UI_PORT = 40002

export const DEFAULT_CONFIG_DIR = '~/.tokenflow'
export const DEFAULT_CONFIG_PATH = '~/.tokenflow/config.json5'
export const DEFAULT_DB_PATH = '~/.tokenflow/tokenflow.db'
export const PID_FILE = '~/.tokenflow/server.pid'

export const CONTEXT_PATTERNS = {
  FULL_CONTEXT: 'full_context',
  SLIDING_WINDOW: 'sliding_window',
  SUMMARIZATION: 'summarization',
  RAG: 'rag',
  HIERARCHICAL: 'hierarchical',
} as const

export const GRADE_THRESHOLDS = {
  A: 90,
  B: 70,
  C: 50,
  D: 0,
} as const

export const PROVIDER_DETECTORS: Record<string, (body: unknown) => boolean> = {
  openai: (body: any) => !!body?.model && Array.isArray(body?.messages),
  anthropic: (body: any) => body?.anthropic_version !== undefined || Array.isArray(body?.messages) && typeof body?.model === 'string' && body?.model.startsWith('claude'),
}
