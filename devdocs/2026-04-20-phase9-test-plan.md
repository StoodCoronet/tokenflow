# Phase 9 — 测试体系

**日期**: 2026-04-20
**基于**: Phase 8.5 两层 transformer 架构
**替代**: devdocs/2026-04-19-phase9-test-plan.md（已过期）

---

## 背景

Phase 8.5 重构了 transformer 层为两层架构（MainTransformer + ProviderTransformer），删除了国内平台独立 transformer，新增 Anthropic 端点。需要建立测试体系验证核心链路。

### 两层架构数据流

```
请求方向（Client → Upstream）:
  Client 格式 (Anthropic/OpenAI)
    → MainTransformer.transformRequestOut() → IR (UnifiedChatRequest)
    → ProviderTransformer.transformRequestIn() → ProviderRequest (url + headers + body)
    → fetch 到上游

响应方向（Upstream → Client）:
  上游响应 (OpenAI 格式)
    → ProviderTransformer.transformResponseOut() → IR 响应
    → MainTransformer.transformResponseIn() → Client 格式 (Anthropic/OpenAI)
    → 返回客户端
```

3 个 transformer 对象：
- `OpenAIMainTransformer`：透传（IR 就是 OpenAI 格式）
- `AnthropicMainTransformer`：Anthropic ↔ IR 双向转换（含 SSE streaming）
- `OpenAIProviderTransformer`：透传 + 构建 URL/headers

---

## 决策汇总

| 决策项 | 结论 |
|---|---|
| 测试框架 | **vitest** — ESM 原生、速度快、monorepo workspace 友好 |
| 测试位置 | `tests/` 根目录，按层分子目录 |
| 测试运行时 DB | 内存 SQLite（`:memory:`），每次测试独立 |
| 单元测试结构 | 按 3 个 transformer 对象分文件 |
| 集成测试结构 | 按端点分文件（OpenAI / Anthropic） |
| Streaming | 双层覆盖（单元测试 + 集成测试） |
| Tool calls | 重点测试（Anthropic tool_use ↔ OpenAI tool_calls） |
| Layer 3 | **延后**，待 Layer 1+2 稳定后再做 |
| 覆盖率 | 不设百分比指标，只看通过/失败 |
| 自定义路径 | 环境变量方案：`TOKENFLOW_CONFIG_PATH`、`TOKENFLOW_DB_PATH` |
| Fixture | 用户负责构造，不需要单独收集 API 文档 |
| 实施顺序 | 基础设施 → vitest → fixture → 单元测试 → 集成测试 → 跑通 |

---

## 测试目录结构

```
tests/
  fixtures/                    # 各格式请求/响应样例（用户构造）
    openai/
      request.json
      response-sync.json
      response-stream.txt
    anthropic/
      request.json
      response-sync.json
      response-stream.txt
    ir/
      unified-request.json
  unit/
    openai-main.test.ts        # OpenAIMainTransformer
    anthropic-main.test.ts     # AnthropicMainTransformer
    openai-provider.test.ts    # OpenAIProviderTransformer
  integration/
    pipeline-openai.test.ts    # OpenAI 端点端到端
    pipeline-anthropic.test.ts # Anthropic 端点端到端
```

---

## Layer 2：单元测试

### openai-main.test.ts

测试 `OpenAIMainTransformer`（透传）：

| 方法 | 输入 | 断言 |
|---|---|---|
| transformRequestOut | OpenAI request body | 原样返回为 UnifiedChatRequest |
| transformResponseIn | OpenAI response (非流) | 原样返回 Response |

### anthropic-main.test.ts

测试 `AnthropicMainTransformer`（核心转换逻辑）：

| 方法 | 场景 | 输入 | 断言 |
|---|---|---|---|
| transformRequestOut | 基本消息 | Anthropic request (system + messages) | IR: system → system message, messages 结构正确 |
| transformRequestOut | Tool calls | Anthropic request with tool_use + tool_result | IR: tool_use → tool_calls, tool_result → tool message |
| transformRequestOut | Thinking | Anthropic request with thinking block | IR: thinking 字段保留 |
| transformRequestOut | Tools schema | Anthropic tools with input_schema | IR: input_schema → function.parameters |
| transformResponseIn | 同步响应 | OpenAI sync response JSON | Anthropic response: content/tool_use/stop_reason/usage 正确映射 |
| transformResponseIn | 同步响应 + tool calls | OpenAI response with tool_calls | Anthropic: tool_calls → tool_use content blocks |
| transformResponseIn | Streaming | OpenAI SSE stream | Anthropic SSE: message_start/content_block_delta/message_stop 事件正确 |

### openai-provider.test.ts

测试 `OpenAIProviderTransformer`（透传 + URL/headers）：

| 方法 | 输入 | 断言 |
|---|---|---|
| transformRequestIn | UnifiedChatRequest + provider context | ProviderRequest: url 拼接正确, Authorization header 正确 |
| transformRequestIn | 带 tools/tool_choice | tools/tool_choice 正确透传 |
| transformResponseOut | Response | 原样返回 |

---

## Layer 1：集成测试

### pipeline-openai.test.ts

**链路**：Client (OpenAI) → OpenAI main → IR → OpenAI provider → mock 上游 → 返回

1. 启动 mock 上游（返回固定 OpenAI 响应）
2. 启动 Token Flow server（临时 config，内存 DB）
3. 创建 API Key
4. 向 `/v1/chat/completions` 发送 OpenAI 格式请求
5. **断言**：
   - mock 上游收到正确请求（路径、headers、body 字段）
   - 响应 HTTP 200 + body 可解析
   - request_logs 表有对应记录

### pipeline-anthropic.test.ts

**链路**：Client (Anthropic) → Anthropic main → IR → OpenAI provider → mock 上游 → IR → Anthropic main → Client

1. 启动 mock 上游（返回 OpenAI 格式响应）
2. 启动 Token Flow server
3. 创建 API Key（provider 指向 mock 上游）
4. 向 `/v1/messages` 发送 Anthropic 格式请求
5. **断言**：
   - mock 上游收到 OpenAI 格式请求（经转换）
   - 响应为 Anthropic 格式（经转换）
   - stop_reason、usage、content 字段正确
   - Streaming：SSE 事件类型和内容正确

---

## 基础设施改造（前置）

当前 `loadConfig()` 和 `getDb()` 写死 `~/.tokenflow/`。改造为支持环境变量：

- `TOKENFLOW_CONFIG_PATH`：自定义 config 文件路径
- `TOKENFLOW_DB_PATH`：自定义 DB 文件路径（测试时用 `:memory:`）

改造文件：
- `packages/server/src/configLoader.ts`
- `packages/server/src/db/schema.ts`
- `packages/server/src/index.ts`

---

## 实施顺序

1. **基础设施改造** — 环境变量支持
2. **安装 vitest + 配置** — 根目录 package.json 加 devDeps，vitest.config.ts
3. **用户构造 fixture** — OpenAI + Anthropic 请求/响应样例
4. **单元测试 — OpenAI main** — 透传测试
5. **单元测试 — Anthropic main** — 核心转换 + streaming + tool calls
6. **单元测试 — OpenAI provider** — URL/headers 测试
7. **集成测试 — OpenAI pipeline** — 端到端
8. **集成测试 — Anthropic pipeline** — 端到端 + streaming
9. **跑通所有测试** — 边跑边修

---

## Commit 策略（细粒度）

1. `feat: test infra — env var support for config/DB paths`
2. `feat: test infra — vitest setup with ESM config`
3. `test: OpenAI main transformer unit tests`
4. `test: Anthropic main transformer unit tests (sync + streaming + tool calls)`
5. `test: OpenAI provider transformer unit tests`
6. `test: OpenAI pipeline integration test`
7. `test: Anthropic pipeline integration test`

---

## 相关代码路径

- Transformer 接口：`packages/server/src/transformers/base.ts`
- Transformer 注册表：`packages/server/src/transformers/index.ts`
- OpenAI transformers：`packages/server/src/transformers/openai.ts`
- Anthropic transformer：`packages/server/src/transformers/anthropic.ts`
- Proxy handler：`packages/server/src/proxy/handler.ts`
- Router：`packages/server/src/proxy/router.ts`
- DB schema：`packages/server/src/db/schema.ts`
- Config loader：`packages/server/src/configLoader.ts`
- Server entry：`packages/server/src/index.ts`
