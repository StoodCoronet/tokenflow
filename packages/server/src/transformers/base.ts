/**
 * Transformer type definitions for Token Flow.
 * Aligned with CCR's two-layer architecture: MainTransformer + ProviderTransformer.
 * Unified format (IR) = OpenAI-compatible.
 */

// ── IR Types (Unified Format) ──

export interface TextContent {
  type: 'text'
  text: string
  cache_control?: { type?: string }
}

export interface ImageContent {
  type: 'image_url'
  image_url: { url: string }
  media_type: string
}

export type UnifiedContent = TextContent | ImageContent

export interface UnifiedMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | null | UnifiedContent[]
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  cache_control?: { type?: string }
  thinking?: { content: string; signature?: string }
}

export interface UnifiedTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, any>
      required?: string[]
      additionalProperties?: boolean
      $schema?: string
    }
  }
}

/** IR request format (aligned with CCR UnifiedChatRequest) */
export interface UnifiedChatRequest {
  messages: UnifiedMessage[]
  model: string
  max_tokens?: number
  temperature?: number
  stream?: boolean
  tools?: UnifiedTool[]
  tool_choice?: 'auto' | 'none' | 'required' | string | { type: 'function'; function: { name: string } }
  reasoning?: { effort?: string; max_tokens?: number; enabled?: boolean }
  [key: string]: unknown
}

// ── Provider Types ──

export interface ProviderConfig {
  api_base_url: string
  api_key: string
  models: string[]
}

export interface ProviderRequest {
  url: string
  headers: Record<string, string>
  body: unknown
}

// ── Context ──

export interface TransformContext {
  provider: ProviderConfig
  isStream: boolean
  [key: string]: unknown
}

// ── Two-Layer Transformer Interfaces ──

/**
 * Main Transformer — selected by client endpoint.
 * Handles conversion between client format (Anthropic/OpenAI) and IR (UnifiedChatRequest).
 */
export interface MainTransformer {
  name: string
  endPoint: string

  /** Client format → IR */
  transformRequestOut(body: unknown, context: TransformContext): Promise<UnifiedChatRequest>

  /** IR response → client format */
  transformResponseIn(response: Response, context: TransformContext): Promise<Response>
}

/**
 * Provider Transformer — selected by provider config.
 * Handles conversion between IR (UnifiedChatRequest) and upstream provider format.
 */
export interface ProviderTransformer {
  name: string

  /** IR → provider format (build request) */
  transformRequestIn(request: UnifiedChatRequest, context: TransformContext): Promise<ProviderRequest>

  /** Provider response → IR */
  transformResponseOut(response: Response, context: TransformContext): Promise<Response>

  /** Auth headers for the provider */
  auth?(request: UnifiedChatRequest, provider: ProviderConfig): Promise<Record<string, string>>
}
