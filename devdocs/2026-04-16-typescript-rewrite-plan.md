# Token Flow — TypeScript 全栈重写规划

**日期**: 2026-04-16
**状态**: 规划完成，待实施

## Context

Token Flow 当前是 Python (FastAPI) + React 实现，功能包括 LLM 流量代理、上下文模式检测、效率评分。
参考 [claude-code-router](https://github.com/musistudio/claude-code-router) 的 CLI 交互设计，决定全栈迁移到 TypeScript，
统一技术栈并提供 `tokenflow` / `tflow` CLI 工具。

## Git 分支策略

1. 从当前 master 创建 `backup/python` 分支，保留所有 Python 代码
2. 从 master 创建 `feat/typescript` 分支，在此分支上开发 TS 版本
3. 删除 backend/ 目录，新建 monorepo 结构

## 技术选型

| 组件 | 选型 | 说明 |
|------|------|------|
| 运行时 | Node.js >= 20 | 和 CCR 一致 |
| 包管理 | pnpm workspace | monorepo 管理 |
| 语言 | TypeScript | 全栈统一 |
| Server | Fastify | 和 CCR 一致，性能好 |
| CLI | esbuild 编译 + commander/inquirer | 和 CCR 一致 |
| UI | React + Vite + Tailwind + Radix UI | 和 CCR 一致 |
| 数据库 | SQLite (better-sqlite3) | 零配置，和现有版一致 |
| 配置 | JSON5 (~/.tokenflow/config.json5) | 支持注释，和 CCR 一致 |
| Token 计数 | tiktoken (js 版) | 精确计数 |

## Monorepo 结构

```
token_flow/
├── packages/
│   ├── cli/              # @tokenflow/cli
│   │   ├── src/
│   │   │   ├── cli.ts           # 入口，命令分发
│   │   │   ├── commands/        # 各子命令
│   │   │   │   ├── start.ts
│   │   │   │   ├── stop.ts
│   │   │   │   ├── restart.ts
│   │   │   │   ├── status.ts
│   │   │   │   ├── ui.ts
│   │   │   │   ├── config.ts
│   │   │   │   └── tldr.ts
│   │   │   └── utils/
│   │   │       ├── processManager.ts  # PID 管理、进程启停
│   │   │       ├── configLoader.ts    # 配置文件读写
│   │   │       └── browser.ts         # 跨平台打开浏览器
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── server/           # @tokenflow/server
│   │   ├── src/
│   │   │   ├── index.ts           # Fastify 入口
│   │   │   ├── proxy/             # 代理转发
│   │   │   │   ├── handler.ts     # 请求拦截和转发
│   │   │   │   ├── stream.ts      # 流式响应处理
│   │   │   │   └── router.ts      # 智能路由（可开关）
│   │   │   ├── transformers/      # API 格式适配器（插件式）
│   │   │   │   ├── openai.ts
│   │   │   │   ├── anthropic.ts
│   │   │   │   └── base.ts        # Transformer 接口
│   │   │   ├── detectors/         # 上下文模式检测器
│   │   │   │   ├── base.ts        # 检测器基类
│   │   │   │   ├── fullContext.ts
│   │   │   │   ├── slidingWindow.ts
│   │   │   │   └── summarization.ts
│   │   │   ├── routes/            # API 路由
│   │   │   │   ├── apiKeys.ts
│   │   │   │   ├── sessions.ts
│   │   │   │   ├── dashboard.ts
│   │   │   │   └── analysis.ts
│   │   │   ├── db/                # 数据库层
│   │   │   │   ├── schema.ts      # 表定义
│   │   │   │   ├── migrations.ts
│   │   │   │   └── repository.ts
│   │   │   └── services/          # 业务逻辑
│   │   │       ├── analyzer.ts
│   │   │       ├── scorer.ts
│   │   │       └── report.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ui/               # @tokenflow/ui
│   │   ├── src/
│   │   │   ├── components/   # React 组件（迁移现有前端）
│   │   │   ├── App.jsx
│   │   │   └── api.js
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── package.json
│   │   └── tailwind.config.js
│   │
│   └── shared/           # @tokenflow/shared
│       ├── src/
│       │   ├── types.ts       # 共享类型定义
│       │   ├── constants.ts   # 常量
│       │   └── utils.ts       # 工具函数
│       ├── package.json
│       └── tsconfig.json
│
├── pnpm-workspace.yaml
├── package.json              # 根 package.json
├── tsconfig.base.json        # 共享 TS 配置
├── docs/                     # 文档
├── docker-compose.yml
├── start.sh
└── .gitignore
```

## CLI 命令设计

### 命令列表

| 命令 | 说明 | V1 优先级 |
|------|------|-----------|
| `tflow start [--port 40001]` | 启动 server（后台 daemon） | P0 |
| `tflow stop` | 停止 server | P0 |
| `tflow restart` | 重启 server | P0 |
| `tflow status` | 显示 PID、端口、运行状态 | P0 |
| `tflow ui` | 启动 UI 并打开浏览器 | P0 |
| `tflow config` | TUI 交互式配置 | P0 |
| `tflow --tldr` | 常用命令速查 | P0 |
| `tflow --help` | 帮助信息（提示 --tldr） | P0 |

### tldr 输出示例

```
Token Flow — 常用命令速查

  tflow start            启动代理服务
  tflow stop             停止服务
  tflow ui               打开 Web 看板
  tflow status           查看服务状态
  tflow config           交互式配置 API Key

  代理地址: http://localhost:40001/v1
  看板地址: http://localhost:40002

  用法示例:
  1. tflow start && tflow ui     # 启动服务并打开看板
  2. tflow config                # 添加你的第一个 API Key
  3. 将 openai base_url 改为 http://localhost:40001/v1
```

### config TUI 内容

- 添加/编辑/删除 API Key（provider + key + base_url + 场景标签）
- 智能路由开关
- 端口配置
- 检测器启用/禁用
- 日志级别

## 进程管理

参考 CCR 实现：
- PID 文件: `~/.tokenflow/server.pid`
- 启动: `spawn('node', [serverPath], { detached: true, stdio: 'ignore' })`，写 PID
- 停止: 读取 PID → `process.kill(pid)`
- 状态: 检查 PID 文件 + 进程存活检测 (`kill(pid, 0)`)
- `tflow ui` 和其他命令在 server 未运行时自动启动 server

## 智能路由设计

**可开关功能**，配置项 `Router.enabled: boolean`

路由规则（参考 CCR，简化版）：

```json5
{
  "Router": {
    "enabled": true,
    "default": "openai,gpt-4o",
    "longContext": {
      "provider": "anthropic",
      "model": "claude-sonnet-4-6",
      "threshold": 60000  // token 数阈值
    }
  }
}
```

触发逻辑：请求到达 → 计算 token 数 → 匹配路由规则 → 转发到对应 provider

## 配置文件

路径: `~/.tokenflow/config.json5`

```json5
{
  // 服务端口
  "PORT": 40001,
  "UI_PORT": 40002,

  // API 认证
  "APIKEY": "your-api-key",

  // 数据库
  "DATABASE": "~/.tokenflow/tokenflow.db",

  // Provider 列表
  "Providers": [
    {
      "name": "openai",
      "api_base_url": "https://api.openai.com",
      "api_key": "sk-xxx",
      "models": ["gpt-4o", "gpt-4o-mini"]
    },
    {
      "name": "anthropic",
      "api_base_url": "https://api.anthropic.com",
      "api_key": "sk-ant-xxx",
      "models": ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"]
    }
  ],

  // 智能路由
  "Router": {
    "enabled": false,
    "default": "openai,gpt-4o",
    "longContext": {
      "provider": "anthropic",
      "model": "claude-sonnet-4-6",
      "threshold": 60000
    }
  },

  // 检测器
  "Detectors": {
    "fullContext": { "enabled": true },
    "slidingWindow": { "enabled": true },
    "summarization": { "enabled": true }
  },

  // 日志
  "LOG_LEVEL": "info"
}
```

## 开发工作流

```bash
# 安装依赖
pnpm install

# 开发模式（带热更新）
pnpm dev          # 并行启动 server (tsx watch) + UI (vite dev)

# 构建
pnpm build        # 编译所有包

# 本地测试 CLI
pnpm --filter @tokenflow/cli dev -- start    # 直接用 tsx 运行
# 或者
node packages/cli/dist/cli.js start

# 全局安装测试
pnpm build && npm install -g .
tflow start
```

## API 格式适配器（插件式）

```typescript
// packages/server/src/transformers/base.ts
interface Transformer {
  providerName: string
  transformRequest(req: IncomingRequest): ProviderRequest
  transformResponse(res: ProviderResponse): StandardResponse
  detect(body: unknown): boolean  // 自动检测请求格式
}
```

每个 provider 一个 transformer 文件，自动根据请求格式匹配。

## 实施步骤

### Phase 1: 骨架搭建
1. 创建 monorepo 结构（pnpm-workspace.yaml, package.json）
2. shared 包：类型定义、常量
3. cli 包骨架：命令解析、帮助信息、tldr

### Phase 2: Server 核心
4. Fastify 入口 + 健康检查
5. SQLite 数据库层（表定义、CRUD）
6. 代理转发（OpenAI 格式先做）
7. 流式响应处理

### Phase 3: CLI 命令
8. 进程管理（start/stop/restart/status）
9. ui 命令（启动 UI + 打开浏览器）
10. config TUI（API Key 管理）

### Phase 4: 分析功能
11. 检测器迁移（Full Context → Sliding Window → Summarization）
12. 效率评分和节省计算
13. Dashboard API

### Phase 5: 高级功能
14. 智能路由
15. API 格式适配器（Anthropic 等）
16. 报告生成

## 验证方式

每个 Phase 完成后的验证：
- Phase 1: `pnpm build` 编译通过，`tflow --help` 输出正确
- Phase 2: `tflow start` 启动 server，`curl http://localhost:40001/health` 返回 200
- Phase 3: `tflow ui` 打开浏览器看板，`tflow status` 显示正确
- Phase 4: 发送测试请求，检测器输出分析结果
- Phase 5: 配置多个 provider，路由正确切换
