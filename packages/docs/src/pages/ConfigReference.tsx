export default function ConfigReference() {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-tf-text">配置参考</h2>
      <p className="text-tf-muted">
        配置文件位于 <code>~/.tokenflow/config.json5</code>，支持 JSON5 格式（注释、尾逗号）。
        可通过 <code>tflow config</code> 或 Web UI 的 Settings 页面编辑。
      </p>

      <pre><code>{`{
  // 服务端口
  PORT: 40001,

  // Web UI 端口
  UI_PORT: 40002,

  // 管理员密钥（用于 API 管理接口认证）
  APIKEY: "your-admin-key",

  // SQLite 数据库路径
  DATABASE: "~/.tokenflow/tokenflow.db",

  // 上游 Provider 列表
  Providers: [ ... ],

  // 智能路由配置
  Router: { ... },

  // 检测器配置
  Detectors: { ... },

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
          name="UI_PORT"
          type="number"
          default="40002"
          desc="Web UI 开发服务器端口。生产环境通过 tflow ui 打开。"
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
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">Providers</h3>
        <p className="text-sm text-tf-muted">
          上游 Provider 列表。每个 Provider 代表一个 API 服务商。
        </p>
        <pre><code>{`Providers: [
  {
    name: "openai",                    // 唯一标识
    api_base_url: "https://api.openai.com",  // API 地址
    api_key: "sk-xxx",                 // 上游 API Key
    models: ["gpt-4o", "gpt-4o-mini"] // 支持的模型列表
  },
  {
    name: "anthropic",
    api_base_url: "https://api.anthropic.com",
    api_key: "sk-ant-xxx",
    models: ["claude-sonnet-4-20250514"]
  }
]`}</code></pre>
        <Field name="name" type="string" desc="Provider 唯一标识，用于 API Key 绑定和路由配置" />
        <Field name="api_base_url" type="string" desc="上游 API 地址。不含 /v1 路径，系统会自动拼接" />
        <Field name="api_key" type="string" desc="上游 API Key。在 Web UI 中会被脱敏显示" />
        <Field name="models" type="string[]" desc="该 Provider 支持的模型列表" />
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">Router</h3>
        <p className="text-sm text-tf-muted">
          智能路由配置。开启后可按规则自动选择 Provider 和模型。
        </p>
        <pre><code>{`Router: {
  enabled: false,
  default: "openai,gpt-4o",   // "provider,model"
  longContext: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    threshold: 80000           // token 阈值
  }
}`}</code></pre>
        <Field name="enabled" type="boolean" default="false" desc="是否启用智能路由" />
        <Field name="default" type="string" desc='默认路由，格式为 "provider,model"' />
        <Field name="longContext" type="object" desc="长上下文自动切换配置" />
        <Field name="longContext.threshold" type="number" desc="超过此 token 数量时自动切换到长上下文模型" />
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
