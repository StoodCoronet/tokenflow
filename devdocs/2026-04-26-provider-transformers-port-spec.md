# Provider Transformer 移植技术方案

## 背景

Token Flow 目前仅有 `openai` 和 `anthropic` 两种 provider template。参考 CCR（claude-code-router）的 transformer 体系，需要将更多主流 provider 纳入支持，同时保持架构简洁。

## 目标

1. 移植 CCR 中 11 个 provider-specific transformer 到 Token Flow
2. 每个 provider 在 UI 中有独立的 template 选项（即使底层是 OpenAI 兼容格式）
3. Provider 配置支持 `options` 通用字段和 `extra_headers` 透传
4. 新增 `/v1/responses` endpoint 支持 OpenAI Responses API
5. 所有 transformer 都有对应的单元测试

---

## 1. 待移植 Provider 清单

| # | Template | 格式差异 | 优先级 | 说明 |
|---|---|---|---|---|
| 1 | `openai` | 无（基准） | P0 | 已有，直接转发 OpenAI 格式 |
| 2 | `anthropic` | 有 | P0 | 已有，Anthropic Messages API ↔ IR |
| 3 | `openai-responses` | 有 | P1 | OpenAI /v1/responses API，需新增 endpoint |
| 4 | `gemini` | 有 | P1 | Google Gemini 原生 API，URL 和 body 格式不同 |
| 5 | `deepseek` | 有 | P1 | OpenAI 兼容 + reasoning_content 特殊处理 |
| 6 | `openrouter` | 有 | P1 | OpenAI 兼容 + cache_control 条件剥离 + image 归一化 |
| 7 | `groq` | 轻微 | P2 | OpenAI 兼容 + $schema 剥离 + tool_call ID 修复 |
| 8 | `cerebras` | 轻微 | P2 | OpenAI 兼容 + reasoning 字段处理 |
| 9 | `vercel` | 轻微 | P2 | OpenAI 兼容 + cache_control 条件剥离 + image 归一化 |
| 10 | `vertex-gemini` | 有 | P2 | GCP 认证 + Gemini 原生 API |
| 11 | `vertex-claude` | 有 | P2 | GCP 认证 + Anthropic Claude via Vertex |

**说明：** P0 为已有，P1 为有实质格式差异的 provider，P2 为 OpenAI 兼容但有额外字段处理的 provider。

---

## 2. Provider 配置扩展

### 2.1 `options` 字段

```ts
export interface Provider {
  name: string
  template: string
  api_base_url: string
  api_key: string
  models: string[]
  options?: Record<string, any>  // NEW
}
```

**用途：**
- OpenRouter：`{ "extra_headers": { "HTTP-Referer": "...", "X-Title": "..." } }`
- DeepSeek：`{ "max_tokens_clamp": 8192 }`
- Vertex：`{ "project_id": "...", "location": "us-central1", "credentials_path": "..." }`
- Gemini：`{ "api_version": "v1beta" }`

### 2.2 `extra_headers` 透传

`proxy/handler.ts` 在构造 upstream request 时，读取 `provider.options?.extra_headers` 并 merge 到 upstream headers 中。

```ts
const upstreamHeaders = {
  ...upstream.headers,
  ...(provider.options?.extra_headers || {}),
}
```

---

## 3. 各 Provider Transformer 差异详述

### 3.1 `openai`（已有）
- URL: `{base}/v1/chat/completions`
- Auth: `Authorization: Bearer {api_key}`
- Body: 直接转发 IR（OpenAI 格式）

### 3.2 `anthropic`（已有）
- URL: `{base}/v1/messages`
- Auth: `x-api-key` + `anthropic-version: 2023-06-01`
- Body: IR → Anthropic Messages API 格式（system 提取、messages 转换、max_tokens 默认 4096）
- Response: Anthropic → IR（OpenAI Chat Completion 格式）

### 3.3 `openai-responses`（新增）
- **新增 endpoint:** `/v1/responses`
- **MainTransformer:** `OpenAIResponsesMainTransformer`（endPoint = `/v1/responses`）
- **ProviderTransformer:** 复用 `OpenAIProviderTransformer`（因为 Responses API 也是 OpenAI 原生格式）
- **关键差异：**
  - Request: `messages` → `input` 数组转换，system → `instructions`，`temperature`/`max_tokens` 删除，`reasoning` → `{ effort, summary: "detailed" }`
  - Response: Responses API SSE → `chat.completion.chunk` 格式转换（event type 映射）

### 3.4 `gemini`（新增）
- URL: `{base}/v1beta/models/{model}:generateContent`（非流）/ `:streamGenerateContent?alt=sse`（流）
- Auth: `x-goog-api-key: {api_key}`（删除 `Authorization`）
- Body: IR → Gemini `contents` 格式（需实现 `buildRequestBody` 工具函数）
- Response: Gemini → IR
- **依赖：** 需要 `packages/server/src/transformers/gemini.util.ts` 工具函数

### 3.5 `deepseek`（新增）
- URL: `{base}/v1/chat/completions`（OpenAI 兼容）
- Auth: `Authorization: Bearer {api_key}`
- **关键差异：**
  - `max_tokens > 8192` 时 clamp 到 8192
  - **Streaming reasoning:** DeepSeek 的 `delta.reasoning_content` 需要转换为 OpenAI 的 `delta.thinking: { content, signature }`
  - reasoning 阶段结束后，choice index 递增以区分 reasoning 和 answer

### 3.6 `openrouter`（新增）
- URL: `{base}/api/v1/chat/completions`（OpenAI 兼容）
- Auth: `Authorization: Bearer {api_key}`
- **关键差异：**
  - **Cache control 条件剥离：** 非 Claude 模型时删除所有 `cache_control`
  - **Image URL 归一化：** 非 Claude 模型保留 raw base64（无 `data:` 前缀）；Claude 模型添加 `data:${media_type};base64,` 前缀
  - **Options merge：** `Object.assign(request, provider.options)` 注入任意额外参数
  - **Stream response rewriting：**
    - `reasoning` → `thinking` 转换
    - `finish_reason` 强制为 `tool_calls` 或 `stop`
    - 数字 tool_call ID → `call_${uuidv4()}`
    - tool call 出现在 text 之后时，choice index 递增

### 3.7 `groq`（新增）
- URL: `{base}/v1/chat/completions`（OpenAI 兼容）
- Auth: `Authorization: Bearer {api_key}`
- **关键差异：**
  - 删除 `cache_control`
  - 删除 `tool.function.parameters.$schema`
  - Stream 中数字 tool_call ID → `call_${uuidv4()}`
  - tool call 出现在 text 之后时，choice index 递增

### 3.8 `cerebras`（新增）
- URL: `{base}/v1/chat/completions`（OpenAI 兼容）
- Auth: `Authorization: Bearer {api_key}`
- **关键差异：**
  - 删除 `request.reasoning`，否则设置 `disable_reasoning: false`
  - 无 stream rewriting

### 3.9 `vercel`（新增）
- URL: `{base}/v1/chat/completions`（OpenAI 兼容）
- Auth: `Authorization: Bearer {api_key}`
- **关键差异：** 与 OpenRouter 几乎一致（cache_control 条件剥离、image 归一化、options merge、stream rewriting）

### 3.10 `vertex-gemini`（新增）
- URL: `https://{location}-aiplatform.googleapis.com/v1beta1/projects/{project_id}/locations/{location}/publishers/google/models/{model}:streamGenerateContent`
- Auth: GCP OAuth2 `Authorization: Bearer {access_token}`（通过 `google-auth-library` 动态获取）
- Body: IR → Gemini 原生格式（复用 gemini.util.ts）
- **依赖：** `google-auth-library` npm 包
- **配置：** `provider.options.project_id`, `provider.options.location`

### 3.11 `vertex-claude`（新增）
- URL: `https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/anthropic/models/{model}:streamRawPredict`
- Auth: GCP OAuth2 `Authorization: Bearer {access_token}`
- Body: IR → Anthropic 格式（复用 anthropic transformer 逻辑）
- **依赖：** `google-auth-library` npm 包
- **配置：** `provider.options.project_id`, `provider.options.location`

---

## 4. Transformer 架构调整

### 4.1 现有架构（两层层叠）

```
客户端请求 → MainTransformer（by endpoint URL）→ IR → ProviderTransformer（by template）→ 上游
```

### 4.2 新增 `ProviderTransformer.options` 透传

`ProviderTransformer` 接口增加 `options?: Record<string, any>` 参数，用于接收 provider 配置中的额外参数。

### 4.3 Transformer 注册

```ts
// packages/server/src/transformers/index.ts
registerProvider(new OpenAIProviderTransformer())
registerProvider(new AnthropicProviderTransformer())
registerProvider(new OpenAIResponsesProviderTransformer())  // NEW
registerProvider(new GeminiProviderTransformer())            // NEW
registerProvider(new DeepSeekProviderTransformer())          // NEW
registerProvider(new OpenRouterProviderTransformer())        // NEW
registerProvider(new GroqProviderTransformer())              // NEW
registerProvider(new CerebrasProviderTransformer())          // NEW
registerProvider(new VercelProviderTransformer())            // NEW
registerProvider(new VertexGeminiProviderTransformer())      // NEW
registerProvider(new VertexClaudeProviderTransformer())      // NEW
```

### 4.4 MainTransformer 注册

```ts
// packages/server/src/transformers/index.ts
registerMain(new OpenAIMainTransformer())           // /v1/chat/completions
registerMain(new AnthropicMainTransformer())        // /v1/messages
registerMain(new OpenAIResponsesMainTransformer())  // /v1/responses (NEW)
```

---

## 5. 单元测试策略

### 5.1 测试目录结构

```
tests/unit/transformers/
├── openai.test.ts
├── anthropic.test.ts
├── openai-responses.test.ts
├── gemini.test.ts
├── deepseek.test.ts
├── openrouter.test.ts
├── groq.test.ts
├── cerebras.test.ts
├── vercel.test.ts
├── vertex-gemini.test.ts
└── vertex-claude.test.ts
```

### 5.2 每个 transformer 的测试内容

| 测试项 | 说明 |
|---|---|
| `transformRequestIn` | 输入 IR，验证输出 upstream body/headers/url 正确 |
| `transformResponseOut (sync)` | mock 上游 JSON response，验证输出 IR 正确 |
| `transformResponseOut (stream)` | mock 上游 SSE stream，验证输出 SSE 事件正确 |
| Edge cases | 空 messages、无 api_key、特殊字段缺失等 |

### 5.3 测试工具

```ts
// tests/utils/transformer-test-helper.ts
export function createMockProvider(overrides?: Partial<Provider>): Provider
export function createMockTransformContext(provider: Provider): TransformContext
export function mockResponse(json: object): Response
export function mockStreamResponse(chunks: string[]): Response
```

### 5.4 示例测试（DeepSeek reasoning_content）

```ts
it('converts reasoning_content to thinking in stream', async () => {
  const transformer = new DeepSeekProviderTransformer()
  const stream = mockStreamResponse([
    'data: {"choices":[{"delta":{"reasoning_content":"Let me think"}}]}',
    'data: {"choices":[{"delta":{"reasoning_content":" about this"}}]}',
    'data: {"choices":[{"delta":{"content":"Hello"}}]}',
    'data: [DONE]',
  ])

  const result = await transformer.transformResponseOut(stream, context)
  const body = await result.text()

  expect(body).toContain('thinking')
  expect(body).toContain('Let me think about this')
  expect(body).toContain('Hello')
})
```

---

## 6. UI 调整

### 6.1 ProviderFormModal

- **Template 下拉框** 扩展为 11 个选项
- **Models 字段** 保持现有 tag input + fetch 按钮
- **Options 字段** 新增 collapsible JSON 输入框（高级配置）
- **Extra Headers 字段** 新增 key-value 输入对

### 6.2 不同 template 的表单字段动态变化

| Template | 表单字段 |
|---|---|
| `openai` / `anthropic` / `deepseek` / `groq` / `cerebras` / `openrouter` / `vercel` | name, template, base_url, api_key, models, options(折叠) |
| `gemini` | 同上 + options.api_version |
| `vertex-gemini` / `vertex-claude` | 同上 + options.project_id, options.location, options.credentials_path |

---

## 7. 实现优先级和批次

### 批次 1（P1，有实质格式差异）
1. `openai-responses` — 新增 endpoint + MainTransformer
2. `gemini` — 新格式 + 工具函数
3. `deepseek` — reasoning_content 处理
4. `openrouter` — cache_control + image 归一化 + options merge

### 批次 2（P2，OpenAI 兼容 + 额外处理）
5. `groq` — $schema 剥离 + tool_call ID 修复
6. `cerebras` — reasoning 字段处理
7. `vercel` — 复用 openrouter 逻辑

### 批次 3（P2，GCP 认证）
8. `vertex-gemini` — GCP OAuth + Gemini 格式
9. `vertex-claude` — GCP OAuth + Anthropic 格式

---

## 8. 关键文件清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `packages/shared/src/types.ts` | 修改 | Provider 加 `options?: Record<string, any>` |
| `packages/server/src/transformers/index.ts` | 修改 | 注册 9 个新 ProviderTransformer + 1 个新 MainTransformer |
| `packages/server/src/transformers/base.ts` | 修改 | ProviderTransformer 接口支持 options 透传 |
| `packages/server/src/transformers/openai-responses.ts` | 新建 | OpenAI Responses API transformer |
| `packages/server/src/transformers/gemini.ts` | 新建 | Gemini 原生 API transformer |
| `packages/server/src/transformers/gemini.util.ts` | 新建 | Gemini body/response 转换工具函数 |
| `packages/server/src/transformers/deepseek.ts` | 新建 | DeepSeek transformer（reasoning_content） |
| `packages/server/src/transformers/openrouter.ts` | 新建 | OpenRouter transformer |
| `packages/server/src/transformers/groq.ts` | 新建 | Groq transformer |
| `packages/server/src/transformers/cerebras.ts` | 新建 | Cerebras transformer |
| `packages/server/src/transformers/vercel.ts` | 新建 | Vercel transformer |
| `packages/server/src/transformers/vertex-gemini.ts` | 新建 | Vertex Gemini transformer |
| `packages/server/src/transformers/vertex-claude.ts` | 新建 | Vertex Claude transformer |
| `packages/server/src/transformers/vertex.util.ts` | 新建 | GCP OAuth 工具函数 |
| `packages/server/src/proxy/handler.ts` | 修改 | 透传 provider.options?.extra_headers |
| `packages/server/src/routes/index.ts` | 修改 | 新增 `/v1/responses` endpoint 注册 |
| `packages/ui/src/components/ProvidersPage.tsx` | 修改 | Template 下拉扩展、Options 字段、Extra Headers 字段 |
| `tests/unit/transformers/*.test.ts` | 新建 | 11 个 transformer 单元测试 |
| `tests/utils/transformer-test-helper.ts` | 新建 | 测试辅助函数 |

---

## 9. 新增依赖

```json
{
  "@tokenflow/server": {
    "google-auth-library": "^9.x"  // 仅用于 vertex-gemini / vertex-claude
  }
}
```

---

## 10. 风险与注意事项

1. **Vertex AI 依赖 `google-auth-library`**：安装后包体积增加，且需要 GCP 凭据文件或 ADC 环境。需在文档中说明配置方式。
2. **Gemini 工具函数复杂**：`buildRequestBody` 和 response 转换涉及大量字段映射，建议参考 CCR 的 `gemini.util.ts` 和 `vertex-claude.util.ts`。
3. **OpenAI Responses API 处于 Beta**：格式可能变化，transformer 需要跟随更新。
4. **DeepSeek reasoning_content**：目前只在 streaming 中出现，非流响应不需要处理。
5. **选项字段安全性**：`provider.options` 中的任意字段会被 merge 到 upstream request，需确保不会注入危险内容（如覆盖 headers 中的 Authorization）。
