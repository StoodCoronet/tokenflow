# Phase 9 — 测试体系

> 详细计划见 `devdocs/2026-04-20-phase9-test-plan.md`

## 当前进度 (2026-04-20)

- ✅ 基础设施：环境变量 + vitest 配置 + smoke test
- ✅ API 文档收集完成（详见下方）
- ⬜ Fixture 数据构造
- ⬜ 单元测试（3 文件）
- ⬜ 集成测试（2 文件）
- ⬜ Layer 3 studio-sim（延后）

## API 参考文档

位置：`devdocs/api-docs/`

| 文件 | 来源 | 说明 |
|---|---|---|
| `anthropic.md` | 官方 | Messages API 完整参数（122KB，4773行） |
| `anthropic_streaming.md` | 官方 | SSE streaming 事件格式 + 完整示例 |
| `anthropic-ref.md` | 精简 | 测试用参考，~8KB |
| `openai-chat.md` | 官方 | Chat Completions API 完整参数（6499行） |
| `openai-sse-api-doc.md` | 官方 | Streaming 概述（Responses API 风格） |
| `openai-ref.md` | 精简 | 测试用参考，基于官方文档校对 |
| `openai.md` | GPT-5.4 | 早期摘要（已被官方文档取代） |
| `openai-sse.md` | GPT-5.4 | 早期 SSE 摘要（已被官方文档取代） |

**写测试时读 `anthropic-ref.md` 和 `openai-ref.md`，需要细节时查原始大文件。**

## 下一步

构造 fixture 数据 → 单元测试 → 集成测试