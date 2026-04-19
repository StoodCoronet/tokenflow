# Feature Comparison & Implementation Plan

**Date**: 2026-04-17
**Status**: Draft

## Feature Comparison: Python vs TypeScript

| # | Feature | Python | TS | Priority |
|---|---------|--------|----|----------|
| **Proxy & Core** | | | | |
| 1 | OpenAI API 代理 | ✅ | ✅ | — |
| 2 | Anthropic API 代理 | ❌ | ✅ | — |
| 3 | 多 Provider 支持 | ❌ | ✅ | — |
| 4 | 智能路由 (token 估算) | ❌ | ✅ | — |
| 5 | Provider 格式转换 | ❌ | ✅ (OpenAI+Anthropic) | — |
| **Key & Session** | | | | |
| 6 | API Key CRUD | ✅ | ✅ | — |
| 7 | Session 管理 | ✅ | ✅ | — |
| **Detectors** | | | | |
| 8 | Full Context (DET-001) | ✅ | ✅ | — |
| 9 | Sliding Window (DET-002) | ✅ | ✅ | — |
| 10 | Summarization (DET-003) | ✅ | ✅ | — |
| 11 | RAG/检索 (DET-004) | ❌ | ❌ | P2 |
| 12 | 层级记忆 (DET-005) | ❌ | ❌ | P2 |
| 13 | 选择性压缩 (DET-006) | ❌ | ❌ | P2 |
| 14 | Function Call 缓存 (DET-007) | ❌ | ❌ | P2 |
| 15 | 自定义规则 (DET-008) | ❌ | ❌ | P3 |
| **UI Pages** | | | | |
| 16 | Dashboard 统计 | ✅ | ✅ | — |
| 17 | Keys 页面 | ✅ | ✅ | — |
| 18 | Sessions 页面 | ✅ | ✅ | — |
| 19 | Analysis 分析页面 | ✅ | ❌ API 有，UI 无 | P0 |
| 20 | Settings 设置页面 | ✅ | ❌ | P1 |
| 21 | Documentation 页面 | ✅ | ❌ → 独立 docs 包 | P1 |
| **CLI** | | | | |
| 22 | tflow start/stop/restart | ❌ | ✅ | — |
| 23 | tflow status | ❌ | ✅ | — |
| 24 | tflow ui | ❌ | ✅ | — |
| 25 | tflow config (TUI) | ❌ | ✅ | — |

---

## Interview Decisions

### 格式转换

- **方向**: 单向 — 国内平台 → OpenAI/Anthropic 统一格式
- **可自定义**: 两层机制 — 简单映射走 config 声明，复杂逻辑走插件文件 (JS/TS)
- **内置转换器**: DashScope、MiniMax、智谱 (GLM)、月之暗面 (Kimi)
- **DeepSeek**: 走 OpenAI 兼容，不单独写 transformer
- **实现策略**: 先搭转换框架，内置转换器用框架实现

### UI 风格

- **参考**: Anthropic Console 风格 — 干净克制、卡片式布局、暖灰色调、小圆角
- **主题**: 亮/暗切换，用 Tailwind `dark:` 前缀，同一套组件代码，一起做
- **图表**: 继续用 recharts（简洁折线/面积图，接近 Anthropic 风格）
- **导航**: 讨论 Phase 1 完成后再决定是否改侧边栏
- **TUI**: 仿照 Claude Code 风格，不需要 light/dark 切换

### UI 页面

- **Analysis**: 复刻 Python 版 — session 粒度的检测报告、效率评分、建议
- **Settings**: 完整配置管理 — Provider、检测器开关/阈值、代理端口、日志级别
- **Settings 存储**: 读写 config.json5，UI 和 CLI 共享状态
- **Documentation**: 独立 `packages/docs/` 包，包含快速开始、功能介绍、API 参考、配置参考，含 GUI 和 TUI 介绍

### 节奏

- 分阶段执行，每阶段不要太多内容，方便 debug
- 风格改造、新页面、对接验证按阶段拆开

---

## Implementation Plan

### Phase 1 — 前后端对接验证 (Target: 2026-04-17) ✅ 完成

不改动风格，纯验证现有功能。

- [x] 修复 CLI stop.ts/ui.ts 内容写反
- [x] 验证配置文件路径和端口（已正确，无需修改）
- [x] 验证 `/api/dashboard` → Dashboard 页面数据对接
- [x] 验证 `/api/keys` → Keys 页面数据对接
- [x] 验证 `/api/sessions` → Sessions 页面数据对接
- [x] 修复 navbar 导航问题 (loading/error state)
- [x] 验证代理 `/v1/*` 转发链路

### Phase 2 — Anthropic Console 风格改造 (Target: 2026-04-18) ✅ 代码完成，待验证

纯视觉层改造，不改功能。

- [x] Tailwind dark mode 配置 + 主题切换按钮
- [x] 全局配色调整为 Anthropic 暖灰色调
- [x] StatCard / Table / Navbar 组件风格对齐
- [x] 亮色 + 暗色两套颜色值
- [x] 修复白屏 bug (loading 初始值)

### Phase 3 — 补齐 Analysis 页面 (Target: 2026-04-19)

复刻 Python 版功能。

- [ ] Session 列表点击进入详情
- [ ] 检测报告展示 (模式列表、效率评分、建议)
- [ ] Recharts 简单图表 (token 趋势)

### Phase 4 — Settings 页面 (Target: 2026-04-20)

- [ ] config.json5 读写 API
- [ ] Provider 配置编辑
- [ ] 检测器开关/阈值调整
- [ ] 基础设置 (端口、日志级别)

### Phase 5 — 格式转换框架 (Target: 2026-04-21 ~ 2026-04-22)

- [ ] Transformer 抽象层 (声明式映射 + 插件文件)
- [ ] 内置: DashScope → OpenAI
- [ ] 内置: MiniMax → OpenAI
- [ ] 内置: 智谱 (GLM) → OpenAI
- [ ] 内置: 月之暗面 (Kimi) → OpenAI
- [ ] DeepSeek → 走 OpenAI 兼容配置
- [ ] 框架文档和示例插件

### Phase 6 — Documentation 独立包 (Target: 2026-04-23+)

- [ ] `packages/docs/` 包初始化
- [ ] 快速开始指南 (安装、配置、启动)
- [ ] 功能介绍 (代理、检测器、格式转换、Dashboard)
- [ ] API 参考 (REST 端点)
- [ ] 配置参考 (config.json5 字段)
- [ ] GUI 使用 + TUI 使用
- [ ] UI 中添加 Documentation 入口链接

### Phase 7 — 高级检测器 (Future)

- [ ] DET-004 RAG/检索检测
- [ ] DET-005 层级记忆检测
- [ ] DET-006 选择性压缩检测
- [ ] DET-007 Function Call 缓存检测
- [ ] DET-008 自定义规则检测

---

## Detailed Execution Plan

> 上面的 Phase 定义了方向，下面是每个 Phase 的具体执行步骤、涉及的文件、和验证方式。
> 每个 Phase 完成后打 tag，方便回滚。

### 代码现状速查

**已知 Bug:**
- `packages/cli/src/commands/stop.ts` 和 `ui.ts` 内容写反了（stop.ts 里是 openUI，ui.ts 里是 stopServer）
- `packages/server/src/configLoader.ts` 文件名是 `tokenflow.json`，plan 里定的是 `config.json5`，和 shared/constants.ts 不一致
- server 默认端口 3000，shared 常量是 40001

**技术栈:**
- UI: React 19 + Vite 6 + Tailwind 3.4 + recharts 2.15（已装但未用）+ axios
- Server: Fastify + better-sqlite3 + tiktoken + json5
- CLI: commander + inquirer + chalk + esbuild
- 所有组件内联在 App.tsx，无独立组件文件

---

### Phase 1 — 前后端对接验证

**目标:** 修复 bug，确保前后端能完整通信，不改动 UI 风格。

#### 1.1 修复 CLI 命令文件写反

```
文件: packages/cli/src/commands/stop.ts
      packages/cli/src/commands/ui.ts
问题: stop.ts 导出 openUI()，ui.ts 导出 stopServer()，内容互换了
操作: 交换两个文件的内容（或修正导出函数名和实现）
验证: tflow start → tflow stop 能正常停止；tflow ui 能打开浏览器
```

#### 1.2 统一配置文件路径

```
文件: packages/server/src/configLoader.ts
问题: 写死 tokenflow.json，应改为读 shared/constants.ts 的 DEFAULT_CONFIG_PATH
操作: configLoader 使用 DEFAULT_CONFIG_PATH (即 ~/.tokenflow/config.json5)
同步: 确认 cli/utils/configLoader.ts 和 server/configLoader.ts 用同一个路径
验证: 手动创建 ~/.tokenflow/config.json5，tflow config 能读写，server 启动能读取
```

#### 1.3 统一默认端口

```
文件: packages/server/src/configLoader.ts
问题: 默认端口 3000，应使用 shared 的 DEFAULT_PORT (40001)
操作: server 的 getDefaultConfig 使用 shared 常量
验证: tflow start 显示 port 40001，curl http://localhost:40001/health 返回 200
```

#### 1.4 验证 API 端点

```
逐个验证:
  GET  /health             → { status, name, version }
  GET  /api/dashboard      → { total_requests, total_tokens, avg_efficiency, recent_logs, sessions }
  GET  /api/keys           → ApiKey[]
  POST /api/keys           → 创建成功
  DELETE /api/keys/:id     → 删除成功
  GET  /api/sessions       → Session[]
  GET  /api/sessions/:id   → Session + request_logs
  GET  /api/analysis/:sid  → AnalysisResult
  POST /v1/chat/completions → 代理转发到上游

验证方式:
  1. pnpm build
  2. tflow start
  3. 逐个 curl 端点
  4. UI 页面切换检查 network 请求
```

#### 1.5 修复 UI navbar 导航问题

```
文件: packages/ui/src/App.tsx
问题: Tab 切换逻辑可能存在状态残留（切换 tab 时 data 未清空）
操作:
  - 切换 tab 前先 setData(null)，避免显示旧数据
  - 添加 error state 处理 API 失败
  - 确保 Loading 状态正确显示
验证: 快速切换 tab，确认数据不会串页
```

#### 1.6 验证 Vite 代理配置

```
文件: packages/ui/vite.config.ts
当前: proxy /api → localhost:40001, /v1 → localhost:40001
验证: pnpm dev 启动 UI，检查 dev server 的代理是否正常转发
注意: 生产环境需要 server 配置 static serving 或反向代理
```

#### Phase 1 完成标志

```bash
tflow start           # 启动成功，端口 40001
curl localhost:40001/health   # 返回 200
tflow status          # 显示 running
tflow ui              # 打开浏览器
# UI 中 Dashboard/Keys/Sessions 三个页面数据正常
# 通过代理发送测试请求，日志出现在 Dashboard
tflow stop            # 正常停止
```

---

### Phase 2 — Anthropic Console 风格改造

**目标:** 纯视觉改造，不改功能逻辑。

#### 2.1 Tailwind dark mode 配置

```
文件: packages/ui/tailwind.config.js
操作:
  - darkMode: 'class'（通过 html class 切换）
  - 定义 anthropic 风格的颜色 token：
    亮色: bg=#FAFAF8, card=#FFFFFF, text=#1A1A1A, muted=#8B8680, border=#E8E6E3, accent=#D97757
    暗色: bg=#1A1A1A, card=#242424, text=#E8E6E3, muted=#8B8680, border=#3A3A3A, accent=#E8956A
  - 在 theme.extend.colors 中定义 semantic tokens
```

#### 2.2 主题切换组件

```
新文件: packages/ui/src/components/ThemeToggle.tsx
操作:
  - Sun/Moon 图标按钮
  - 切换 <html class="dark">
  - localStorage 持久化偏好
  - 默认跟随系统 prefers-color-scheme
```

#### 2.3 全局样式调整

```
文件: packages/ui/src/index.css
操作:
  - body 字体: Inter 或 system-ui（Anthropic 风格）
  - 去掉固定 background，用 Tailwind dark: 切换
```

#### 2.4 组件风格对齐

```
文件: packages/ui/src/App.tsx（内联组件逐个改造）
改造清单:
  - Navbar: 去掉 bg-white border-b，改为 bg-white dark:bg-[#242424] 底部 1px border
  - StatCard: 小圆角 rounded-lg，柔和阴影，暖灰色文字
  - Table: 去掉粗边框，改为细线分割，hover 行高亮
  - Tab 按钮: 从黑底白字改为 underline + 激活色 accent
所有 class 加 dark: 变体
```

#### Phase 2 完成标志

```
- UI 在亮色下看起来像 Anthropic Console
- 点击主题切换按钮能正常切暗色
- 刷新页面记住主题偏好
- 三个页面功能不受影响
```

---

### Phase 3 — 补齐 Analysis 页面

**目标:** 复刻 Python 版的 session 粒度检测报告。

#### 3.1 Session 详情路由

```
文件: packages/ui/src/App.tsx
操作:
  - 扩展 Tab 类型，增加 'analysis' tab
  - Sessions 表格每行增加 "View Analysis" 按钮
  - 点击后切换到 analysis tab，传入 session_id
  - 或者改为路由: 用 useState 管理 currentPage/pageParams
```

#### 3.2 Analysis 页面组件

```
新文件: packages/ui/src/components/AnalysisView.tsx
内容:
  - Session 概览: session_id, 时间范围, 消息数, token 统计
  - 检测报告:
    - 检测到的上下文模式 (detected_pattern)
    - 效率评分 + Grade (A/B/C/D) 用颜色卡片展示
    - 每个检测器的详细结果
  - 建议: warnings[] 和 suggestions[] 列表
```

#### 3.3 Token 趋势图表

```
文件: packages/ui/src/components/AnalysisView.tsx（或独立组件）
使用 recharts:
  - AreaChart 展示 session 内 token 使用趋势
  - X轴: request 序号, Y轴: token 数
  - prompt_tokens vs completion_tokens 双线
  - Anthropic 风格: 简洁线条，无网格，浅色填充
```

#### 3.4 API 对接

```
已有 API:
  GET /api/analysis/:session_id  → { detected_pattern, efficiency_score, warnings, suggestions }
  GET /api/sessions/:id          → session detail + request_logs

已定义的 api.ts:
  fetchAnalysis(sessionId) 和 fetchSession(id) 已存在但未使用

操作: 在 AnalysisView 中调用这两个 API，渲染数据
```

#### Phase 3 完成标志

```
- Sessions 页面能看到 session 列表
- 点击某 session 进入 Analysis 详情
- 显示模式检测、效率评分、建议
- Token 趋势图表正常渲染
```

---

### Phase 4 — Settings 页面

**目标:** UI 管理 config.json5，与 CLI 共享状态。

#### 4.1 后端配置读写 API

```
文件: packages/server/src/routes/index.ts（新增路由）
新增端点:
  GET  /api/config        → 返回当前配置（脱敏 api_key）
  PUT  /api/config        → 更新配置并写入 config.json5
  GET  /api/config/providers  → Provider 列表
  PUT  /api/config/providers  → 更新 Provider 列表
  GET  /api/config/detectors  → 检测器状态
  PUT  /api/config/detectors  → 更新检测器开关/阈值

安全: 返回配置时 api_key 脱敏（只显示前4位 + ***）
```

#### 4.2 Settings 页面组件

```
新文件: packages/ui/src/components/SettingsView.tsx
分区:
  - Providers: 列表 + 添加/编辑/删除，包含 name/base_url/api_key/models
  - Smart Router: 开关 + 默认路由 + longContext 配置
  - Detectors: 每个 detector 的 enabled 开关
  - General: 端口配置、日志级别
  - 保存按钮 → PUT /api/config
```

#### 4.3 前端 API 层

```
文件: packages/ui/src/api.ts
新增:
  fetchConfig()            → GET /api/config
  updateConfig(data)       → PUT /api/config
  fetchProviders()         → GET /api/config/providers
  updateProviders(data)    → PUT /api/config/providers
  fetchDetectors()         → GET /api/config/detectors
  updateDetectors(data)    → PUT /api/config/detectors
```

#### Phase 4 完成标志

```
- Settings 页面能读取当前 config.json5 内容
- 修改 Provider / Detector / Router 后能保存
- config.json5 文件内容同步更新
- tflow config 能看到 UI 修改后的值
```

---

### Phase 5 — 格式转换框架

**目标:** 建立插件式 transformer 框架，内置 4 个国内平台转换器。

#### 5.1 Transformer 抽象层重构

```
当前: packages/server/src/transformers/ 已有 base.ts + openai.ts + anthropic.ts
重构 base.ts:
  interface Transformer {
    providerName: string
    detect(body: unknown): boolean
    transformRequest(body: unknown): OpenAIFormat
    transformResponse(response: unknown): OpenAIFormat
  }

新增声明式映射支持:
  新文件: packages/server/src/transformers/declarative.ts
  - 读取 config 中声明的字段映射规则
  - 自动生成 transformer
  - 示例: { fieldMaps: { "input.text": "messages[0].content" } }
```

#### 5.2 插件加载机制

```
新文件: packages/server/src/transformers/loader.ts
功能:
  - 扫描 ~/.tokenflow/transformers/ 目录
  - 动态 import .js/.ts 文件作为自定义 transformer
  - 注册到 transformer registry
  - config.json5 中 Transformers.custom[] 配置
```

#### 5.3 内置转换器

```
新文件:
  packages/server/src/transformers/dashscope.ts   # 通义千问 → OpenAI
  packages/server/src/transformers/minimax.ts     # MiniMax → OpenAI
  packages/server/src/transformers/zhipu.ts       # 智谱 GLM → OpenAI
  packages/server/src/transformers/moonshot.ts    # 月之暗面 Kimi → OpenAI

每个转换器实现 Transformer 接口:
  - detect(): 根据请求体特征判断是否匹配
  - transformRequest(): 转为 OpenAI 格式
  - transformResponse(): 不需要（上游已返回 OpenAI 格式）

DeepSeek: 不写转换器，在 Provider 配置中标注兼容 OpenAI
```

#### 5.4 转换器注册和自动选择

```
修改: packages/server/src/transformers/index.ts
功能:
  - registry: Map<string, Transformer>
  - registerBuiltins(): 注册所有内置 + 插件 transformer
  - detectTransformer(body): 遍历 registry 找匹配的 transformer
  - 代理 handler 中调用 detectTransformer 自动转换
```

#### Phase 5 完成标志

```
- 发送 DashScope 格式请求 → 自动转为 OpenAI → 转发到上游
- 发送 MiniMax/GLM/Kimi 格式请求 → 同上
- 在 ~/.tokenflow/transformers/ 放一个自定义 .js 文件 → 被自动加载
- 不匹配任何 transformer 的请求 → 走 OpenAI 默认（兼容）
```

---

### Phase 6 — Documentation 独立包

**目标:** 独立的产品文档包，可通过 UI 链接访问。

#### 6.1 包初始化

```
新目录: packages/docs/
结构:
  packages/docs/
  ├── package.json          # @tokenflow/docs
  ├── vite.config.ts        # Vite SSG 或纯静态站点
  ├── src/
  │   ├── main.tsx
  │   ├── App.tsx           # 文档站布局 + 路由
  │   ├── pages/
  │   │   ├── QuickStart.tsx
  │   │   ├── Features.tsx
  │   │   ├── ApiReference.tsx
  │   │   └── ConfigReference.tsx
  │   └── components/
  │       ├── Layout.tsx
  │       └── Sidebar.tsx
  └── index.html

技术: React + Vite（和 UI 包技术栈一致）
端口: 独立端口或作为 server 的 /docs 路径
```

#### 6.2 文档内容

```
QuickStart:
  - 安装 (pnpm install, npm install -g)
  - 首次配置 (tflow config)
  - 启动 (tflow start, tflow ui)
  - 第一个代理请求

Features:
  - 代理模式（透明代理 vs 格式转换）
  - 上下文检测器
  - 智能路由
  - Dashboard 看板
  - CLI 命令参考

ApiReference:
  - 所有 /api/* 端点的请求/响应格式

ConfigReference:
  - config.json5 每个字段的说明和默认值

GUI 使用:
  - 各页面的操作说明

TUI 使用:
  - tflow 各命令详细说明
  - config TUI 操作流程
```

#### 6.3 UI 入口链接

```
文件: packages/ui/src/App.tsx
操作: Navbar 增加 "Docs" 链接，打开 docs 包的地址
```

#### Phase 6 完成标志

```
- pnpm --filter @tokenflow/docs dev 能启动文档站
- 4 个页面内容完整
- UI 的 Docs 链接能跳转过去
```

---

### Phase 7 — 高级检测器 (Future, 不在本轮执行)

略，待 Phase 1-6 全部完成后重新规划。
