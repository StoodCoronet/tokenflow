# CCR Transformer Architecture Research

**Date**: 2026-04-19
**Source**: `reference/claude-code-router/packages/core/src/`

---

## A. Transformer 接口

CCR 的 Transformer 是宽松对象类型，所有方法可选：

```typescript
type Transformer = {
  // 请求流入：外部格式 → 统一格式
  transformRequestIn?: (request, provider, context) => Promise<Record<string, any>>
  // 请求流出：统一格式 → Provider 格式
  transformRequestOut?: (request, context) => Promise<UnifiedChatRequest>
  // 响应流入：Provider 格式 → 统一格式
  transformResponseIn?: (response, context) => Promise<Response>
  // 响应流出：统一格式 → 外部格式
  transformResponseOut?: (response, context) => Promise<Response>
  // 认证处理
  auth?: (request, provider, context) => Promise<any>
  endPoint?: string
  name?: string
}
```

**关键设计**:
- 4 个方向方法（In/Out × Request/Response），全部可选
- `endPoint` 声明 Provider API 路径
- `auth` 独立处理认证（Bearer、x-api-key、OAuth 等）
- TransformerContext 贯穿整个 pipeline

---

## B. Transformer 生命周期

### 注册

```typescript
class TransformerService {
  private transformers: Map<string, Transformer | TransformerConstructor> = new Map()

  registerTransformer(name: string, transformer: Transformer): void
  async registerTransformerFromConfig(config: { path?: string; options?: any }): Promise<boolean>
  private async registerDefaultTransformersInternal(): Promise<void>
}
```

### 选择与执行

1. Provider 配置指定 `provider.transformer`
2. 可叠加 Utility transformer：`{ use: ["reasoning", "maxtoken"] }`
3. 按配置顺序执行 pipeline

### Pipeline 执行顺序

```
transformRequestIn → transformRequestOut → auth → API 调用
→ transformResponseIn → transformResponseOut
```

---

## C. Provider vs Utility Transformer

### Provider Transformer

格式适配器，处理不同平台的请求/响应格式差异。

| 文件 | 平台 | 关键特征 |
|------|------|----------|
| `openai.transformer.ts` | OpenAI | 透传（统一格式即 OpenAI），endPoint=/v1/chat/completions |
| `anthropic.transformer.ts` | Anthropic | system 分离、tool_use/tool_result、thinking block、完整 stream 转换 |
| `deepseek.transformer.ts` | DeepSeek | reasoning_content → thinking，max 8192 tokens |
| `gemini.transformer.ts` | Gemini | contents 数组、functionDeclarations、x-goog-api-key |
| `groq.transformer.ts` | Groq | 去 cache_control、去 $schema、tool call ID 生成 |
| `openrouter.transformer.ts` | OpenRouter | 条件处理（Claude vs 其他）、图片 data URI 转换 |
| `vercel.transformer.ts` | Vercel AI SDK | 图片处理、cache control 条件移除 |
| `cerebras.transformer.ts` | Cerebras | 去 reasoning 字段、设 disable_reasoning |
| `vertex-claude.transformer.ts` | Vertex AI Claude | Google OAuth、streamRawPredict URL |
| `vertex-gemini.transformer.ts` | Vertex AI Gemini | Google OAuth、streamGenerateContent URL |

### Utility Transformer

行为修改器，不关心平台，只处理通用逻辑。

| 文件 | 功能 |
|------|------|
| `reasoning.transformer.ts` | reasoning 字段处理 |
| `maxtoken.transformer.ts` | 限制 max_tokens |
| `tooluse.transformer.ts` | 工具调用模式处理 |
| `customparams.transformer.ts` | 注入自定义参数 |
| `forcereasoning.transformer.ts` | 强制开启 reasoning |
| `sampling.transformer.ts` | 采样参数调整 |
| `streamoptions.transformer.ts` | 流式选项控制 |
| `maxcompletiontokens.transformer.ts` | max_completion_tokens 转换 |
| `cleancache.transformer.ts` | 清理 cache_control |
| `enhancetool.transformer.ts` | 增强工具调用 |

### 组合方式

配置驱动，可叠加：

```json5
{
  transformer: {
    use: ["reasoning", "maxtoken"],
    maxtoken: { max_tokens: 4000 }
  }
}
```

或按模型配置：

```json5
{
  transformer: {
    "claude-3-opus": { use: ["maxtoken"], maxtoken: { max_tokens: 4000 } }
  }
}
```

---

## D. Provider Transformer 详细分析

### Anthropic Transformer

**核心**: OpenAI ↔ Anthropic 双向转换

请求转换（Out → Anthropic）:
- `messages` 中 role=system 的提取到顶层 `system` 字段
- `tool_calls` → Anthropic `tool_use` content block
- `reasoning_content` → `thinking` block
- `max_tokens` 默认 4096

响应转换（In ← Anthropic）:
- content blocks 拼接（text + tool_use）
- `input_tokens/output_tokens` → `prompt_tokens/completion_tokens`
- `stop_reason` → `finish_reason` 映射

Stream:
- 逐 event 处理：content_block_start/delta/stop
- tool_use 需要跨 event 拼接 input_json
- thinking block 转为 reasoning_content delta

### Gemini Transformer

**核心**: OpenAI ↔ Google Gemini

请求转换:
- `messages` → `contents` 数组（role 映射: user→user, assistant→model）
- `tools` → `functionDeclarations`（去嵌套 schema）
- system message → `systemInstruction`

响应转换:
- `candidates[0].content.parts` → choices
- `usageMetadata` → usage

### DeepSeek Transformer

- 与 OpenAI 几乎兼容
- `reasoning_content` → `thinking` 格式
- max_tokens 硬限制 8192

### Vertex AI Transformer

- 认证走 Google OAuth（@google-cloud/auth-library）
- URL 格式: `/v1/projects/{pid}/locations/{loc}/publishers/{publisher}/models/{model}:{action}`
- 实际转换逻辑委托给 anthropic/gemini utility

---

## E. Streaming 架构

### 核心 Stream 工具

```
SSEParserTransform:   SSE 文本流 → JS 对象流
SSESerializerTransform: JS 对象流 → SSE 文本流
rewriteStream:        包装 ReadableStream，提供逐 event 处理回调
```

### Transformer 中的 Stream 处理模式

```typescript
// 1. 检测是否 stream（Content-Type 或 body.stream）
// 2. 对于 stream response:
const newStream = new ReadableStream({
  async start(controller) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      // 逐行处理 SSE events
      for (const line of buffer.split('\n')) {
        if (line.startsWith('data: ')) {
          // 解析、转换、输出
        }
      }
    }
    controller.close()
  }
})

return new Response(newStream, { headers: response.headers })
```

### 状态管理

Stream 转换通常需要跨 chunk 维护状态：
- `hasTextContent` — 是否已输出文本
- `reasoningContent` — reasoning 内容缓冲
- `toolCallIndex` — 工具调用索引
- `toolInputBuffers` — 工具输入 JSON 缓冲

---

## F. 请求流程（End to End）

```
1. 请求到达 /v1/messages
   ↓
2. Auth middleware — 验证 API key
   ↓
3. Router — 解析 model 格式 "provider,model"，确定目标 provider
   ↓
4. transformRequestIn — 外部格式 → 统一格式（如有）
   ↓
5. transformRequestOut — 统一格式 → Provider 格式
   ↓
6. auth — 构建认证 headers（Bearer / x-api-key / OAuth）
   ↓
7. 发送到上游 Provider API
   ↓
8. transformResponseIn — Provider 响应 → 统一格式（含 stream 处理）
   ↓
9. transformResponseOut — 统一格式 → 外部格式（如有）
   ↓
10. 返回给客户端
```

---

## G. 配置与插件系统

### Provider 配置

```json5
{
  providers: [{
    name: "openai",
    api_base_url: "https://api.openai.com/v1",
    api_key: "sk-xxx",
    models: ["gpt-4o", "gpt-4o-mini"],
    transformer: {
      use: ["maxtoken"],
      maxtoken: { max_tokens: 4000 }
    }
  }]
}
```

### 自定义 Transformer

```json5
{
  transformers: [{
    name: "my-transformer",
    type: "class",          // "class" | "module"
    path: "./my-transformer.js",
    options: { custom: true }
  }]
}
```

- `class` 类型：导出 class，通过 new + options 实例化
- `module` 类型：导出对象，直接作为 transformer 使用
- 通过 `TransformerService.registerTransformerFromConfig()` 加载

---

## H. 对 Token Flow 的建议

### 直接采纳

| 模式 | 说明 |
|------|------|
| 4 向 Transformer 接口 | In/Out × Req/Res，按需实现 |
| Pipeline 组合 | Provider + Utility 可叠加 |
| SSE Stream 工具 | SSEParser/Serializer 模式 |
| Map 注册表 | 动态注册 + 按名查找 |
| 插件加载 | config path + dynamic import |
| 统一格式 | OpenAI 作为中间格式 |

### 需要适配

| 维度 | CCR | Token Flow 适配 |
|------|-----|-----------------|
| 统一格式名 | UnifiedChatRequest | InternalRequest（保持现有命名） |
| Transformer 必需方法 | 全部可选 | name + 至少一个方向方法 |
| 国内平台 | 无 | 新增 DashScope/MiniMax/GLM/Kimi |
| Context 参数 | TransformerContext | TransformContext（简化版） |

### 暂不实现

| 功能 | 原因 |
|------|------|
| Utility transformer | Phase 5 只做 Provider，后续按需加 |
| 按模型配置 transformer | 简化为按 provider 配置 |
| Google OAuth (Vertex AI) | 国内平台不需要 |
| 图片 data URI 转换 | 按需加 |
