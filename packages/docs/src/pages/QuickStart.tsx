import { useState } from 'react'

export default function QuickStart() {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-tf-text">快速开始</h2>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">安装</h3>
        <CodeBlock code={`git clone https://github.com/your-org/token-flow.git
cd token-flow

pnpm install

pnpm build`} />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">首次配置</h3>
        <p className="text-tf-muted leading-relaxed">
          使用 <code>tflow config</code> 进入交互式配置界面：
        </p>
        <CodeBlock code="tflow config" />

        <p className="text-tf-muted leading-relaxed">
          或手动创建配置文件：
        </p>
        <CodeBlock code={`mkdir -p ~/.tokenflow

cat > ~/.tokenflow/config.json5 << 'EOF'
{
  PORT: 40001,
  APIKEY: "your-admin-key",
  DATABASE: "~/.tokenflow/tokenflow.db",
  Providers: [
    {
      name: "openai",
      template: "openai",
      api_base_url: "https://api.openai.com/v1",
      api_key: "sk-xxx",
      models: ["gpt-4o", "gpt-4o-mini"]
    }
  ],
  Detectors: {
    full_context: { enabled: true },
    sliding_window: { enabled: true },
    summarization: { enabled: true }
  },
  LOG_LEVEL: "info"
}
EOF`} />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">TUI 配置指南</h3>
        <p className="text-tf-muted leading-relaxed">
          运行 <code>tflow config</code> 进入全屏终端配置界面。无需浏览器，纯键盘操作即可完成所有配置。
        </p>
        <CodeBlock code={`# 开发模式
pnpm --filter @tokenflow/cli tui

# 构建后直接使用
tflow config`} />
        <p className="text-tf-muted leading-relaxed">
          常用快捷键：
        </p>
        <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2">
          <li><code>↑↓</code> — 侧边栏切换菜单项，页面内切换字段</li>
          <li><code>→ / Enter</code> — 进入当前页面（从预览切换到编辑模式）</li>
          <li><code>←</code> — 返回侧边栏（从编辑模式切回预览）</li>
          <li><code>w</code> — 保存当前页面修改（Provider Edit / Ports / General 均支持）</li>
          <li><code>q</code> — 退出 TUI</li>
        </ul>
        <p className="text-tf-muted leading-relaxed mt-2">
          各页面功能：
        </p>
        <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2">
          <li><strong>Overview</strong> — 查看当前配置概览</li>
          <li><strong>Providers</strong> — 添加 / 编辑 / 删除上游 Provider</li>
          <li><strong>Ports</strong> — 设置代理端口</li>
          <li><strong>Detectors</strong> — 启用或禁用上下文检测器</li>
          <li><strong>General</strong> — 修改日志级别、数据库路径、定价源</li>
          <li><strong>Config</strong> — 在 vim / nano 中直接编辑原始配置文件</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">启动服务</h3>
        <CodeBlock code={`# 启动代理服务
tflow start

# 查看状态
tflow status

# 打开 Web UI
tflow ui

# 停止服务
tflow stop`} />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">第一个代理请求</h3>
        <p className="text-tf-muted leading-relaxed">
          服务启动后，在 Providers 页面创建 Provider，然后点击「+ Add Key」生成 API Key。
          使用生成的 key 作为认证，将请求发送到 Token Flow 的代理端点。
        </p>
        <CodeBlock code={`curl http://localhost:40001/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-generated-key" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`} />
        <p className="text-tf-muted leading-relaxed">
          请求会被转发到你配置的上游 Provider，同时 Token Flow 会记录 token 使用情况和预估成本。
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text">在应用中集成</h3>
        <p className="text-tf-muted leading-relaxed">
          只需将 OpenAI SDK 的 <code>baseURL</code> 指向 Token Flow，并设置 API Key。
        </p>
        <CodeBlock code={`import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: 'your-generated-key',
  baseURL: 'http://localhost:40001/v1',
})

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
})`} />
      </section>
    </div>
  )
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = code
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 z-10 text-[11px] px-2 py-1 rounded border border-tf-border bg-tf-bg text-tf-muted hover:text-tf-accent hover:border-tf-accent/50 transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? '已复制' : '复制'}
      </button>
      <pre className="bg-tf-card border border-tf-border rounded-lg p-4 overflow-x-auto text-sm text-tf-text">
        <code>{code}</code>
      </pre>
    </div>
  )
}
