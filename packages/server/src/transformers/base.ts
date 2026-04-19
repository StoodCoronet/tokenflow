/**
 * Transformer interface for API format adaptation.
 * Based on CCR's 4-directional model: In/Out × Request/Response.
 * All methods optional — implement only what you need.
 */

/** Provider connection config */
export interface ProviderConfig {
  api_base_url: string
  api_key: string
  models: string[]
}

/** Unified internal request format (OpenAI-compatible) */
export interface InternalRequest {
  model: string
  messages: Array<{ role: string; content: string | unknown[]; tool_calls?: unknown[]; tool_call_id?: string }>
  stream?: boolean
  temperature?: number
  max_tokens?: number
  tools?: unknown[]
  tool_choice?: unknown
  [key: string]: unknown
}

/** Formatted request ready to send to provider */
export interface ProviderRequest {
  url: string
  headers: Record<string, string>
  body: unknown
}

/** Unified internal response */
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

/** Context passed through the transformer pipeline */
export interface TransformContext {
  provider: ProviderConfig
  isStream: boolean
  [key: string]: unknown
}

export interface Transformer {
  name: string

  /** Provider API endpoint path, e.g. "/v1/chat/completions" */
  endPoint?: string

  /** Incoming request: external format → unified internal format */
  transformRequestIn?(body: unknown, context: TransformContext): Promise<InternalRequest>

  /** Outgoing request: unified format → provider-specific format */
  transformRequestOut?(request: InternalRequest, context: TransformContext): Promise<ProviderRequest>

  /** Incoming response: provider format → unified format (handles stream) */
  transformResponseIn?(response: Response, context: TransformContext): Promise<Response>

  /** Outgoing response: unified format → external format */
  transformResponseOut?(response: Response, context: TransformContext): Promise<Response>

  /** Build auth headers for the provider */
  auth?(request: InternalRequest, provider: ProviderConfig): Promise<Record<string, string>>
}
