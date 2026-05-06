# Provider Transformer 移植 — 单元测试预案

**日期**: 2026-04-26
**基于**: devdocs/2026-04-26-provider-transformers-port-spec.md
**参考**: devdocs/2026-04-20-phase9-test-plan.md

---

## 背景

本次移植 9 个新增 provider transformer（openai-responses, gemini, deepseek, openrouter, groq, cerebras, vercel, vertex-gemini, vertex-claude）。每个 transformer 都有独特的 request/response 转换逻辑，需要建立单元测试覆盖。

**测试原则**：和 Phase 9 一致 —— 每个 transformer 独立测试，不依赖真实网络，全部 mock。

---

## 决策汇总

| 决策项 | 结论 |
|---|---|
| 测试框架 | **vitest**（复用现有配置） |
| 测试位置 | `tests/unit/transformers/` 根目录 |
| mock 方式 | `Response` 对象 + `ReadableStream` 手动构造 |
| 辅助工具 | `tests/utils/transformer-test-helper.ts`（复用/扩展 Phase 9 helper） |
| 覆盖维度 | 每个 transformer：sync request + sync response + stream response + edge cases |
| 真实 API | 不调用，全部 mock |
| 覆盖率 | 不设百分比，只看通过/失败 |

---

## 测试目录结构

```
tests/
  utils/
    transformer-test-helper.ts    # 扩展 Phase 9 helper
  unit/transformers/
    openai-responses.test.ts      # OpenAI Responses API
    gemini.test.ts                # Gemini 原生 API
    deepseek.test.ts              # DeepSeek (reasoning_content)
    openrouter.test.ts            # OpenRouter (cache_control + image)
    groq.test.ts                  # Groq ($schema + tool_call ID)
    cerebras.test.ts              # Cerebras (reasoning 字段)
    vercel.test.ts                # Vercel (复用 openrouter 逻辑)
    vertex-gemini.test.ts         # Vertex Gemini (GCP OAuth)
    vertex-claude.test.ts         # Vertex Claude (GCP OAuth)
```

---

## 测试辅助工具（扩展）

基于 Phase 9 的 helper 扩展：

```ts
// tests/utils/transformer-test-helper.ts
export function createMockProvider(overrides?: Partial<Provider>): Provider
export function createMockTransformContext(provider: Provider): TransformContext
export function mockResponse(json: object, status?: number): Response
export function mockStreamResponse(chunks: string[]): Response

// 新增：
export function mockGeminiResponse(json: object): Response           // Gemini 格式响应
export function mockVertexAuth(): Promise<string>                     // mock GCP access token
export function createMockStream(chunks: string[]): ReadableStream    // 通用 SSE stream 构造
```

---

## 各 Transformer 测试用例

### 1. openai-responses.test.ts

| 方法 | 场景 | 输入 | 断言 |
|---|---|---|---|
| `transformRequestOut` | messages → input | IR with messages + system | `input` 数组正确，system → `instructions`，messages 角色保留 |
| `transformRequestOut` | reasoning rewrite | IR with `reasoning: { effort: "high" }` | `reasoning` → `{ effort: "high", summary: "detailed" }` |
| `transformRequestOut` | tool calls | IR with tool_calls + tool messages | `input` 中 tool → `function_call_output`，assistant tool_calls → `function_call` |
| `transformRequestOut` | content normalization | IR with image_url + text | user image → `input_image`，assistant text → `output_text` |
| `transformRequestOut` | delete temp/max_tokens | IR with temperature + max_tokens | 两者被删除 |
| `transformResponseIn` | sync response | Responses API JSON (output array) | OpenAI chat.completion 格式，choices[0].message 正确 |
| `transformResponseIn` | stream — text delta | SSE: `response.output_text.delta` | `delta.content` 正确 |
| `transformResponseIn` | stream — tool call | SSE: `response.output_item.added` (function_call) | `delta.tool_calls` + `role: "assistant"` |
| `transformResponseIn` | stream — reasoning | SSE: `response.reasoning_summary_text.delta` | `delta.thinking.content` 正确 |
| `transformResponseIn` | stream — finish | SSE: `response.completed` | finish_reason: "stop" 或 "tool_calls" |

### 2. gemini.test.ts

| 方法 | 场景 | 输入 | 断言 |
|---|---|---|---|
| `transformRequestIn` | URL 构造 | IR with model="gemini-1.5-pro" | URL 含 `:generateContent`（非流）或 `:streamGenerateContent?alt=sse`（流） |
| `transformRequestIn` | auth header | any IR | `x-goog-api-key` 存在，`Authorization` 被删除 |
| `transformRequestIn` | body — basic | IR with user message | Gemini `contents` 格式正确，role 映射 |
| `transformRequestIn` | body — system | IR with system message | Gemini `systemInstruction` 字段 |
| `transformRequestIn` | body — tools | IR with tools | Gemini `tools` / `toolConfig` 格式 |
| `transformResponseOut` | sync response | Gemini generateContent JSON | IR (OpenAI) 格式，choices[0].message.content 正确 |
| `transformResponseOut` | stream response | Gemini SSE stream | IR SSE stream，data 前缀正确 |

### 3. deepseek.test.ts

| 方法 | 场景 | 输入 | 断言 |
|---|---|---|---|
| `transformRequestIn` | max_tokens clamp | IR with max_tokens=10000 | upstream body max_tokens=8192 |
| `transformRequestIn` | normal | IR with max_tokens=1024 | upstream body max_tokens=1024（不变） |
| `transformResponseOut` | stream — reasoning phase | SSE chunks with `delta.reasoning_content` | 输出含 `delta.thinking: { content: "..." }`，reasoning_content 被删除 |
| `transformResponseOut` | stream — reasoning → answer | SSE: reasoning chunk → content chunk | reasoning 结束后 emit 完整 thinking chunk，choice index 递增，然后正常 content |
| `transformResponseOut` | sync | normal OpenAI response | 原样透传 |

### 4. openrouter.test.ts

| 方法 | 场景 | 输入 | 断言 |
|---|---|---|---|
| `transformRequestIn` | cache_control strip (non-Claude) | IR with messages containing cache_control | upstream body 中 cache_control 被删除 |
| `transformRequestIn` | cache_control keep (Claude) | IR with messages containing cache_control, model is claude | cache_control 保留 |
| `transformRequestIn` | image normalization (non-Claude) | IR with image_url (base64) | upstream 中 image_url 为 raw base64（无 data: 前缀），media_type 删除 |
| `transformRequestIn` | image normalization (Claude) | IR with image_url (base64), model is claude | upstream 中 image_url 为 `data:{media_type};base64,...` |
| `transformRequestIn` | options merge | provider.options = { temperature: 0.5 } | upstream body 含 temperature: 0.5 |
| `transformResponseOut` | stream — reasoning → thinking | SSE with `delta.reasoning` | `delta.thinking` 正确，signature 存在 |
| `transformResponseOut` | stream — tool call index | SSE: text chunk → tool_call chunk | choice index 递增 |
| `transformResponseOut` | stream — numeric tool_call id | SSE with numeric tool_call id | id → `call_${uuidv4()}` 格式 |
| `transformResponseOut` | sync | normal response | 原样透传 |

### 5. groq.test.ts

| 方法 | 场景 | 输入 | 断言 |
|---|---|---|---|
| `transformRequestIn` | cache_control strip | IR with cache_control | upstream body 中 cache_control 被删除 |
| `transformRequestIn` | $schema strip | IR with tools containing `$schema` in parameters | upstream body 中 `$schema` 被删除 |
| `transformResponseOut` | stream — error chunk | SSE with `data.error` | 抛出错误 |
| `transformResponseOut` | stream — numeric tool_call id | SSE with numeric tool_call id | id → `call_${uuidv4()}` |
| `transformResponseOut` | stream — tool call after text | SSE: text → tool_call | choice index 递增 |

### 6. cerebras.test.ts

| 方法 | 场景 | 输入 | 断言 |
|---|---|---|---|
| `transformRequestIn` | reasoning present | IR with reasoning field | upstream body 中 reasoning 被删除 |
| `transformRequestIn` | no reasoning | IR without reasoning | upstream body 含 `disable_reasoning: false` |
| `transformResponseOut` | sync | normal response | 原样透传 |
| `transformResponseOut` | stream | normal stream | 原样透传 |

### 7. vercel.test.ts

| 方法 | 场景 | 输入 | 断言 |
|---|---|---|---|
| `transformRequestIn` | cache_control + image | 同 openrouter | 复用 openrouter 逻辑，断言一致 |
| `transformResponseOut` | stream | 同 openrouter | 复用 openrouter 逻辑，断言一致 |

> **注**：vercel transformer 和 openrouter 几乎一致，测试可以共用 fixture，但保持独立文件以便未来差异时隔离。

### 8. vertex-gemini.test.ts

| 方法 | 场景 | 输入 | 断言 |
|---|---|---|---|
| `transformRequestIn` | URL 构造 | IR with model="gemini-1.5-pro" | URL 含 GCP 项目ID、location、`:streamGenerateContent` |
| `transformRequestIn` | auth — env project_id | provider.options.project_id + GOOGLE_CLOUD_PROJECT env | `Authorization: Bearer {mock_token}`，x-goog-api-key 删除 |
| `transformRequestIn` | auth — credentials file | GOOGLE_APPLICATION_CREDENTIALS 指向 JSON | 从 JSON 提取 project_id，获取 token |
| `transformRequestIn` | auth — missing project_id | 无 project_id 无 env 无 creds | 抛出错误 |
| `transformRequestIn` | body | IR with messages | 复用 gemini body 转换逻辑 |
| `transformResponseOut` | sync | Gemini response | 复用 gemini response 转换逻辑 |

### 9. vertex-claude.test.ts

| 方法 | 场景 | 输入 | 断言 |
|---|---|---|---|
| `transformRequestIn` | URL 构造 | IR with model="claude-3-5-sonnet" | URL 含 `:streamRawPredict`，项目ID和location正确 |
| `transformRequestIn` | auth | 同 vertex-gemini | GCP OAuth token 正确注入 |
| `transformRequestIn` | body | IR with messages | 复用 anthropic body 转换逻辑 |
| `transformResponseOut` | sync | Anthropic response | 复用 anthropic response 转换逻辑 |

---

## 实施顺序

1. **编写测试辅助工具** — 扩展 `tests/utils/transformer-test-helper.ts`（mockVertexAuth、createMockStream 等）
2. **P1 transformer 测试** — openai-responses → gemini → deepseek → openrouter
3. **P2 transformer 测试** — groq → cerebras → vercel
4. **P3 transformer 测试** — vertex-gemini → vertex-claude（需先安装 google-auth-library）
5. **统一跑通** — `pnpm test` 全部通过

---

## Commit 策略

1. `test: add transformer test helper (mockStreamResponse, mockVertexAuth)`
2. `test: openai-responses transformer unit tests`
3. `test: gemini transformer unit tests`
4. `test: deepseek transformer unit tests (reasoning_content)`
5. `test: openrouter transformer unit tests (cache_control + image)`
6. `test: groq, cerebras, vercel transformer unit tests`
7. `test: vertex-gemini and vertex-claude transformer unit tests`

---

## 相关代码路径

- 测试 helper: `tests/utils/transformer-test-helper.ts`
- Transformer 接口: `packages/server/src/transformers/base.ts`
- Transformer 注册表: `packages/server/src/transformers/index.ts`
- 各 provider transformer: `packages/server/src/transformers/*.ts`
- vitest 配置: `vitest.config.ts`
