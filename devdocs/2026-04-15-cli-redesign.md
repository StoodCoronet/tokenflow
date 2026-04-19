# Token Flow CLI 重设计 — 基于 claude-code-router 参考

**日期**: 2026-04-15
**状态**: 规划中

## 背景

参考 [claude-code-router](https://github.com/musistudio/claude-code-router) 的使用体验，
将 Token Flow 从"前后端分离手动启动"改造为统一的 CLI 工具。

## CCR 的核心交互模式

> 待分析 `reference/claude-code-router` 源码后补充

- `ccr start` — 启动代理服务
- `ccr ui` — 打开 Web 管理界面
- `ccr model` — TUI 交互式配置
- `ccr preset` — 预设管理
- `ccr activate` — 环境变量注入

## Token Flow 目标形态

### CLI 命令（暂定）

```
tokenflow start          # 启动后端代理服务
tokenflow ui             # 启动 Web UI（自动打开浏览器）
tokenflow config         # TUI 交互式配置
tokenflow status         # 查看服务状态
tokenflow key            # 管理 API Keys（TUI）
tokenflow report         # 生成效率报告
```

### 技术方案

> 待 CCR 分析后细化

## 分析任务

- [ ] 分析 CCR 项目结构、CLI 入口、配置管理
- [ ] 分析 CCR 的 UI 模式（Web UI 启动方式）
- [ ] 分析 CCR 的 TUI 交互（`ccr model` 实现）
- [ ] 制定 Token Flow CLI 技术选型（Python CLI 框架、TUI 库）
- [ ] 设计配置文件格式和目录结构
- [ ] 输出最终执行计划

## 执行任务

> 待分析完成后拆分
