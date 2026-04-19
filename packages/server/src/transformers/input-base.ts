import type { InternalRequest } from './base.js'

/**
 * Input transformer: detects and normalizes incoming request formats
 * from domestic (Chinese) LLM platforms to the internal OpenAI-compatible format.
 */
export interface InputTransformer {
  providerName: string

  /** Detect if the request body matches this provider's native format */
  detect(body: unknown): boolean

  /** Normalize the native format to InternalRequest (OpenAI-compatible) */
  normalize(body: unknown): InternalRequest
}

/**
 * Declarative field mapping config for simple format conversions.
 * Complex logic should use a full InputTransformer implementation.
 */
export interface FieldMapping {
  /** Source field path in the native format, e.g. "input.messages" */
  from: string
  /** Target field in InternalRequest, e.g. "messages" */
  to: string
  /** Optional transform: 'direct' | 'rename' | 'flatten' */
  type?: 'direct' | 'rename' | 'flatten'
}

export interface DeclarativeInputConfig {
  providerName: string
  /** Field that identifies this format, e.g. { field: "model", pattern: "^qwen" } */
  detectRule: { field: string; pattern: string }
  fieldMaps: FieldMapping[]
  /** Map of native param name → InternalRequest param name */
  paramMaps?: Record<string, string>
}
