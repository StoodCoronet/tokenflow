// Shared type definitions for Token Flow

// --- Provider & API Key ---

export interface Provider {
  name: string
  api_base_url: string
  api_key: string
  models: string[]
}

export interface ApiKey {
  id: string
  name: string
  provider: string
  upstream_key: string
  base_url: string
  scenario?: string
  created_at: string
  updated_at: string
}

// --- Request & Response ---

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
  session_id?: string
  tools?: unknown[]
}

export interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface ChatResponse {
  id: string
  model: string
  choices: unknown[]
  usage: TokenUsage
}

// --- Request Log ---

export interface RequestLog {
  id: string
  api_key_id: string
  session_id: string | null
  request: {
    timestamp: string
    model: string
    messages: ChatMessage[]
    tools?: unknown[]
    parameters: Record<string, unknown>
  }
  response: {
    timestamp: string
    status: 'success' | 'error'
    usage: TokenUsage
    content?: string
  }
  analysis: AnalysisResult
}

// --- Session ---

export interface Session {
  session_id: string
  api_key_id: string
  start_time: string
  last_activity: string
  message_count: number
  total_prompt_tokens: number
  total_completion_tokens: number
  current_pattern: ContextPattern | null
}

// --- Context Pattern Detection ---

export type ContextPattern =
  | 'full_context'
  | 'sliding_window'
  | 'summarization'
  | 'rag'
  | 'hierarchical'

export interface AnalysisResult {
  detected_pattern: ContextPattern | null
  efficiency_score: number // 0-100
  warnings: string[]
  suggestions: string[]
}

// --- Efficiency Score ---

export interface EfficiencyBreakdown {
  token_utilization: number   // 30%
  context_health: number      // 25%
  cost_efficiency: number     // 25%
  pattern_reasonability: number // 20%
  overall: number             // weighted
  grade: 'A' | 'B' | 'C' | 'D'
}

// --- Configuration ---

export interface RouterConfig {
  enabled: boolean
  default: string  // "provider,model"
  longContext?: {
    provider: string
    model: string
    threshold: number
  }
}

export interface DetectorConfig {
  enabled: boolean
}

export interface AppConfig {
  PORT: number
  UI_PORT: number
  APIKEY: string
  DATABASE: string
  Providers: Provider[]
  Router: RouterConfig
  Detectors: Record<string, DetectorConfig>
  LOG_LEVEL: string
}

// --- Detector Interface ---

export interface Detector {
  detectorId: string
  detectorName: string
  analyze(session: Session, request: ChatRequest, response: ChatResponse): AnalysisResult
  getSuggestions(result: AnalysisResult): string[]
}
