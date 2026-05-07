# Token Flow — 项目状态快照

**日期**: 2026-05-07
**分支**: `feat/typescript`
**提交**: `78002b6` fix: call cleanupOldStats() on server startup
**状态**: 核心功能全部就位，进入增强阶段

---

## 环境速查

| 服务 | 端口 | 启动命令 |
|------|------|----------|
| Server (Fastify) | **40001** | `pnpm dev:server` |
| UI (Vite) | **40002** | `pnpm dev:ui` |
| Docs (Vite) | **40003** | `pnpm dev:docs` |
| CLI | — | `pnpm dev:cli` |

**数据库**: `~/.tokenflow/tokenflow.db` (SQLite, WAL mode)
**Config**: `~/.tokenflow/config.json5`
**测试**: `pnpm test` (90 个用例全部通过)
**Build**: `pnpm build` (server + ui + docs)
**数据模拟**: `npx tsx tests/simulation/studio-sim.ts`

---

## 文档索引

| 文档 | 日期 | 状态 | 说明 |
|------|------|------|------|
| [project-status](2026-05-06-project-status.md) | 2026-05-07 | **最新** | 本文件，项目全景快照 |
| [analysis-dashboard-spec](2026-05-06-analysis-dashboard-spec.md) | 2026-05-06 | **最新** | Analysis Dashboard 改造设计决策 |
| [provider-transformers-port-spec](2026-04-26-provider-transformers-port-spec.md) | 2026-04-26 | **最新** | 11 个 Provider Transformer 移植方案 |
| [provider-transformers-test-plan](2026-04-26-provider-transformers-test-plan.md) | 2026-04-26 | **最新** | Provider Transformer 单元测试方案 |
| [test-plan-comparison](2026-04-26-test-plan-comparison.md) | 2026-04-26 | **参考** | Phase 9 旧版 vs 新版测试方案对比 |
| [phase9-test-plan](2026-04-20-phase9-test-plan.md) | 2026-04-20 | **最新** | Phase 9 测试体系（Mock 优先） |
| [phase8.5-transformer-audit-spec](2026-04-20-phase8.5-transformer-audit-spec.md) | 2026-04-20 | **参考** | Phase 8.5 Transformer 审计与重构 |
| [plan](2026-04-19-plan.md) | 2026-04-19 | **过时** | 早期实现计划，被 project-status 取代 |
| [phase9-test-plan](2026-04-19-phase9-test-plan.md) | 2026-04-19 | **过时** | 被 2026-04-20 版取代 |
| [ccr-research](2026-04-19-ccr-research.md) | 2026-04-19 | **参考** | CCR Transformer 架构调研 |
| [sessions-page-spec](2026-04-18-sessions-page-spec.md) | 2026-04-18 | **过时** | Sessions 页面早期设计 |
| [plan](2026-04-18-plan.md) | 2026-04-18 | **过时** | 早期实现计划 |
| [feature-comparison](2026-04-17-feature-comparison.md) | 2026-04-17 | **参考** | CCR vs Token Flow 功能对比 |
| [typescript-rewrite-plan](2026-04-16-typescript-rewrite-plan.md) | 2026-04-16 | **参考** | TypeScript 重写计划 |
| [cli-redesign](2026-04-16-cli-redesign.md) | 2026-04-16 | **过时** | CLI 重设计早期笔记 |
| [cli-redesign](2026-04-15-cli-redesign.md) | 2026-04-15 | **过时** | CLI 重设计早期笔记 |
| [spec](2026-03-26-spec.md) | 2026-03-26 | **参考** | 产品规格、架构、数据模型 |
| [deploy](2026-03-26-deploy.md) | 2026-03-26 | **过时** | Python 版本部署指南（legacy） |
| [readme](2026-03-26-readme.md) | 2026-03-26 | **过时** | 早期 README |

> **API 参考文档** 位于 `devdocs/api-docs/`，包含 OpenAI、Anthropic 官方文档及精简版参考。

---

## 已完成 ✅

### Phase 1-6 基础架构
- [x] 前后端对接验证
- [x] Anthropic Console 风格 UI 改造（亮/暗主题、暖灰色调）
- [x] Sessions 重设计 + Keys CRUD（创建/更新/删除）
- [x] Settings 页面（Provider/Detector/Proxy 配置）
- [x] Documentation 独立包 (`packages/docs/`，端口 40003)
- [x] 前后端共享包 (`packages/shared/`)

### Phase 7 CCR 调研
- [x] CCR 源码调研与提炼（Transformer 4 向接口、生命周期、Pipeline）
- [x] Transformer 两层架构设计决策（Main + Provider）

### Phase 8 TUI
- [x] 全屏 TUI (ink)
- [x] 键盘导航（← → ESC）
- [x] Providers / Ports / Router / Detectors / General 页面
- [x] CLI 重设计（基于 CCR 调研）

### Phase 8.5 Transformer 两层架构
- [x] MainTransformer（按 endpoint URL）+ ProviderTransformer（按 provider template）
- [x] `/v1/chat/completions` + `/v1/messages` + `/v1/responses` 多端点支持
- [x] 11 个 provider transformer 全部就位

| # | Template | 文件 | 状态 | 说明 |
|---|----------|------|------|------|
| 1 | `openai` | `transformers/openai.ts` | ✅ | 基准，直接转发 |
| 2 | `anthropic` | `transformers/anthropic.ts` | ✅* | sync 完整，stream 为 pass-through |
| 3 | `openai-responses` | `transformers/openai-responses.ts` | ✅ | OpenAI Responses API |
| 4 | `gemini` | `transformers/gemini.ts` | ✅ | Google Gemini 原生 API |
| 5 | `deepseek` | `transformers/deepseek.ts` | ✅ | reasoning_content 特殊处理 |
| 6 | `openrouter` | `transformers/openrouter.ts` | ✅ | cache_control + image 归一化 |
| 7 | `groq` | `transformers/groq.ts` | ✅ | $schema 剥离 + tool_call ID |
| 8 | `cerebras` | `transformers/cerebras.ts` | ✅ | reasoning 字段处理 |
| 9 | `vercel` | `transformers/vercel.ts` | ✅ | cache_control + image 归一化 |
| 10 | `vertex-gemini` | `transformers/vertex.ts` | ✅ | GCP OAuth + Gemini |
| 11 | `vertex-claude` | `transformers/vertex.ts` | ✅ | GCP OAuth + Claude |

### Phase 9 测试体系
- [x] Vitest 配置 (`pool: 'forks'`, `fileParallelism: false`)
- [x] 90 个测试用例全部通过 (14 个测试文件)
- [x] 单元测试：OpenAI Main / Anthropic Main / OpenAI Provider / 9 个 Provider Transformer
- [x] 集成测试：OpenAI / Anthropic pipeline 端到端
- [x] Mock upstream HTTP server 工具
- [x] 真实 Provider 端到端验证 (OpenRouter + Kimi)
- [x] Layer 3 studio-sim：多项目/多 Session 高强度模拟脚本
  - `tests/simulation/studio-sim.ts`
  - Fast 模式（直写 DB）+ HTTP 模式（完整 proxy 链路）
  - 11 个 Provider / 6 个 Key / 18 个 Session，按工作模式分布时间
  - 用于 Dashboard 数据填充和并发压力验证
- [x] **Live Simulation 实时模拟模式** (2026-05-07)
  - `--live` 持续运行，模拟真实团队 API 使用场景
  - `--duration <min>` 定时停止，`--users <n>` 模拟用户数
  - 3 种用户 Persona：Coder（高频/代码）、ChatUser（中频/对话）、Researcher（低频/深度研究）
  - 每用户独立 session，累积对话历史，符合真实使用模式
  - 每 10s 实时统计输出（含 per-persona 分布）
  - SIGINT / duration 优雅退出，自动重建 stats_aggregates
- [x] **启动时调用 `cleanupOldStats()`** (2026-05-07)
  - `packages/server/src/index.ts` 中 `getDb()` 后调用 `cleanupOldStats()`
  - 90 天旧数据自动清理

### Provider/Key 架构重构
- [x] Provider = 完整上游配置 (name, template, base_url, api_key, models, options)
- [x] Key = 认证令牌绑定到 Provider (id, name, provider, scenario)
- [x] 删除 Router 逻辑 (`proxy/router.ts` 已删除)
- [x] 删除 upstream_key / base_url 死字段
- [x] 旧 config 兼容 (`template` 默认 `'openai'`)

### Provider 增强功能
- [x] `options?: Record<string, any>` 字段 + `extra_headers` 透传
- [x] UI ProviderFormModal Advanced Options collapsible 区域
- [x] Model 自动获取 (`GET /api/providers/:name/models`)
- [x] Model tag input + search dropdown + 刷新按钮
- [x] SQLite `provider_models` 缓存表
- [x] 全局 `PROXY_URL` 配置 (undici ProxyAgent)
- [x] `.env` 加载（E2E 测试从 `.env` 读取 API Key）

### Analysis Dashboard 改造 (2026-05-06)
- [x] Overall 看板：概览卡片 + 趋势图 + Key/Model/效率分布
- [x] Key Detail：用量趋势 + Model 分布 + Pattern 分布 + Request 分页列表
- [x] 预聚合 `stats_aggregates` 表 (hour/day 窗口)
- [x] 时间范围选择器 (1h/6h/24h/7d/30d)
- [x] 30s 自动刷新 + 手动刷新按钮
- [x] 异常检测 (token 暴涨 ≥300% 标记)
- [x] Request 列表可展开完整 request/response JSON
- [x] recharts 图表集成 (AreaChart, BarChart, PieChart)

### 代码质量
- [x] 6 个预存 TypeScript 类型错误全部修复 (`tsc --noEmit` = **0 errors**)
- [x] `saveConfig` 后 `chmod 600`
- [x] undici@6 兼容 Node 20

---

## 未完成 ❌

### 高优先级
| 项目 | 说明 | 代码位置 |
|------|------|----------|
| **Anthropic streaming 转换** | `/v1/chat/completions` + `template=anthropic` 时，Anthropic SSE 未被转成 OpenAI chat.completion.chunk 格式（pass-through） | `packages/server/src/transformers/anthropic.ts:514` |

### 中/低优先级
| 项目 | 说明 |
|------|------|
| **Phase 11: 高级检测器 DET-004~008** | 当前只有 DET-001~003 (full_context / sliding_window / summarization)。高级检测器未规划。 |
| **Phase 5 插件加载机制** | `~/.tokenflow/transformers/` 自定义 transformer 动态加载 |
| **Phase 5 国内平台转换器** | DashScope、MiniMax、智谱 GLM、月之暗面 Kimi |
| **CLI configLoader 环境变量** | CLI 侧 `configLoader` 仍写死路径，server 侧已完成 |
| **CLI processManager 端口读取** | `processManager.ts:57` 有 TODO，port 为 null |
| **成本估算 UI** | `stats_aggregates.estimated_cost` 已预留字段，但无模型单价配置和前端展示 |
| **Session 语义改进** | 当前 session 为 per-request 粒度（因客户端通常不传 `session_id`）。用户决定暂不处理。 |

---

## 已知风险与注意事项

1. **Anthropic streaming**: 特定场景下 stream 格式可能不对（见高优先级待办）。
2. **undici 版本**: 必须使用 undici@6，undici@8 在 Node 20 下会报错 (`webidl.util.markAsUncloneable is not a function`)。
3. **Vertex 依赖**: `google-auth-library` 仅在 Vertex 系列 provider 中使用，需要配置 GCP 认证。
4. ~~**stats_aggregates 清理**: 保留 90 天数据，server 启动时未调用 `cleanupOldStats()`~~ — **已修复** (2026-05-07)。
5. **pnpm build 前置**: `pnpm dev` 前需先 `pnpm build`，否则 `@tokenflow/shared` 的 `dist/` 缺失会导致 module not found。

---

## 换机后快速恢复

```bash
# 1. 克隆并切分支
git checkout feat/typescript

# 2. 安装依赖
pnpm install

# 3. 构建 workspace 包
pnpm build

# 4. 启动开发环境（三个终端）
pnpm dev:server   # localhost:40001
pnpm dev:ui       # localhost:40002
pnpm dev:docs     # localhost:40003

# 5. 验证
pnpm test         # 90 passed
pnpm build        # server + ui + docs
```

### 生成模拟数据用于 Dashboard 调试

```bash
# 快速模式（直写 DB，1000 请求，7 天跨度）
npx tsx tests/simulation/studio-sim.ts --fast --requests 1000 --days 7

# 高并发压力测试（走完整 proxy 链路）
npx tsx tests/simulation/studio-sim.ts --requests 2000 --concurrency 50

# 实时模拟：10 人团队正常 API 使用，持续 30 分钟
npx tsx tests/simulation/studio-sim.ts --live --duration 30 --users 10

# 实时模拟 + 保持 server 运行（配合 UI 查看 Dashboard）
npx tsx tests/simulation/studio-sim.ts --live --duration 60 --users 10 --keep
# 另开终端: pnpm dev:ui

# 生成历史数据后保持 server 运行，配合 UI 查看
npx tsx tests/simulation/studio-sim.ts --keep --fast --requests 500 --days 3
# 另开终端: pnpm dev:ui
```

---

## 下一步建议（按优先级排序）

1. **Anthropic streaming 转换** — 如需覆盖 `/v1/chat/completions` + anthropic provider 的 stream 场景，需实现 SSE 格式转换（Anthropic SSE → OpenAI chat.completion.chunk）。
2. **成本估算** — 配置模型单价表，在 Analysis Dashboard 展示预估费用。
3. **Phase 11 高级检测器** — 如需更多智能分析能力，规划 DET-004~008。
4. **国内平台转换器** — DashScope、MiniMax、智谱 GLM、月之暗面 Kimi 等国内平台支持。
