# Token Flow — 项目状态快照

**日期**: 2026-05-06
**分支**: `feat/typescript`
**提交**: `0bf4f7b` feat: add studio-sim script for multi-project data simulation
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

---

## 已完成 ✅

### Phase 1-6 基础架构
- [x] 前后端对接验证
- [x] Anthropic Console 风格 UI 改造
- [x] Sessions 重设计 + Keys CRUD
- [x] Settings 页面
- [x] Documentation 独立包 (`packages/docs/`)

### Phase 7 CCR 调研
- [x] CCR 源码调研与提炼
- [x] Transformer 4 向接口设计

### Phase 8 TUI
- [x] 全屏 TUI (ink)
- [x] 键盘导航（← → ESC）
- [x] Providers / Ports / Router / Detectors / General 页面

### Phase 8.5 Transformer 两层架构
- [x] MainTransformer (按 endpoint URL) + ProviderTransformer (按 provider template)
- [x] 11 个 provider transformer 全部就位
- [x] `/v1/chat/completions` + `/v1/messages` 双端点支持

| Template | 文件 | 状态 |
|----------|------|------|
| `openai` | `transformers/openai.ts` | ✅ |
| `anthropic` | `transformers/anthropic.ts` | ✅ (stream 为 pass-through，见待办) |
| `openai-responses` | `transformers/openai-responses.ts` | ✅ |
| `gemini` | `transformers/gemini.ts` | ✅ |
| `deepseek` | `transformers/deepseek.ts` | ✅ |
| `openrouter` | `transformers/openrouter.ts` | ✅ |
| `groq` | `transformers/groq.ts` | ✅ |
| `cerebras` | `transformers/cerebras.ts` | ✅ |
| `vercel` | `transformers/vercel.ts` | ✅ |
| `vertex-gemini` | `transformers/vertex.ts` | ✅ |
| `vertex-claude` | `transformers/vertex.ts` | ✅ |

### Phase 9 测试体系
- [x] Vitest 配置 (`pool: 'forks'`, `fileParallelism: false`)
- [x] 90 个测试用例全部通过 (14 个测试文件)
- [x] Mock upstream HTTP server 工具
- [x] OpenAI / Anthropic pipeline 集成测试
- [x] 真实 Provider 端到端验证 (OpenRouter + Kimi)
- [x] Layer 3 studio-sim：多项目/多 Session 高强度模拟脚本 (`tests/simulation/studio-sim.ts`)
  - Fast 模式（直写 DB）+ HTTP 模式（完整 proxy 链路）
  - 4 个 Provider / 6 个 Key / 18 个 Session，按工作模式分布时间

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
| **Anthropic streaming 转换** | `transformResponseOut` 对 stream 是 pass-through。当客户端走 `/v1/chat/completions` + `template=anthropic` 时，Anthropic SSE 不会被转成 OpenAI chat.completion chunk 格式。`/v1/messages` 不受影响。 | `packages/server/src/transformers/anthropic.ts:514` |

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

1. **Anthropic streaming**: 如上所述，特定场景下 stream 格式可能不对。
2. **undici 版本**: 必须使用 undici@6，undici@8 在 Node 20 下会报错 (`webidl.util.markAsUncloneable is not a function`)。
3. **Vertex 依赖**: `google-auth-library` 仅在 Vertex 系列 provider 中使用，需要配置 GCP 认证。
4. **stats_aggregates 清理**: 保留 90 天数据，server 启动时自动清理旧数据（已实现在 `cleanupOldStats()`，但启动时未调用——见下一步建议）。

---

## 换机后快速恢复

```bash
# 1. 克隆并切分支
git checkout feat/typescript

# 2. 安装依赖
pnpm install

# 3. 启动开发环境（三个终端）
pnpm dev:server   # localhost:40001
pnpm dev:ui       # localhost:40002
pnpm dev:docs     # localhost:40003

# 4. 验证
pnpm test         # 90 passed
pnpm build        # server + ui + docs
```

---

## 下一步建议（按优先级排序）

1. **启动时调用 `cleanupOldStats()`** — `packages/server/src/index.ts` 中 `getDb()` 后加一行 `cleanupOldStats()`，确保 90 天旧数据自动清理。
2. **Anthropic streaming 转换** — 如需覆盖 `/v1/chat/completions` + anthropic provider 的 stream 场景，需实现 SSE 格式转换（Anthropic SSE → OpenAI chat.completion.chunk）。
3. **Phase 11 高级检测器** — 如需更多智能分析能力，规划 DET-004~008。
4. **成本估算** — 配置模型单价表，在 Analysis Dashboard 展示预估费用。
