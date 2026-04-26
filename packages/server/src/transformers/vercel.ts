import { OpenrouterProviderTransformer } from './openrouter.js'

/**
 * Vercel provider transformer.
 * Reuses OpenRouter logic since they are nearly identical.
 */
export class VercelProviderTransformer extends OpenrouterProviderTransformer {
  name = 'vercel'
}
