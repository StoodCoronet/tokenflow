export default function QuickStart() {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-tf-text">快速开始</h2>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">安装</h3>
        <pre><code>{`# 克隆仓库
git clone https://github.com/your-org/token-flow.git
cd token-flow

# 安装依赖
pnpm install

# 构建所有包
pnpm build`}</code></pre>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">首次配置</h3>
        <p className="text-tf-muted leading-relaxed">
          使用 <code>tflow config</code> 进入交互式配置界面，或手动编辑配置文件。
        </p>
        <pre><code>{`# 交互式配置（推荐）
tflow config

# 或手动创建配置文件
mkdir -p ~/.tokenflow
cat > ~/.tokenflow/config.json5 << 'EOF'
{
  PORT: 40001,
  UI_PORT: 40002,
  APIKEY: "your-admin-key",
  DATABASE: "~/.tokenflow/tokenflow.db",
  Providers: [
    {
      name: "openai",
      api_base_url: "https://api.openai.com",
      api_key: "sk-xxx",
      models: ["gpt-4o", "gpt-4o-mini"]
    }
  ],
  Router: {
    enabled: false,
    default: "openai,gpt-4o"
  },
  Detectors: {
    full_context: { enabled: true },
    sliding_window: { enabled: true },
    summarization: { enabled: true }
  },
  LOG_LEVEL: "info"
}
EOF`}</code></pre>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">启动服务</h3>
        <pre><code>{`# 启动代理服务
tflow start

# 查看状态
tflow status

# 打开 Web UI
tflow ui

# 停止服务
tflow stop`}</code></pre>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">第一个代理请求</h3>
        <p className="text-tf-muted leading-relaxed">
          服务启动后，在 Keys 页面创建一个 API Key。使用生成的 key 作为认证，
          将请求发送到 Token Flow 的代理端点。
        </p>
        <pre><code>{`# 将你的应用配置指向 Token Flow
curl http://localhost:40001/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-generated-key" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`}</code></pre>
        <p className="text-tf-muted leading-relaxed">
          请求会被转发到你配置的上游 Provider，同时 Token Flow 会记录 token 使用情况
          并运行上下文检测分析。
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">在应用中集成</h3>
        <p className="text-tf-muted leading-relaxed">
          只需将 OpenAI SDK 的 <code>baseURL</code> 指向 Token Flow，并设置 API Key。
        </p>
        <pre><code>{`import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: 'your-generated-key',   // Token Flow 生成的 key
  baseURL: 'http://localhost:40001/v1',  // Token Flow 端点
})

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
})`}</code></pre>
      </section>
    </div>
  )
}
