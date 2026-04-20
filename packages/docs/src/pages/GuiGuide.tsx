export default function GuiGuide() {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-tf-text">Web Dashboard（GUI）使用指南</h2>

      <p className="text-tf-muted leading-relaxed">
        Token Flow 的 Web Dashboard 是一个基于浏览器的可视化控制台。
        启动服务后访问 <code>http://localhost:40002</code> 即可打开，或通过 <code>tflow ui</code> 命令自动唤起浏览器。
      </p>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">Dashboard — 数据看板</h3>
        <p className="text-tf-muted leading-relaxed">
          首页展示全局流量概览，所有数据实时刷新。
        </p>
        <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2">
          <li><strong>总请求量</strong> — 累计处理的 API 请求次数</li>
          <li><strong>总 Token 消耗</strong> — 所有请求的 input + output token 总和</li>
          <li><strong>平均效率</strong> — 上下文利用率评分（0-100）</li>
          <li><strong>最近请求日志</strong> — 最近 20 条请求的简要信息</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">Keys — API Key 管理</h3>
        <p className="text-tf-muted leading-relaxed">
          管理接入 Token Flow 的 API Key。每个 Key 可绑定特定的 Provider 和模型。
        </p>
        <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2">
          <li><strong>创建 Key</strong> — 点击「新建」按钮，填写名称、选择 Provider、设置限流</li>
          <li><strong>编辑 Key</strong> — 点击行内编辑图标，可修改名称、绑定 Provider、启用/禁用</li>
          <li><strong>删除 Key</strong> — 点击删除图标，确认后永久移除</li>
          <li><strong>复制 Key</strong> — 点击复制图标将 Key 复制到剪贴板，用于应用集成</li>
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
        <h3 className="text-lg font-semibold text-tf-text">Analysis — 检测报告</h3>
        <p className="text-tf-muted leading-relaxed">
          会话粒度的深度检测报告，帮助优化 token 使用效率。
        </p>
        <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2">
          <li><strong>效率评分</strong> — 基于上下文复用率计算的 0-100 分评分</li>
          <li><strong>优化建议</strong> — 针对该会话的具体改进建议（如启用滑动窗口、调整模型）</li>
          <li><strong>Token 趋势图</strong> — 折线图展示会话内逐条请求的 token 变化</li>
          <li><strong>检测详情</strong> — 每个 Detector 的命中情况和详细数据</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">Settings — 配置管理</h3>
        <p className="text-tf-muted leading-relaxed">
          图形化界面修改所有配置项，改动即时保存到 <code>~/.tokenflow/config.json5</code>。
        </p>
        <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2">
          <li><strong>Providers</strong> — 添加、编辑、删除上游 Provider（名称、Base URL、API Key、模型列表）</li>
          <li><strong>Router</strong> — 启用/禁用智能路由，设置默认 Provider 和长上下文阈值</li>
          <li><strong>Detectors</strong> — 开关各个上下文检测器</li>
          <li><strong>General</strong> — 修改服务端口、日志级别、数据库路径</li>
        </ul>
      </section>
    </div>
  )
}
