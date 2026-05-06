# 测试方案对比：Phase 9 vs Provider Transformer 移植

| 对比项 | Phase 9（旧） | Provider Transformer 移植（新） | 差异说明 |
|---|---|---|---|
| **测试对象** | 3 个 transformer：OpenAIMain、AnthropicMain、OpenAIProvider | 9 个 provider transformer：responses、gemini、deepseek、openrouter、groq、cerebras、vercel、vertex-gemini、vertex-claude | 从 3 个扩展到 12 个（含已有），新增 9 个 |
| **测试文件数** | 3 个单元测试文件 | 9 个单元测试文件 | 数量 ×3 |
| **测试目录** | `tests/unit/` | `tests/unit/transformers/` | 新增子目录，更清晰的分类 |
| **MainTransformer 测试** | 有（OpenAI + Anthropic） | 新增 openai-responses MainTransformer | 新增 endpoint `/v1/responses` 需要新的 MainTransformer |
| **测试维度** | 按方法分：transformRequestOut / transformResponseIn | 按场景分：sync request / sync response / stream response / edge cases | 从方法导向转为场景导向，更易读 |
| **Stream 测试覆盖** | AnthropicMain（OpenAI SSE → Anthropic SSE） | 8 个 transformer 都有 stream 测试（除 cerebras 透传） | Stream 测试从 1 个扩展到 8 个，reasoning/thinking 是重点 |
| **Mock 复杂度** | 简单：固定 JSON Response、固定 SSE chunks | 复杂：需要模拟 reasoning 阶段、tool_call index 递增、image base64 归一化、GCP OAuth token | Mock 场景更复杂，helper 需要扩展 |
| **测试辅助工具** | 未明确 helper 文件 | 明确扩展 `tests/utils/transformer-test-helper.ts` | 新增 `mockGeminiResponse`、`mockVertexAuth`、`createMockStream` |
| **集成测试** | 有（pipeline-openai + pipeline-anthropic） | 预案阶段未包含，后续补充 | 新预案专注单元测试，集成测试在实现后补充 |
| **特殊字段测试** | tool_calls / tool_use、thinking | reasoning_content、cache_control、image_url 归一化、$schema、disable_reasoning | 测试字段从通用工具调用扩展到 provider 专属字段 |
| **Auth 测试** | 简单：Bearer token、x-api-key | 复杂：x-goog-api-key、GCP OAuth（env var / credentials file / project_id 解析） | Vertex 系列引入 GCP 认证，测试需要 mock auth 流程 |
| **Error 测试** | 未明确 | vertex-gemini/claude：project_id 缺失时抛出错误；groq：stream error chunk 抛出错误 | 新增 error 路径测试 |
| **Options 透传测试** | 无 | openrouter / vercel：provider.options merge 到 upstream body | 新增配置扩展的测试 |
| **实施顺序** | infra → vitest → fixture → 单元 → 集成 → 跑通 | helper → P1 → P2 → P3 → 跑通 | 分层按优先级实施，P3（Vertex）依赖 google-auth-library |
| **外部依赖** | 无新增 | `google-auth-library`（仅 vertex-gemini / vertex-claude 测试需要） | 新增一个 npm devDependency |
| **Fixture 需求** | 用户构造 OpenAI + Anthropic 请求/响应样例 | 需要构造 Gemini、DeepSeek、OpenRouter、Vertex 等格式的请求/响应样例 | Fixture 类型从 2 种扩展到 8+ 种 |

---

## 核心差异总结

**Phase 9** 是在已有代码上补测试，重点是验证 Anthropic ↔ OpenAI 的双向转换正确。

**Provider Transformer 移植** 是在写新代码的同时写测试，重点是：
1. **每个 provider 的专属逻辑**（如 DeepSeek reasoning_content、OpenRouter cache_control 条件剥离）
2. **Stream 场景的复杂状态机**（reasoning 阶段 → answer 阶段、tool_call index 递增）
3. **外部认证集成**（GCP OAuth 的 mock）
4. **配置扩展的验证**（options 字段 merge 到 upstream request）
