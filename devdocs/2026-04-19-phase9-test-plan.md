# Phase 9 — 测试体系（Mock 优先）

**日期**: 2026-04-19
**基于**: devdocs/2026-04-19-plan.md

---

## 背景

项目目前无测试框架、无测试文件。Phase 1~8 全部完成后，需要建立从基础到集成的三层测试体系，确保 proxy + transformer + routing 的核心链路正确。

---

## 决策汇总

| 决策项 | 结论 |
|---|---|
| 测试框架 | **vitest** — ESM 原生、速度快、monorepo workspace 友好 |
| 测试位置 | `tests/` 根目录，按层分子目录 |
| 测试运行时 DB | 内存 SQLite（`:memory:`），每次测试独立 |
| Streaming | 一次性实现，同步 + streaming 都纳入 |
| Layer 3 | 不是压测，是多项目/多用户数据模拟，验证 GUI 看板统计 |
| Layer 3 规模 | 中等：500-1000 请求，3 个项目模拟一周 |
| 错误场景 | 先测 happy path，异常处理后续补充 |
| 真实测试 | mock 全部通过后，Phase 9 内接入 openrouter 做小规模真实测试 |
| 使用场景 | Freelancer 多项目管理 + 小团队共享 Key |
| Streaming 范围 | **仅测 OpenAI 兼容平台**（OpenAI/DashScope/Moonshot/DeepSeek 等 SSE 格式一致）。Anthropic streaming 转换逻辑复杂且 CCR 无参考实现，deferred |
| Layer 3 时间分布 | 真实工作模式：工作日多、周末少 |
| 端口策略 | Base port + 偏移量，每个测试独立端口 + 临时 config 目录，支持并行 |
| Tool calls | 纳入 Phase 9，重点测 Anthropic 的 tool_use ↔ OpenAI tool_calls 转换 |
| 认证方式 | 保留 X-API-Key 认证：测试中创建 mock Key → 用 Key 发请求 → 完整链路 |

---

## 三层测试结构

```
tests/
  fixtures/           # 各平台 API 请求/响应 mock 数据
    openai/
      chat-completion-sync.json
      chat-completion-stream.json
    anthropic/
    dashscope/
    minimax/
    zhipu/
    moonshot/
    internal/          # InternalRequest / InternalResponse 统一格式样例
  unit/
    transformer.test.ts   # 所有 transformer 的输入输出断言
  integration/
    proxy.test.ts         # 基础转发：启动 mock 上游，验证请求到达 + 响应返回
    pipeline.test.ts      # 端到端：请求 → transformer → mock 上游 → transformer → 响应
  mock/
    studio-sim.ts         # Layer 3：模拟小工作室一周使用场景
    seed.ts               # 数据生成工具
```

---

## Layer 1：基础转发测试（integration/proxy.test.ts）

**目标**：以终端用户视角，验证完整转发链路正确。

**方式**：
1. 启动 mock 上游 server（`http.createServer`），记录收到的请求内容
2. 启动 Token Flow server（临时 config 目录，内存 DB，独立端口）
3. 在 Token Flow 中创建一个 API Key（写 `api_keys` 表）
4. 用该 Key 向 Token Flow proxy 发送 `/v1/chat/completions` 请求
5. **assert 三点**：
   - **到达断言**：mock 上游收到了请求（路径/方法正确）
   - **格式断言**：mock 上游收到的请求体字段符合预期（经 transformer 转换后）
   - **返回断言**：用户收到的响应 HTTP 200 + body 可解析 + 格式正确

**覆盖**：`/v1/chat/completions`（同步 + streaming）

---

## Layer 2：Transformer 单元测试（unit/transformer.test.ts）

**目标**：每个 transformer 的 `transformRequestIn` / `transformRequestOut` / `transformResponseIn` / `transformResponseOut` 四个方向输入输出正确。

**方式**：纯数据层，不启动 server。给 fixture JSON → 断言输出 JSON。

**测试矩阵**：

| Transformer | 方法 | 输入 | 输出 |
|---|---|---|---|
| OpenAI | transformRequestIn | OpenAI request | InternalRequest |
| OpenAI | transformRequestOut | InternalRequest | OpenAI request |
| Anthropic | transformRequestIn | Anthropic request | InternalRequest |
| Anthropic | transformRequestOut | InternalRequest | Anthropic request |
| Anthropic | transformResponseIn | Anthropic response | InternalResponse |
| Anthropic | transformResponseOut | InternalResponse | OpenAI response |
| DashScope | transformRequestIn | DashScope request | InternalRequest |
| DashScope | transformRequestOut | InternalRequest | DashScope request |
| MiniMax | transformRequestIn | MiniMax request | InternalRequest |
| MiniMax | transformRequestOut | InternalRequest | MiniMax request |
| Zhipu | transformRequestIn | Zhipu request | InternalRequest |
| Zhipu | transformRequestOut | InternalRequest | Zhipu request |
| Moonshot | transformRequestIn | Moonshot request | InternalRequest |
| Moonshot | transformRequestOut | InternalRequest | Moonshot request |

**Fixture 数据来源**：根据各平台官方文档构造。

**文档收集 TODO**：
- [ ] OpenAI Chat Completions API
- [ ] Anthropic Messages API
- [ ] DashScope 通义千问 API
- [ ] MiniMax API
- [ ] Zhipu ChatGLM API
- [ ] Moonshot API

> 用户负责收集以上文档，放到 `reference/` 文件夹。

---

## Layer 3：Mock 集成脚本（mock/studio-sim.ts）

**目标**：模拟小工作室一周使用场景，验证 GUI 看板统计正确。

**方式**：
1. 启动 Token Flow server（内存 DB）
2. 创建多个 Key（模拟不同项目/成员）：
   - 项目 A：OpenAI GPT-4o
   - 项目 B：Anthropic Claude
   - 项目 C：DashScope
3. 每个 Key 发送不同量级的请求（模拟一周内的分布）
4. 上游用本地 mock server 返回固定响应
5. 验证：打开 GUI Dashboard，看统计数字是否正确（总请求量、总 token、各 Key 用量分布）

**输出**：直接打开 `http://localhost:40002` 查看 GUI 看板。

---

## 其他决策

| 决策项 | 结论 |
|---|---|
| CI 脚本 | 需要，root `package.json` 加 `test` 命令（`vitest --run`） |
| TUI 测试 | Phase 9 不覆盖，等 TUI 功能稳定后再补 |
| 覆盖率 | 需要，配置 `vitest --coverage` |
| Mock 上游响应（单元测试） | 固定通用响应，所有平台返回相同内容（`{"choices": [{"message": {"content": "Hello"}}]}`），用于验证转发通路 |
| Mock 上游响应（大规模测试） | 生成真实聊天数据，通过脚本调用 qwen/deepseek 等便宜 API 自动生成 |

## 基础设施改造（前置工作）

测试中需要自定义 config 路径和 DB 路径。当前代码里 `loadConfig()` 和 `getDb()` 都写死了 `~/.tokenflow/`。

**改造内容**：
1. `loadConfig(configPath?: string)` — 允许传入自定义路径，默认仍为 `~/.tokenflow/config.json5`
2. `getDb(dbPath?: string)` — 允许传入自定义路径，重置单例缓存
3. 环境变量支持：`TOKENFLOW_CONFIG_PATH`、`TOKENFLOW_DB_PATH`
4. proxy handler 中 `loadConfig()` 支持从环境变量读取自定义路径

> 此改造不仅方便测试，也让用户能灵活选择配置文件存放位置。

## Commit 策略

每个 Layer 一个 commit：
- `feat: Layer 1 — proxy forwarding integration tests`
- `feat: Layer 2 — transformer unit tests with fixtures`
- `feat: Layer 3 — studio simulation script for multi-project usage`

## 实施顺序

1. **基础设施改造** — 自定义 config/DB 路径 + 环境变量支持
2. **安装 vitest + 配置** — 根目录 `package.json` 加 devDeps，`vitest.config.ts`
3. **收集 fixture 文档** — 用户按 TODO 收集到 `reference/` 文件夹
4. **写 Layer 2 fixtures** — 根据文档构造各平台请求/响应样例
5. **写 Layer 2 transformer 测试** — 逐个实现各 transformer 的断言
6. **写 Layer 1 proxy 测试** — 验证基础转发通路
7. **写 Layer 3 studio-sim** — 多项目 mock 脚本
8. **跑通所有测试** — 边跑边修代码和测试

---

## CCR 可复用资源

### 已确认可直接抄

| CCR 资源 | Token Flow 用途 | 状态 |
|---|---|---|
| `SSEParserTransform` / `SSESerializerTransform` | SSE 流解析/序列化通用工具 | 未引入，待 Phase 9 或后续 |
| `rewriteStream` | 通用 ReadableStream 转换工具 | 未引入，待 Phase 9 或后续 |
| DeepSeek `transformResponseOut` streaming | DeepSeek reasoning_content → thinking 转换 | 架构不同（CCR 是 responseOut，TF 是 responseIn），不能直接抄 |

### 不可直接抄（需自研）

| 场景 | 原因 |
|---|---|
| Anthropic streaming (Anthropic SSE → OpenAI SSE) | CCR 只有 OpenAI → Anthropic 方向，无反向实现 |
| DashScope / MiniMax / Zhipu streaming | CCR 无这些平台的 transformer |
| 国内平台 request/response 格式转换 | CCR 无这些平台实现 |

## DB 结构速查

测试中涉及的 SQLite 表（内存模式）：

| 表 | 用途 | 关键字段 |
|---|---|---|
| `api_keys` | Token Flow 生成的 API Key 元数据 | id, name, provider, upstream_key, base_url, scenario |
| `request_logs` | 每次请求的详细记录 | api_key_id, session_id, model, prompt/completion/total_tokens, status, detected_pattern, efficiency_score |
| `sessions` | 会话聚合统计 | session_id, api_key_id, message_count, total_*_tokens, current_pattern |

> 测试中 `api_keys` 表可直接插入 mock 数据，request_logs 和 sessions 由 proxy 请求自动写入。

## 相关代码路径

- Transformer 接口：`packages/server/src/transformers/base.ts`
- Transformer 注册表：`packages/server/src/transformers/index.ts`
- Proxy handler：`packages/server/src/proxy/handler.ts`
- 内置 transformers：`packages/server/src/transformers/openai.ts`、`anthropic.ts` 等
- DB schema：`packages/server/src/db/schema.ts`
