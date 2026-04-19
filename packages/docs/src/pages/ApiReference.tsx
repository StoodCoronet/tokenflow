export default function ApiReference() {
  return (
    <div className="space-y-10">
      <h2 className="text-2xl font-bold text-tf-text">API 参考</h2>
      <p className="text-tf-muted">
        Token Flow 服务默认运行在 <code>localhost:40001</code>。
        所有 <code>/api/*</code> 端点为管理接口，<code>/v1/*</code> 为代理端点。
      </p>

      {/* Proxy */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">代理端点</h3>
        <Endpoint
          method="POST"
          path="/v1/chat/completions"
          desc="代理请求到上游 Provider。支持流式和非流式响应。"
          headers={{ 'X-API-Key': 'Token Flow 生成的 API Key', 'Content-Type': 'application/json' }}
          body={{
            model: 'string (必填) — 模型名称',
            messages: 'array (必填) — 消息列表 [{ role, content }]',
            stream: 'boolean — 是否流式响应',
            temperature: 'number — 采样温度',
            max_tokens: 'number — 最大生成 token 数',
            session_id: 'string — 会话 ID（可选，自动生成）',
          }}
          response={{
            id: 'string',
            model: 'string',
            choices: 'array',
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          }}
        />
      </section>

      {/* Keys */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">API Keys</h3>

        <Endpoint
          method="GET"
          path="/api/keys"
          desc="列出所有 API Key"
          response="ApiKey[]"
        />
        <Endpoint
          method="POST"
          path="/api/keys"
          desc="创建新的 API Key"
          body={{
            name: 'string (必填)',
            provider: 'string — 上游 Provider 名称，默认 openai',
            upstream_key: 'string (必填) — 上游 API Key',
            base_url: 'string — 自定义上游地址',
            scenario: 'string — 使用场景描述',
          }}
          response="ApiKey"
        />
        <Endpoint
          method="PUT"
          path="/api/keys/:id"
          desc="更新 API Key"
          body={{
            name: 'string',
            provider: 'string',
            upstream_key: 'string',
            base_url: 'string',
            scenario: 'string',
          }}
          response="ApiKey"
        />
        <Endpoint
          method="DELETE"
          path="/api/keys/:id"
          desc="删除 API Key"
          response='{ "ok": true }'
        />
      </section>

      {/* Dashboard */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">Dashboard</h3>
        <Endpoint
          method="GET"
          path="/api/dashboard"
          desc="获取 Dashboard 统计数据"
          response={{
            total_requests: 'number',
            total_tokens: 'number',
            avg_efficiency: 'number (0-100)',
            recent_logs: 'RequestLog[] (最近 50 条)',
            sessions: 'Session[] (最近 20 条)',
          }}
        />
      </section>

      {/* Sessions */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">Sessions</h3>

        <Endpoint
          method="GET"
          path="/api/sessions"
          desc="查询 Session 列表，支持分页和筛选"
          params={{
            limit: 'number — 每页数量，默认 20，最大 100',
            offset: 'number — 偏移量',
            key_id: 'string — 按 API Key 筛选',
            pattern: 'string — 按检测模式筛选',
            status: '"active" | "idle" — 按状态筛选',
            time_start: 'string — 起始时间',
            time_end: 'string — 结束时间',
          }}
          response={{
            sessions: 'Session[]',
            total: 'number',
            limit: 'number',
            offset: 'number',
          }}
        />
        <Endpoint
          method="GET"
          path="/api/sessions/stats"
          desc="获取 Session 统计概览"
          response={{
            total_sessions: 'number',
            active_sessions: 'number',
            total_tokens: 'number',
            avg_efficiency: 'number',
            pattern_distribution: '{ pattern: string, count: number }[]',
          }}
        />
        <Endpoint
          method="GET"
          path="/api/sessions/:id"
          desc="获取 Session 详情，包含请求日志和最近消息"
          response={{
            session: 'Session',
            logs: 'RequestLog[]',
            recent_messages: '{ role: string, content: string }[]',
          }}
        />
      </section>

      {/* Analysis */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">Analysis</h3>
        <Endpoint
          method="GET"
          path="/api/analysis/:session_id"
          desc="获取 Session 的分析数据"
          response={{
            session_id: 'string',
            logs: '{ efficiency_score: number, detected_pattern: string, created_at: string }[]',
          }}
        />
      </section>

      {/* Config */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">Config</h3>
        <Endpoint
          method="GET"
          path="/api/config"
          desc="获取当前配置（Provider api_key 已脱敏）"
          response="AppConfig (api_key 脱敏为 sk-xx***)"
        />
        <Endpoint
          method="PUT"
          path="/api/config"
          desc="更新配置并写入 config.json5"
          body="Partial<AppConfig"
          response='{ "ok": true, "config": AppConfig }'
        />
      </section>
    </div>
  )
}

function Endpoint({
  method, path, desc, headers, params, body, response,
}: {
  method: string
  path: string
  desc: string
  headers?: Record<string, string>
  params?: Record<string, string>
  body?: Record<string, string> | string
  response: Record<string, unknown> | string
}) {
  const color: Record<string, string> = {
    GET: 'text-green-600 dark:text-green-400',
    POST: 'text-blue-600 dark:text-blue-400',
    PUT: 'text-amber-600 dark:text-amber-400',
    DELETE: 'text-red-600 dark:text-red-400',
  }

  return (
    <div className="border border-tf-border rounded-lg bg-tf-card overflow-hidden">
      <div className="px-4 py-3 border-b border-tf-border flex items-center gap-3">
        <span className={`text-xs font-bold font-mono ${color[method]}`}>{method}</span>
        <code className="text-sm text-tf-text">{path}</code>
      </div>
      <div className="px-4 py-3 space-y-3">
        <p className="text-sm text-tf-muted">{desc}</p>
        {headers && <Params title="Headers" items={headers} />}
        {params && <Params title="Query Params" items={params} />}
        {body && (
          <div>
            <p className="text-xs font-semibold text-tf-text mb-1">Body</p>
            <pre className="text-xs"><code>{typeof body === 'string' ? body : JSON.stringify(body, null, 2)}</code></pre>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold text-tf-text mb-1">Response</p>
          <pre className="text-xs"><code>{typeof response === 'string' ? response : JSON.stringify(response, null, 2)}</code></pre>
        </div>
      </div>
    </div>
  )
}

function Params({ title, items }: { title: string; items: Record<string, string> }) {
  return (
    <div>
      <p className="text-xs font-semibold text-tf-text mb-1">{title}</p>
      <div className="text-xs space-y-0.5">
        {Object.entries(items).map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <code className="text-tf-accent shrink-0">{k}</code>
            <span className="text-tf-muted">{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
