export default function ConfigReference() {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-tf-text">配置参考</h2>
      <p className="text-tf-muted">
        配置文件位于 <code>~/.tokenflow/config.json5</code>，支持 JSON5 格式（注释、尾逗号）。
        可通过 <code>tflow config</code>（TUI 终端界面）或 Web UI 的 Settings 页面编辑。
      </p>

      <pre><code>{`{
  // 服务端口
  PORT: 40001,

  // 管理员密钥（用于 API 管理接口认证）
  APIKEY: "your-admin-key",

  // SQLite 数据库路径
  DATABASE: "~/.tokenflow/tokenflow.db",

  // 上游 Provider 列表
  Providers: [ ... ],

  // 检测器配置
  Detectors: { ... },

  // 模型单价表
  Pricing: { ... },

  // 远程价格源
  pricingSource: "",

  // 日志级别
  LOG_LEVEL: "info"
}`}</code></pre>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">字段说明</h3>
        <Field
          name="PORT"
          type="number"
          default="40001"
          desc="代理服务监听端口。应用将请求发送到此端口的 /v1/* 路径。"
        />
        <Field
          name="APIKEY"
          type="string"
          default='""'
          desc="管理员密钥，用于管理接口认证。建议使用强随机字符串。"
        />
        <Field
          name="DATABASE"
          type="string"
          default='"~/.tokenflow/tokenflow.db"'
          desc="SQLite 数据库文件路径。支持 ~ 展开为用户目录。"
        />
        <Field
          name="LOG_LEVEL"
          type="string"
          default='"info"'
          desc='日志级别：debug | info | warn | error'
        />
        <Field
          name="Pricing"
          type="Record<string, ModelPricing>"
          default='{}'
          desc='模型单价表。键为模型名，值为 { prompt: number, completion: number }（单位：$ / 1M tokens）。'
        />
        <Field
          name="pricingSource"
          type="string"
          default='""'
          desc='远程价格源 URL。设置后可通过 tflow pricing --update 从该地址拉取并合并价格。'
        />
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">Providers</h3>
        <p className="text-sm text-tf-muted">
          上游 Provider 列表。每个 Provider 代表一个 API 服务商。
        </p>
        <pre><code>{`Providers: [
  {
    name: "openai",                          // 唯一标识
    template: "openai",                      // 转换器模板
    api_base_url: "https://api.openai.com/v1",  // API 地址
    api_key: "sk-xxx",                       // 上游 API Key
    models: ["gpt-4o", "gpt-4o-mini"],      // 支持的模型列表（可选，空则表示全部）
    options: {                               // 额外选项（可选）
      extra_headers: { "X-Custom": "value" }
    }
  }
]`}</code></pre>
        <Field name="name" type="string" desc="Provider 唯一标识，用于 Key 绑定和显示" />
        <Field name="template" type="string" desc="转换器模板，决定请求/响应格式转换方式。可选：openai、anthropic、openai-responses、gemini、deepseek、openrouter、groq、cerebras、vercel、vertex-gemini、vertex-claude" />
        <Field name="api_base_url" type="string" desc="上游 API 地址。需包含版本路径（如 /v1）" />
        <Field name="api_key" type="string" desc="上游 API Key。在 Web UI 中会被脱敏显示" />
        <Field name="models" type="string[]" desc="该 Provider 支持的模型列表。留空表示允许所有模型" />
        <Field name="options" type="object" desc="额外选项。当前支持 extra_headers：发送给上游的自定义 HTTP 头" />
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">Detectors</h3>
        <p className="text-sm text-tf-muted">
          上下文检测器开关。每个检测器可独立启用/禁用。
        </p>
        <pre><code>{`Detectors: {
  full_context: { enabled: true },
  sliding_window: { enabled: true },
  summarization: { enabled: true }
}`}</code></pre>
        <div className="mt-4 space-y-3">
          <DetectorDef
            id="DET-001"
            name="full_context"
            desc="检测是否每次请求都发送完整历史。常见于简单集成，token 消耗高但上下文完整。"
          />
          <DetectorDef
            id="DET-002"
            name="sliding_window"
            desc="检测是否使用滑动窗口（仅保留最近 N 条消息）。节省 token 但可能丢失早期上下文。"
          />
          <DetectorDef
            id="DET-003"
            name="summarization"
            desc="检测是否使用摘要压缩历史。平衡了 token 消耗和上下文保留。"
          />
        </div>
      </section>
    </div>
  )
}

function Field({ name, type, default: def, desc }: { name: string; type: string; default?: string; desc: string }) {
  return (
    <div className="border-l-2 border-tf-accent/40 pl-4">
      <div className="flex items-baseline gap-2 mb-0.5">
        <code className="text-sm font-semibold text-tf-text">{name}</code>
        <span className="text-xs text-tf-muted">{type}</span>
        {def && <span className="text-xs text-tf-muted">默认: <code>{def}</code></span>}
      </div>
      <p className="text-sm text-tf-muted">{desc}</p>
    </div>
  )
}

function DetectorDef({ id, name, desc }: { id: string; name: string; desc: string }) {
  return (
    <div className="border border-tf-border rounded-lg p-3 bg-tf-card">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-xs font-mono text-tf-accent">{id}</span>
        <code className="text-sm font-semibold text-tf-text">{name}</code>
      </div>
      <p className="text-xs text-tf-muted">{desc}</p>
    </div>
  )
}
