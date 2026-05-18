export default function GuiGuide() {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-tf-text">Web Dashboard（GUI）使用指南</h2>

      <p className="text-tf-muted leading-relaxed">
        Token Flow 的 Web Dashboard 是一个基于浏览器的可视化控制台。
        启动服务后访问 <code>http://localhost:40002</code> 即可打开，或通过 <code>tflow ui</code> 命令自动唤起浏览器。
      </p>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">Providers — Provider 与 Key 管理</h3>
        <p className="text-tf-muted leading-relaxed">
          统一管理所有上游 Provider 及其生成的 API Key。点击 Provider 卡片可展开详情，查看 Key 列表和使用示例。
        </p>
        <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2">
          <li><strong>Provider 卡片</strong> — 展示名称、模板、Base URL、Key 数量、token 用量趋势图和预估成本</li>
          <li><strong>创建 Provider</strong> — 点击「Add Provider」，填写名称、选择模板（11 种）、Base URL、API Key</li>
          <li><strong>模型获取</strong> — 编辑 Provider 时点击 🔄 Fetch 自动从上游拉取可用模型列表</li>
          <li><strong>添加 Key</strong> — 在 Provider 详情中点击「+ Add Key」生成接入 Key，可设置场景标签</li>
          <li><strong>复制 Key</strong> — 点击 Copy 按钮复制完整 Key ID 到剪贴板</li>
          <li><strong>使用示例</strong> — 每个 Provider 详情底部提供 cURL / Python / TypeScript 调用示例</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">Sessions — 会话分析</h3>
        <p className="text-tf-muted leading-relaxed">
          按会话维度查看流量分布和上下文使用模式。
        </p>
        <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2">
          <li><strong>会话列表</strong> — 所有会话的概览，支持按时间范围筛选</li>
          <li><strong>统计概览</strong> — 每个会话的请求数、token 消耗、平均效率</li>
          <li><strong>模式分布</strong> — 饼图展示 Full Context / Sliding Window / Summarization 占比</li>
          <li><strong>详情分析</strong> — 点击会话查看逐条请求的 token 趋势和检测报告</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">Analysis — 数据看板</h3>
        <p className="text-tf-muted leading-relaxed">
          全局流量分析看板，支持多时间范围切换和 Key 维度下钻。
        </p>
        <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2">
          <li><strong>Overview</strong> — 总请求量、总 Token、平均效率、预估成本等概览卡片</li>
          <li><strong>Token Usage Trend</strong> — 时间趋势图，支持按 Key 拆分查看，可点击 legend 隐藏/显示特定 Key</li>
          <li><strong>Usage by Key</strong> — 各 Key 的 token 消耗横向柱状图</li>
          <li><strong>Usage by Model</strong> — 各模型的 token 消耗饼图</li>
          <li><strong>Key Detail</strong> — 点击 Key 行查看该 Key 的详细趋势和分布</li>
          <li><strong>时间范围</strong> — 支持 1h / 6h / 24h / 7d / 30d / all 六档切换</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">Settings — 配置管理</h3>
        <p className="text-tf-muted leading-relaxed">
          图形化界面修改所有配置项，改动即时保存到 <code>~/.tokenflow/config.json5</code>。
        </p>
        <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2">
          <li><strong>Providers</strong> — 添加、编辑、删除上游 Provider（名称、模板、Base URL、API Key、模型列表、Extra Headers）</li>
          <li><strong>Detectors</strong> — 开关各个上下文检测器</li>
          <li><strong>Proxy</strong> — 配置代理地址（可选）</li>
          <li><strong>General</strong> — 修改服务端口、日志级别、数据库路径</li>
          <li><strong>Pricing</strong> — 查看和编辑模型单价表，配置远程价格源 pricingSource</li>
        </ul>
      </section>
    </div>
  )
}
