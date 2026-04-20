export default function TuiGuide() {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-tf-text">Terminal UI（TUI）使用指南</h2>

      <p className="text-tf-muted leading-relaxed">
        TUI 是 Token Flow 的全屏终端交互界面，无需浏览器即可查看和修改所有配置。
        通过 <code>tflow config</code> 命令启动。
      </p>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">启动方式</h3>
        <pre><code>{`# 开发模式（推荐）
pnpm --filter @tokenflow/cli tui

# 构建后直接使用
tflow config`}</code></pre>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">界面布局</h3>
        <p className="text-tf-muted leading-relaxed">
          TUI 分为三个区域：顶部标题栏、左侧侧边栏（菜单导航）、右侧内容区（配置详情）。
          所有操作通过键盘完成，无需鼠标。
        </p>
        <pre><code>{` Token Flow Config────────────────────────────────────────
┌──────────────┐  Providers: 2
│   Overview   │  Server Port: 40001
│ › Providers  │  UI Port: 40002
│   Ports      │  Router: OFF
│   Router     │  Log Level: info
│   Detectors  │
│   General    │  ── openai ──
│   Config     │  Base URL: https://api.openai.com
│              │  API Key: sk-xxxx***
│              │  Models: gpt-4o, gpt-4o-mini
│              │
│  q quit      │  ↑↓ select │ → edit/add │ ← back
└──────────────┘
 ↑↓ navigate │ → enter │ q quit ────────────────────────`}</code></pre>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">全局快捷键</h3>
        <div className="border border-tf-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-tf-border/20 text-tf-text">
              <tr>
                <th className="text-left px-4 py-2 font-medium">按键</th>
                <th className="text-left px-4 py-2 font-medium">作用</th>
                <th className="text-left px-4 py-2 font-medium">场景</th>
              </tr>
            </thead>
            <tbody className="text-tf-muted">
              <tr className="border-t border-tf-border/50"><td className="px-4 py-2 font-mono">↑ ↓</td><td className="px-4 py-2">切换菜单项 / 切换字段</td><td className="px-4 py-2">侧边栏 / 页面内</td></tr>
              <tr className="border-t border-tf-border/50"><td className="px-4 py-2 font-mono">→ / Enter</td><td className="px-4 py-2">进入当前页面（从预览切换到编辑模式）</td><td className="px-4 py-2">侧边栏选中时</td></tr>
              <tr className="border-t border-tf-border/50"><td className="px-4 py-2 font-mono">←</td><td className="px-4 py-2">返回侧边栏（从编辑模式切回预览）</td><td className="px-4 py-2">页面内</td></tr>
              <tr className="border-t border-tf-border/50"><td className="px-4 py-2 font-mono">w</td><td className="px-4 py-2">保存当前页面修改</td><td className="px-4 py-2">Provider Edit / Ports / Router / General</td></tr>
              <tr className="border-t border-tf-border/50"><td className="px-4 py-2 font-mono">q</td><td className="px-4 py-2">退出 TUI</td><td className="px-4 py-2">侧边栏模式</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">实时预览模式</h3>
        <p className="text-tf-muted leading-relaxed">
          在侧边栏用 ↑↓ 切换菜单时，右侧内容区会<strong>实时显示</strong>对应页面的内容，但此时不响应页面内部的编辑操作。
          这是一种「预览」状态，方便快速浏览各页配置。按 <code>→</code> 或 <code>Enter</code> 进入编辑模式后，才能修改字段。
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">页面详解</h3>

        <div className="space-y-4 mt-4">
          <div className="border border-tf-border rounded-lg p-4 bg-tf-card">
            <h4 className="text-sm font-semibold text-tf-text mb-1">Overview — 配置概览</h4>
            <p className="text-xs text-tf-muted">
              只读页面，展示当前配置的快照：Provider 数量、Server Port、UI Port、Router 开关状态、Log Level。
              适合快速确认系统当前配置。
            </p>
          </div>

          <div className="border border-tf-border rounded-lg p-4 bg-tf-card">
            <h4 className="text-sm font-semibold text-tf-text mb-1">Providers — 上游 Provider 管理</h4>
            <p className="text-xs text-tf-muted">
              列表展示所有 Provider，↑↓ 选择后右侧显示详情（Base URL、脱敏 API Key、模型列表）。
              按 → 进入 Provider 的编辑表单，可修改名称、Base URL、API Key、模型（逗号分隔）。
              列表最后一行是「+ Add new provider」，选中后按 → 添加新 Provider。
            </p>
          </div>

          <div className="border border-tf-border rounded-lg p-4 bg-tf-card">
            <h4 className="text-sm font-semibold text-tf-text mb-1">Ports — 端口设置</h4>
            <p className="text-xs text-tf-muted">
              两个可编辑字段：PORT（代理服务端口）和 UI_PORT（Web UI 端口）。
              ↑↓ 切换字段，直接输入数字，Enter 下一个，在最后一个字段按 Enter 或按 w 保存。
            </p>
          </div>

          <div className="border border-tf-border rounded-lg p-4 bg-tf-card">
            <h4 className="text-sm font-semibold text-tf-text mb-1">Router — 智能路由</h4>
            <p className="text-xs text-tf-muted">
              两个字段：Enabled（开关，Enter 切换 ON/OFF）和 Default（默认 Provider+模型，可输入）。
              ↑↓ 切换字段，Enter 在 Enabled 上切换开关、在 Default 上保存。w 也可保存。
            </p>
          </div>

          <div className="border border-tf-border rounded-lg p-4 bg-tf-card">
            <h4 className="text-sm font-semibold text-tf-text mb-1">Detectors — 检测器开关</h4>
            <p className="text-xs text-tf-muted">
              列表展示所有检测器（fullContext、slidingWindow、summarization），↑↓ 选择，Enter 切换启用/禁用。
              修改即时保存到配置文件。
            </p>
          </div>

          <div className="border border-tf-border rounded-lg p-4 bg-tf-card">
            <h4 className="text-sm font-semibold text-tf-text mb-1">General — 通用设置</h4>
            <p className="text-xs text-tf-muted">
              两个字段：LOG_LEVEL（日志级别）和 DATABASE（SQLite 数据库路径）。
              编辑方式同 Ports 页面。
            </p>
          </div>

          <div className="border border-tf-border rounded-lg p-4 bg-tf-card">
            <h4 className="text-sm font-semibold text-tf-text mb-1">Config — 文本编辑器</h4>
            <p className="text-xs text-tf-muted">
              显示配置文件路径，提供 vim 和 nano 两个选项。↑↓ 选择编辑器，Enter 打开。
              编辑器退出后 TUI <strong>自动重新渲染</strong>，回到当前页面。
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">常见问题</h3>
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium text-tf-text">按 q 退出后终端卡住？</h4>
            <p className="text-xs text-tf-muted">
              确保使用的是 <code>pnpm --filter @tokenflow/cli tui</code>（无 --watch）。
              如果用了 <code>pnpm dev -- config</code>，父进程（tsx --watch）不会退出，需要额外按 Ctrl+C。
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-tf-text">Backspace 删不掉字符？</h4>
            <p className="text-xs text-tf-muted">
              已同时处理 backspace 和 delete 键。如果还有问题，检查终端的键盘映射设置。
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-tf-text">Ctrl+C 退出后终端显示异常？</h4>
            <p className="text-xs text-tf-muted">
              在终端中运行 <code>reset</code> 或 <code>stty sane</code> 恢复。TUI 已注册信号处理器，但强制 kill 可能绕过清理逻辑。
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
