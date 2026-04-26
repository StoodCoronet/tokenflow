import { GeminiProviderTransformer } from './gemini.js'
import { AnthropicProviderTransformer } from './anthropic.js'
import type { ProviderTransformer, UnifiedChatRequest, ProviderRequest, TransformContext } from './base.js'

async function getAccessToken(): Promise<string> {
  const { GoogleAuth } = await import('google-auth-library')
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  const client = await auth.getClient()
  const accessToken = await client.getAccessToken()
  return accessToken.token || ''
}

async function resolveProjectId(): Promise<string> {
  let projectId = process.env.GOOGLE_CLOUD_PROJECT
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'

  if (!projectId && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const fs = await import('fs')
      const keyContent = fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')
      const credentials = JSON.parse(keyContent)
      if (credentials?.project_id) {
        projectId = credentials.project_id
      }
    } catch {
      // ignore
    }
  }

  if (!projectId) {
    throw new Error(
      'Project ID is required for Vertex AI. Set GOOGLE_CLOUD_PROJECT environment variable or ensure project_id is in GOOGLE_APPLICATION_CREDENTIALS file.'
    )
  }

  return projectId
}

/**
 * Vertex Gemini provider transformer.
 * Reuses Gemini logic but with GCP OAuth and Vertex-specific URLs.
 */
export class VertexGeminiProviderTransformer implements ProviderTransformer {
  name = 'vertex-gemini'
  private gemini = new GeminiProviderTransformer()

  async transformRequestIn(request: UnifiedChatRequest, context: TransformContext): Promise<ProviderRequest> {
    const projectId = await resolveProjectId()
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
    const action = request.stream ? 'streamGenerateContent' : 'generateContent'
    const url = `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/publishers/google/models/${request.model}:${action}`

    const geminiReq = await this.gemini.transformRequestIn(request, context)

    const accessToken = await getAccessToken()

    return {
      url,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: geminiReq.body,
    }
  }

  async transformResponseOut(response: Response, context: TransformContext): Promise<Response> {
    return this.gemini.transformResponseOut(response, context)
  }
}

/**
 * Vertex Claude provider transformer.
 * Reuses Anthropic logic but with GCP OAuth and Vertex-specific URLs.
 */
export class VertexClaudeProviderTransformer implements ProviderTransformer {
  name = 'vertex-claude'
  private anthropic = new AnthropicProviderTransformer()

  async transformRequestIn(request: UnifiedChatRequest, context: TransformContext): Promise<ProviderRequest> {
    const projectId = await resolveProjectId()
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-east5'
    const action = request.stream ? 'streamRawPredict' : 'rawPredict'
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/anthropic/models/${request.model}:${action}`

    const anthropicReq = await this.anthropic.transformRequestIn(request, context)

    const accessToken = await getAccessToken()

    return {
      url,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: anthropicReq.body,
    }
  }

  async transformResponseOut(response: Response, context: TransformContext): Promise<Response> {
    return this.anthropic.transformResponseOut(response, context)
  }
}
