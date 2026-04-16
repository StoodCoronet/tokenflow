/**
 * Base transformer interface for API format adaptation.
 * Each provider implements this to convert between its native format and the internal format.
 */
export interface Transformer {
  providerName: string

  /** Detect if an incoming request matches this provider's format */
  detect(body: unknown): boolean

  /** Transform an incoming request to the internal format */
  transformRequest(body: unknown): InternalRequest

  /** Transform the internal request to the provider's format */
  formatRequest(request: InternalRequest, providerConfig: ProviderConfig): ProviderRequest

  /** Parse provider response into internal format */
  parseResponse(response: unknown): InternalResponse
}

export interface ProviderConfig {
  api_base_url: string
  api_key: string
  models: string[]
}

export interface InternalRequest {
  model: string
  messages: Array<{ role: string; content: string }>
  stream?: boolean
  temperature?: number
  max_tokens?: number
  tools?: unknown[]
  session_id?: string
  [key: string]: unknown
}

export interface ProviderRequest {
  url: string
  headers: Record<string, string>
  body: unknown
}

export interface InternalResponse {
  id: string
  model: string
  content: string
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  finish_reason: string
  raw: unknown
}
