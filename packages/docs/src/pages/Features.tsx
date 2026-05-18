export default function Features() {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-tf-text">功能介绍</h2>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">API 代理</h3>
        <p className="text-tf-muted leading-relaxed">
          Token Flow 作为透明代理，将请求转发到你配置的上游 Provider（OpenAI、Anthropic、DeepSeek 等）。
          你的应用只需指向 Token Flow 的端点，无需修改请求格式。
        </p>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <FeatureCard
            title="多 Provider"
            desc="同时配置多个上游 Provider，每个 Key 绑定不同的 Provider"
          />
          <FeatureCard
            title="Key 管理"
            desc="生成统一接入 Key，支持创建、编辑、删除，Key 与 Provider 解耦"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">格式转换</h3>
        <p className="text-tf-muted leading-relaxed">
          客户端统一使用 OpenAI 格式，Token Flow 自动转换为上游 Provider 所需格式。
          支持 11 个 Provider 模板：openai、anthropic、gemini、deepseek、openrouter、groq、cerebras、vercel、vertex-gemini、vertex-claude、openai-responses。
        </p>
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
        <h3 className="text-lg font-semibold text-tf-text">Token 计费</h3>
        <p className="text-tf-muted leading-relaxed">
          按模型单价实时计算每次请求的预估成本，支持自定义价格表和远程价格源同步。
        </p>
        <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2">
          <li>默认价格表覆盖主流模型（gpt-4o、claude-3-5-sonnet、deepseek-chat 等）</li>
          <li>Settings UI 支持查看、编辑、删除模型单价</li>
          <li>CLI <code>tflow pricing list</code> 查看本地价格，<code>tflow pricing --update</code> 从远程源同步</li>
          <li>支持 Token Flow 原生格式和 OpenRouter 格式自动识别</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">交互界面</h3>
        <p className="text-tf-muted leading-relaxed">
          Token Flow 提供两种配置管理方式：浏览器中的 Web Dashboard（GUI）和终端中的 TUI。
          两者功能对等，可根据场景选择。
        </p>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="border border-tf-border rounded-lg p-4 bg-tf-card">
            <h4 className="text-sm font-semibold text-tf-text mb-1">Web Dashboard（GUI）</h4>
            <p className="text-xs text-tf-muted mb-2">
              浏览器可视化控制台，适合需要图表分析、鼠标操作的场景。
            </p>
            <p className="text-xs text-tf-muted">
              含 Providers、Sessions、Analysis、Settings 四个页面。
            </p>
          </div>
          <div className="border border-tf-border rounded-lg p-4 bg-tf-card">
            <h4 className="text-sm font-semibold text-tf-text mb-1">Terminal UI（TUI）</h4>
            <p className="text-xs text-tf-muted mb-2">
              全屏终端交互界面，无需浏览器，纯键盘操作，适合 SSH 远程或快速修改配置。
            </p>
            <p className="text-xs text-tf-muted">
              含 Overview、Providers、Ports、Detectors、General、Config 等页面。
            </p>
          </div>
        </div>
        <p className="text-tf-muted text-sm mt-2">
          详细使用说明请参见左侧导航「GUI 使用指南」和「TUI 使用指南」。
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">CLI 命令</h3>
        <pre><code>{`tflow start       # 启动代理服务
tflow stop        # 停止服务
tflow restart     # 重启服务
tflow status      # 查看运行状态
tflow ui          # 打开 Web UI
tflow config      # 交互式配置（TUI）
tflow pricing list     # 查看本地模型单价
tflow pricing --update # 从远程 pricingSource 同步价格`}</code></pre>
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
