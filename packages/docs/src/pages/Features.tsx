export default function Features() {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-tf-text">功能介绍</h2>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">API 代理</h3>
        <p className="text-tf-muted leading-relaxed">
          Token Flow 作为透明代理，将请求转发到你配置的上游 Provider（OpenAI、Anthropic 等）。
          你的应用只需指向 Token Flow 的端点，无需修改请求格式。
        </p>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <FeatureCard
            title="多 Provider"
            desc="同时配置多个上游 Provider，每个 Key 绑定不同的 Provider"
          />
          <FeatureCard
            title="Key 管理"
            desc="导入外部 Key，生成统一接入点，支持创建、编辑、删除"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">智能路由</h3>
        <p className="text-tf-muted leading-relaxed">
          根据请求特征自动选择最优的 Provider 和模型。支持默认路由和长上下文自动切换。
        </p>
        <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2">
          <li>默认路由：指定 Provider + 模型组合</li>
          <li>长上下文路由：当 token 数量超过阈值时自动切换到支持长上下文的模型</li>
          <li>可按 Key 独立配置</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">上下文检测器</h3>
        <p className="text-tf-muted leading-relaxed">
          自动分析会话的上下文使用模式，给出效率评分和优化建议。
        </p>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <DetectorCard name="DET-001" title="Full Context" desc="每次请求发送完整历史" />
          <DetectorCard name="DET-002" title="Sliding Window" desc="仅保留最近 N 条消息" />
          <DetectorCard name="DET-003" title="Summarization" desc="压缩历史为摘要" />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">Web Dashboard（GUI）</h3>
        <p className="text-tf-muted leading-relaxed">
          浏览器中的可视化控制台，提供实时流量监控和数据分析。
        </p>
        <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2">
          <li><strong>Dashboard</strong> — 总请求量、总 token、平均效率、最近请求日志</li>
          <li><strong>Keys</strong> — API Key 管理（CRUD）</li>
          <li><strong>Sessions</strong> — 会话列表、统计概览、模式分布、详情分析</li>
          <li><strong>Analysis</strong> — 会话粒度的检测报告和 token 趋势图</li>
          <li><strong>Settings</strong> — 配置管理（Provider、检测器、路由、通用设置）</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">Terminal UI（TUI）</h3>
        <p className="text-tf-muted leading-relaxed">
          全屏终端交互界面，无需浏览器即可查看和修改所有配置。支持键盘导航和实时预览。
        </p>
        <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2">
          <li><strong>Overview</strong> — 配置概览：Provider 数量、端口、路由状态、日志级别</li>
          <li><strong>Providers</strong> — 增删改上游 Provider（名称、Base URL、API Key、模型列表）</li>
          <li><strong>Ports</strong> — 代理服务和 Web UI 端口设置</li>
          <li><strong>Router</strong> — 智能路由开关和默认 Provider 配置</li>
          <li><strong>Detectors</strong> — 上下文检测器开关管理</li>
          <li><strong>General</strong> — 日志级别和数据库路径设置</li>
          <li><strong>Config</strong> — 在 vim 或 nano 中直接编辑原始配置文件</li>
        </ul>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <FeatureCard title="键盘导航" desc="↑↓ 切换菜单，→ 进入编辑，← 返回，w 保存，q 退出" />
          <FeatureCard title="实时预览" desc="侧边栏切换时右侧即时显示对应页面内容，所见即所得" />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">CLI 命令</h3>
        <pre><code>{`tflow start       # 启动代理服务
tflow stop        # 停止服务
tflow restart     # 重启服务
tflow status      # 查看运行状态
tflow ui          # 打开 Web UI
tflow config      # 交互式配置（TUI）`}</code></pre>
      </section>
    </div>
  )
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="border border-tf-border rounded-lg p-4 bg-tf-card">
      <h4 className="text-sm font-semibold text-tf-text mb-1">{title}</h4>
      <p className="text-xs text-tf-muted">{desc}</p>
    </div>
  )
}

function DetectorCard({ name, title, desc }: { name: string; title: string; desc: string }) {
  return (
    <div className="border border-tf-border rounded-lg p-4 bg-tf-card">
      <div className="text-xs text-tf-accent font-mono mb-1">{name}</div>
      <h4 className="text-sm font-semibold text-tf-text mb-1">{title}</h4>
      <p className="text-xs text-tf-muted">{desc}</p>
    </div>
  )
}
