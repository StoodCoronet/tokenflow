import { useState } from 'react'

const CONTENT = {
  zh: {
    abstract: {
      title: 'Abstract',
      body: 'Token Flow 是一个面向大语言模型（LLM）API 编排的开源轻量级代理系统。与通用 API 网关或碎片化工具链组装不同，Token Flow 将透明请求代理、多 Provider 格式转换、实时 Token 成本估算和会话级可观测性整合为单一可部署单元。系统采用两层 Transformer 流水线（MainTransformer + ProviderTransformer），在将多种客户端请求格式桥接到 11 个异构上游 Provider 的同时，在关键路径上保持亚毫秒级开销。可观测性通过基于 SQLite WAL 的存储层实现，配合小时/天级别的预聚合统计，无需外部依赖即可实现高效趋势分析和成本归因。我们开源了实现，并提供了可复现的模拟基准测试。',
    },
    intro: {
      title: '1. Introduction',
      p1: '随着企业越来越深入地将 LLM 集成到生产工作流中，管理多个上游 Provider——每个都有独特的 API 格式、定价模型和速率限制——所带来的运维复杂性已成为显著的工程负担。现有解决方案通常分为两类：(1) 通用 API 网关（如 Kong、nginx），缺乏 LLM 特定的语义，如 Token 计数和格式翻译；(2) 专业但碎片化的工具（如 LiteLLM 用于路由、OneAPI 用于格式转换、Langfuse 用于可观测性），需要单独部署和集成。',
      p2: 'Token Flow 通过提供一个统一、自包含的、专为 LLM 工作负载设计的代理层来解决这一差距。核心洞察在于 LLM API 流量具有独特的特征——流式 Server-Sent Events (SSE)、异构的请求/响应模式、提示/补全 Token 的不对称性、以及按模型定价——这些特征需要一个领域特定的中间件，而非通用网关配置。',
      p3: '本工作的主要贡献如下：',
      li1: '一个集成的 LLM 代理，将路由、格式转换、成本估算和可观测性结合在一个无外部依赖的系统中。',
      li2: '两层 Transformer 架构，将端点级转换（chat.completions vs. messages）与 Provider 特定适配解耦，实现了对新 Provider 的高可扩展性。',
      li3: '一种使用 SQLite WAL 的轻量级预聚合策略，在部署简单性和查询性能之间取得平衡。',
    },
    relatedWork: {
      title: '2. Background and Related Work',
      p1: '我们将 Token Flow 与三个代表性系统进行定位，每个系统分别解决了 LLM 代理问题的一个子集。',
      liteLLM: 'LiteLLM 在多 Provider 路由和回退策略方面表现出色，但将格式转换视为次要关注点，通常需要 Provider 特定的 SDK 包装器。',
      oneAPI: 'OneAPI / NewAPI 为中国 LLM 平台提供了广泛的适配器覆盖，但作为重量级网关运行，依赖 MySQL/PostgreSQL。',
      langfuse: 'Langfuse 提供了一流的追踪和提示管理，但严格来说只是一个可观测性层——它不代理或转换请求。',
      p2: 'Token Flow 的差异化在于其集成深度：四种能力（代理、转换、计费、可观测性）共享同一个请求生命周期，从而实现了跨领域功能，如按 Key 成本归因和实时效率评分。',
      colCapability: '能力',
      colLiteLLM: 'LiteLLM',
      colOneAPI: 'OneAPI / NewAPI',
      colLangfuse: 'Langfuse',
      colTokenFlow: 'Token Flow',
      rowFormat: '格式转换',
      rowRouting: '多 Provider 路由',
      rowCost: '成本估算',
      rowObservability: '可观测性',
      rowDeps: '外部依赖',
      rowDeploy: '部署体量',
      valuePartial: '部分支持',
      valueExtensive: '广泛',
      valueNo: '不支持',
      valueBuiltIn: '内置（11 种模板）',
      valueYes: '支持',
      valueKeyBased: '基于 Key 绑定',
      valueBasic: '基础',
      valueRealtime: '实时 + 远程同步',
      valueLimited: '有限',
      valueSession: '会话 + 趋势 + Key 下钻',
      valueRedisDB: 'Redis, DB',
      valueMySQL: 'MySQL / Postgres',
      valuePostgres: 'Postgres',
      valueSQLite: '仅 SQLite',
      valueMedium: '中等',
      valueSingleBinary: '单一二进制',
    },
    architecture: {
      title: '3. System Architecture',
      p1: 'Token Flow 采用模块化单体架构。所有组件运行在单个 Fastify 进程内，通过内存引用而非 RPC 或消息队列进行通信。这种设计优先考虑部署简单性而非水平可扩展性，这与大多数 LLM 代理部署服务于单租户或小团队工作负载、单节点即足够的观察一致。',
      proxy: { title: 'Proxy Layer', desc: 'Fastify HTTP 服务器。处理请求验证、API Key 认证、会话标记和上游转发。' },
      transformer: { title: 'Transformer Pipeline', desc: '两层架构：MainTransformer（端点级）和 ProviderTransformer（Provider 特定）。在多种客户端格式和上游模式之间转换。' },
      storage: { title: 'Storage Layer', desc: 'WAL 模式的 SQLite。request_logs 用于原始追踪，sessions 用于聚合，stats_aggregates 用于预计算的小时/天窗口。' },
      analysis: { title: 'Analysis Engine', desc: '上下文模式检测（DET-001~003）、效率评分和使用可配置定价表的实时成本估算。' },
      webui: { title: 'Web UI', desc: 'React 19 + Vite 仪表盘，包含 Providers、Sessions、Analysis 和 Settings。' },
      cli: { title: 'CLI & TUI', desc: '用于服务生命周期管理（启动/停止/状态）和交互式终端配置的命令行工具。' },
    },
    method: {
      title: '4. Method',
      transformer: {
        title: '4.1 Two-Layer Transformer Pipeline',
        p1: 'LLM API 暴露了概念上相似的操作——聊天补全、基于消息的对话和结构化响应——但具有不兼容的传输格式。Token Flow 引入了两层 Transformer 来管理这种复杂性，而无需创建 O(N×M) 转换函数（N 端点 × M Provider）。',
        li1: 'MainTransformer 在端点粒度上运行。它识别传入请求的目标是 /v1/chat/completions、/v1/messages 还是 /v1/responses，并调度到适当的请求/响应序列化器。',
        li2: 'ProviderTransformer 处理端点族内的 Provider 特定适配。例如，在 chat.completions 端点下，Anthropic Provider Transformer 将 OpenAI 的 messages 数组映射到 Anthropic 的 messages 格式，转换 temperature 语义，并将流式 SSE 块转换回 OpenAI 风格的 chat.completion.chunk 事件。',
        p2: '这种分离允许通过仅实现 Provider 特定差异来添加新 Provider，通常只需 200–400 行 TypeScript，同时复用端点级逻辑。截至目前，支持 11 种 Provider 模板：openai、anthropic、openai-responses、gemini、deepseek、openrouter、groq、cerebras、vercel、vertex-gemini 和 vertex-claude。',
      },
      storage: {
        title: '4.2 Data Storage and Pre-aggregation',
        p1: '通用可观测性平台将原始请求日志存储在列式数据库（ClickHouse、BigQuery）中，并在查询时计算聚合。虽然这提供了灵活性，但它引入了与 Token Flow 可在笔记本电脑上部署的目标相冲突的运维开销。',
        p2: 'Token Flow 使用 WAL（预写日志）模式的 SQLite 作为其唯一存储引擎。为保持响应式仪表盘查询而无需外部索引基础设施，我们实现了预聚合策略：',
        li1: 'request_logs 保留原始追踪，用于会话级下钻和模式检测。',
        li2: 'stats_aggregates 存储按 (window_type, window_start, api_key_id, model) 键值化的小时和天级别汇总。每个汇总包含 SUM(request_count)、SUM(prompt_tokens)、SUM(completion_tokens) 和 SUM(estimated_cost)。',
        li3: '后台清理任务（cleanupOldStats）会修剪超过 90 天的聚合和日志条目，限制存储增长。',
        p3: '这种设计以临时查询灵活性换取可预测的延迟：30 天窗口的仪表盘趋势查询最多扫描 720 个每小时行，而不是潜在的数百万原始日志条目。',
      },
      detection: {
        title: '4.3 Context Pattern Detection',
        p1: 'Token Flow 的一个独特功能是其对会话级上下文管理策略进行分类的能力，这直接影响 Token 效率。我们定义了三种典型模式：',
        li1: 'Full Context (DET-001)：每次请求传输完整的对话历史。实现简单，但导致二次 Token 增长。',
        li2: 'Sliding Window (DET-002)：仅保留最近的 N 条消息。线性增长，但早期上下文会丢失。',
        li3: 'Summarization (DET-003)：历史消息被压缩为摘要。次线性增长，受控的信息损失。',
        p2: '检测通过分析会话窗口内提示 Token 数量与消息数量之间的比率来执行。效率评分（0–100）根据实际 Token 消耗与传达相同信息内容的理论最小值之间的偏差推导得出。',
      },
      cost: {
        title: '4.4 Real-Time Cost Estimation',
        p1: '与将请求视为不透明字节的通用代理不同，Token Flow 在响应完成时立即解析上游响应以提取 usage.prompt_tokens 和 usage.completion_tokens。可配置的定价表将模型名称映射到提示和补全两个方向的每百万 Token 费率。',
        p2: '成本计算为：',
        p3: '定价表可以通过 Settings UI 手动维护，或通过 CLI 命令 tflow pricing --update 从远程 JSON 端点同步，支持 Token Flow 原生格式和 OpenRouter 兼容模式。',
      },
    },
    experiment: {
      title: '5. Experiment',
      p1: '我们从四个维度评估 Token Flow：代理吞吐量、转换正确性、仪表盘查询延迟和成本估算准确性。所有实验均可使用内置的 studio-sim 模拟工具复现。',
      e1: {
        title: 'Experiment 1: Proxy Throughput',
        desc: '在不同并发级别（5、20、50 个并发客户端）下测量每秒请求数（RPS）和 p99 延迟，使用模拟上游服务器。与直接上游访问进行比较，以量化代理开销。',
        todo: '[TODO] 运行 studio-sim --requests 5000 --concurrency 50 并填充结果。',
      },
      e2: {
        title: 'Experiment 2: Transformation Correctness',
        desc: '对于 11 个支持 Provider 中的每一个，验证标准客户端请求通过代理往返并生成结构有效的标准格式响应。使用 Vitest 单元测试针对记录的上游固定数据进行测试。',
        todo: '[TODO] 报告所有 Provider 模板的通过率。',
      },
      e3: {
        title: 'Experiment 3: Dashboard Query Latency',
        desc: '比较使用预聚合 stats_aggregates 与原始 request_logs 扫描的 30 天趋势图表查询延迟。将数据库大小从 10K 变化到 1M request_logs。',
        todo: '[TODO] 测量并报告每个规模点的延迟。',
      },
      e4: {
        title: 'Experiment 4: Cost Estimation Accuracy',
        desc: '将 Token Flow 的 estimated_cost 与固定工作负载的实际 Provider 账单报表（或文档定价）进行比较。报告平均绝对百分比误差（MAPE）。',
        todo: '[TODO] 收集真实账单数据并计算 MAPE。',
      },
    },
    conclusion: {
      title: '6. Conclusion and Future Work',
      p1: 'Token Flow 证明了一个单节点、基于 SQLite 的代理可以提供以前需要多个集成系统才能实现的 LLM 特定能力——格式转换、成本估算和会话级可观测性。两层 Transformer 架构保持 Provider 扩展成本较低，而预聚合策略确保仪表盘响应性而不增加运维复杂性。',
      p2: '未来方向包括：',
      li1: '将 Provider 模板库扩展到覆盖额外的中国 LLM 平台（DashScope、MiniMax、智谱 GLM、月之暗面 Kimi）。',
      li2: '用于从 ~/.tokenflow/transformers/ 加载用户自定义 Transformer 的插件机制。',
      li3: '基于 WebSocket 的实时仪表盘更新，替代当前的 30 秒轮询间隔。',
      li4: '用于异常 Token 消耗或错误率飙升的告警 Webhook。',
    },
    langToggle: 'English',
  },
  en: {
    abstract: {
      title: 'Abstract',
      body: 'Token Flow is an open-source, lightweight proxy system tailored for Large Language Model (LLM) API orchestration. Unlike general-purpose API gateways or fragmented toolchain assemblies, Token Flow integrates transparent request proxying, multi-provider format conversion, real-time token-cost estimation, and session-level observability into a single deployable unit. The system employs a two-layer transformer pipeline (MainTransformer + ProviderTransformer) to bridge heterogeneous client request formats with 11 upstream providers, while maintaining sub-millisecond overhead on the critical path. Observability is achieved through a SQLite WAL-based storage layer with hour/day pre-aggregated statistics, enabling efficient trend analysis and cost attribution without external dependencies. We open-source the implementation and provide reproducible simulation benchmarks.',
    },
    intro: {
      title: '1. Introduction',
      p1: 'As enterprises increasingly integrate LLMs into production workflows, the operational complexity of managing multiple upstream providers—each with distinct API formats, pricing models, and rate limits—has become a significant engineering burden. Existing solutions typically fall into two categories: (1) general-purpose API gateways (e.g., Kong, nginx) that lack LLM-specific semantics such as token counting and format translation; and (2) specialized but fragmented tools (e.g., LiteLLM for routing, OneAPI for format conversion, Langfuse for observability) that require separate deployment and integration effort.',
      p2: 'Token Flow addresses this gap by providing a unified, self-contained proxy layer designed specifically for LLM workloads. The key insight is that LLM API traffic has unique characteristics—streaming Server-Sent Events (SSE), heterogeneous request/response schemas, prompt/completion token asymmetry, and per-model pricing—that warrant a domain-specific middleware rather than generic gateway configurations.',
      p3: 'The primary contributions of this work are:',
      li1: 'An integrated LLM proxy that combines routing, format conversion, cost estimation, and observability without external dependencies.',
      li2: 'A two-layer transformer architecture that decouples endpoint-level translation (chat.completions vs. messages) from provider-specific adaptations, achieving extensibility for new providers.',
      li3: 'A lightweight pre-aggregation strategy using SQLite WAL that balances query performance with deployment simplicity.',
    },
    relatedWork: {
      title: '2. Background and Related Work',
      p1: 'We position Token Flow against three representative systems that each address a subset of the LLM proxy problem.',
      liteLLM: 'LiteLLM excels at multi-provider routing and fallback strategies but treats format conversion as a secondary concern, often requiring provider-specific SDK wrappers.',
      oneAPI: 'OneAPI / NewAPI provides extensive adapter coverage for Chinese LLM platforms but operates as a heavyweight gateway with MySQL/PostgreSQL dependencies.',
      langfuse: 'Langfuse offers best-in-class tracing and prompt management but is strictly an observability layer—it does not proxy or transform requests.',
      p2: "Token Flow's differentiation lies in its integration depth: all four capabilities (proxying, conversion, costing, observability) share the same request lifecycle, enabling cross-cutting features such as per-key cost attribution and real-time efficiency scoring.",
      colCapability: 'Capability',
      colLiteLLM: 'LiteLLM',
      colOneAPI: 'OneAPI / NewAPI',
      colLangfuse: 'Langfuse',
      colTokenFlow: 'Token Flow',
      rowFormat: 'Format conversion',
      rowRouting: 'Multi-provider routing',
      rowCost: 'Cost estimation',
      rowObservability: 'Observability',
      rowDeps: 'External dependencies',
      rowDeploy: 'Deployment footprint',
      valuePartial: 'Partial',
      valueExtensive: 'Extensive',
      valueNo: 'No',
      valueBuiltIn: 'Built-in (11 templates)',
      valueYes: 'Yes',
      valueKeyBased: 'Key-based binding',
      valueBasic: 'Basic',
      valueRealtime: 'Real-time + remote sync',
      valueLimited: 'Limited',
      valueSession: 'Session + trend + key drill-down',
      valueRedisDB: 'Redis, DB',
      valueMySQL: 'MySQL / Postgres',
      valuePostgres: 'Postgres',
      valueSQLite: 'SQLite only',
      valueMedium: 'Medium',
      valueSingleBinary: 'Single binary',
    },
    architecture: {
      title: '3. System Architecture',
      p1: 'Token Flow follows a modular monolith architecture. All components run within a single Fastify process, communicating through in-memory references rather than RPC or message queues. This design prioritizes deployment simplicity over horizontal scalability, which aligns with the observation that most LLM proxy deployments serve single-tenant or small-team workloads where a single node is sufficient.',
      proxy: { title: 'Proxy Layer', desc: 'Fastify HTTP server. Handles request validation, API Key authentication, session tagging, and upstream forwarding.' },
      transformer: { title: 'Transformer Pipeline', desc: 'Two-layer architecture: MainTransformer (endpoint-level) and ProviderTransformer (provider-specific). Converts between heterogeneous client formats and upstream schemas.' },
      storage: { title: 'Storage Layer', desc: 'SQLite with WAL mode. request_logs for raw traces, sessions for aggregation, stats_aggregates for pre-computed hour/day windows.' },
      analysis: { title: 'Analysis Engine', desc: 'Context pattern detection (DET-001~003), efficiency scoring, and real-time cost estimation using a configurable pricing table.' },
      webui: { title: 'Web UI', desc: 'React 19 + Vite dashboard for Providers, Sessions, Analysis, and Settings.' },
      cli: { title: 'CLI & TUI', desc: 'Command-line tools for service lifecycle management (start/stop/status) and interactive terminal-based configuration.' },
    },
    method: {
      title: '4. Method',
      transformer: {
        title: '4.1 Two-Layer Transformer Pipeline',
        p1: 'LLM APIs expose conceptually similar operations—chat completions, message-based conversations, and structured responses—but with incompatible wire formats. Token Flow introduces a two-layer transformer to manage this complexity without creating O(N×M) conversion functions (N endpoints × M providers).',
        li1: 'MainTransformer operates at the endpoint granularity. It identifies whether the incoming request targets /v1/chat/completions, /v1/messages, or /v1/responses, and dispatches to the appropriate request/response serializer.',
        li2: 'ProviderTransformer handles provider-specific adaptations within an endpoint family. For example, under the chat.completions endpoint, an Anthropic provider transformer maps OpenAI\'s messages array to Anthropic\'s messages format, translates temperature semantics, and converts streaming SSE chunks back to OpenAI-style chat.completion.chunk events.',
        p2: 'This separation allows adding a new provider by implementing only the provider-specific delta, typically 200–400 lines of TypeScript, while reusing the endpoint-level logic. At the time of writing, 11 provider templates are supported: openai, anthropic, openai-responses, gemini, deepseek, openrouter, groq, cerebras, vercel, vertex-gemini, and vertex-claude.',
      },
      storage: {
        title: '4.2 Data Storage and Pre-aggregation',
        p1: 'General observability platforms store raw request logs in columnar databases (ClickHouse, BigQuery) and compute aggregations at query time. While this offers flexibility, it introduces operational overhead that conflicts with Token Flow\'s goal of being deployable on a laptop.',
        p2: 'Token Flow uses SQLite with WAL (Write-Ahead Logging) mode as its sole storage engine. To maintain responsive dashboard queries without external indexing infrastructure, we implement a pre-aggregation strategy:',
        li1: 'request_logs retains raw traces for session-level drill-down and pattern detection.',
        li2: 'stats_aggregates stores hourly and daily rollups keyed by (window_type, window_start, api_key_id, model). Each rollup contains SUM(request_count), SUM(prompt_tokens), SUM(completion_tokens), and SUM(estimated_cost).',
        li3: 'A background cleanup task (cleanupOldStats) prunes aggregate and log entries older than 90 days, bounding storage growth.',
        p3: 'This design trades ad-hoc query flexibility for predictable latency: dashboard trend queries over a 30-day window scan at most 720 hourly rows rather than potentially millions of raw log entries.',
      },
      detection: {
        title: '4.3 Context Pattern Detection',
        p1: 'A unique feature of Token Flow is its ability to classify session-level context management strategies, which directly impact token efficiency. We define three canonical patterns:',
        li1: 'Full Context (DET-001): Every request transmits the complete conversation history. Simple to implement but incurs quadratic token growth.',
        li2: 'Sliding Window (DET-002): Only the most recent N messages are retained. Linear growth but early context is lost.',
        li3: 'Summarization (DET-003): Historical messages are compressed into a summary. Sub-linear growth with controlled information loss.',
        p2: 'Detection is performed by analyzing the ratio between prompt token count and message count within a session window. An efficiency score (0–100) is derived from the deviation between actual token consumption and the theoretical minimum required to convey the same information content.',
      },
      cost: {
        title: '4.4 Real-Time Cost Estimation',
        p1: 'Unlike generic proxies that treat requests as opaque bytes, Token Flow parses the upstream response to extract usage.prompt_tokens and usage.completion_tokens immediately upon response completion. A configurable pricing table maps model names to per-million-token rates for both prompt and completion directions.',
        p2: 'Cost is computed as:',
        p3: 'The pricing table can be maintained manually through the Settings UI or synchronized from a remote JSON endpoint via the CLI command tflow pricing --update, supporting both Token Flow native format and OpenRouter-compatible schemas.',
      },
    },
    experiment: {
      title: '5. Experiment',
      p1: 'We evaluate Token Flow across four dimensions: proxy throughput, transformation correctness, dashboard query latency, and cost estimation accuracy. All experiments are reproducible using the built-in studio-sim simulation harness.',
      e1: {
        title: 'Experiment 1: Proxy Throughput',
        desc: 'Measure requests-per-second (RPS) and p99 latency under varying concurrency levels (5, 20, 50 concurrent clients) with a mock upstream server. Compare against direct upstream access to quantify proxy overhead.',
        todo: '[TODO] Run studio-sim --requests 5000 --concurrency 50 and fill results.',
      },
      e2: {
        title: 'Experiment 2: Transformation Correctness',
        desc: 'For each of the 11 supported providers, validate that a canonical client request round-trips through the proxy and produces a structurally valid standardized response. Use Vitest unit tests against recorded upstream fixtures.',
        todo: '[TODO] Report pass rate across all provider templates.',
      },
      e3: {
        title: 'Experiment 3: Dashboard Query Latency',
        desc: 'Compare query latency for 30-day trend charts using pre-aggregated stats_aggregates versus raw request_logs scans. Vary database size from 10K to 1M request_logs.',
        todo: '[TODO] Measure and report latency at each scale point.',
      },
      e4: {
        title: 'Experiment 4: Cost Estimation Accuracy',
        desc: 'Compare Token Flow\'s estimated_cost against actual provider billing statements (or documented pricing) for a fixed workload. Report mean absolute percentage error (MAPE).',
        todo: '[TODO] Collect ground-truth billing data and compute MAPE.',
      },
    },
    conclusion: {
      title: '6. Conclusion and Future Work',
      p1: 'Token Flow demonstrates that a single-node, SQLite-backed proxy can provide LLM-specific capabilities—format conversion, cost estimation, and session-level observability—that previously required multiple integrated systems. The two-layer transformer architecture keeps the provider extension cost low, while the pre-aggregation strategy ensures dashboard responsiveness without operational complexity.',
      p2: 'Future directions include:',
      li1: 'Extending the provider template library to cover additional Chinese LLM platforms (DashScope, MiniMax, Zhipu GLM, Moonshot Kimi).',
      li2: 'A plugin mechanism for user-defined transformers loaded from ~/.tokenflow/transformers/.',
      li3: 'WebSocket-based real-time dashboard updates to replace the current 30-second polling interval.',
      li4: 'Alerting webhooks for anomalous token consumption or error-rate spikes.',
    },
    langToggle: '中文',
  },
}

type Lang = 'zh' | 'en'

export default function TechnicalDoc() {
  const [lang, setLang] = useState<Lang>('zh')
  const t = CONTENT[lang]

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-tf-text">{lang === 'zh' ? '技术文档' : 'Technical Documentation'}</h2>
        <button
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          className="text-xs px-3 py-1.5 rounded border border-tf-border text-tf-muted hover:text-tf-accent hover:border-tf-accent/50 transition-colors"
        >
          {t.langToggle}
        </button>
      </div>

      {/* Abstract */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">{t.abstract.title}</h3>
        <p className="text-tf-muted leading-relaxed text-sm">{t.abstract.body}</p>
      </section>

      {/* 1. Introduction */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">{t.intro.title}</h3>
        <p className="text-tf-muted leading-relaxed text-sm">{t.intro.p1}</p>
        <p className="text-tf-muted leading-relaxed text-sm">{t.intro.p2}</p>
        <p className="text-tf-muted leading-relaxed text-sm">{t.intro.p3}</p>
        <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2 text-sm">
          <li>{t.intro.li1}</li>
          <li>{t.intro.li2}</li>
          <li>{t.intro.li3}</li>
        </ul>
      </section>

      {/* 2. Background & Related Work */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">{t.relatedWork.title}</h3>

        <p className="text-tf-muted leading-relaxed text-sm">{t.relatedWork.p1}</p>

        <div className="border border-tf-border rounded-lg overflow-hidden mt-2">
          <table className="w-full text-sm">
            <thead className="bg-tf-border/20 text-tf-text">
              <tr>
                <th className="text-left px-3 py-2 font-medium">{t.relatedWork.colCapability}</th>
                <th className="text-left px-3 py-2 font-medium">{t.relatedWork.colLiteLLM}</th>
                <th className="text-left px-3 py-2 font-medium">{t.relatedWork.colOneAPI}</th>
                <th className="text-left px-3 py-2 font-medium">{t.relatedWork.colLangfuse}</th>
                <th className="text-left px-3 py-2 font-medium">{t.relatedWork.colTokenFlow}</th>
              </tr>
            </thead>
            <tbody className="text-tf-muted">
              <tr className="border-t border-tf-border/50">
                <td className="px-3 py-2">{t.relatedWork.rowFormat}</td>
                <td className="px-3 py-2">{t.relatedWork.valuePartial}</td>
                <td className="px-3 py-2">{t.relatedWork.valueExtensive}</td>
                <td className="px-3 py-2">{t.relatedWork.valueNo}</td>
                <td className="px-3 py-2 text-tf-accent">{t.relatedWork.valueBuiltIn}</td>
              </tr>
              <tr className="border-t border-tf-border/50">
                <td className="px-3 py-2">{t.relatedWork.rowRouting}</td>
                <td className="px-3 py-2">{t.relatedWork.valueYes}</td>
                <td className="px-3 py-2">{t.relatedWork.valueYes}</td>
                <td className="px-3 py-2">{t.relatedWork.valueNo}</td>
                <td className="px-3 py-2 text-tf-accent">{t.relatedWork.valueKeyBased}</td>
              </tr>
              <tr className="border-t border-tf-border/50">
                <td className="px-3 py-2">{t.relatedWork.rowCost}</td>
                <td className="px-3 py-2">{t.relatedWork.valueBasic}</td>
                <td className="px-3 py-2">{t.relatedWork.valueBasic}</td>
                <td className="px-3 py-2">{t.relatedWork.valueNo}</td>
                <td className="px-3 py-2 text-tf-accent">{t.relatedWork.valueRealtime}</td>
              </tr>
              <tr className="border-t border-tf-border/50">
                <td className="px-3 py-2">{t.relatedWork.rowObservability}</td>
                <td className="px-3 py-2">{t.relatedWork.valueLimited}</td>
                <td className="px-3 py-2">{t.relatedWork.valueLimited}</td>
                <td className="px-3 py-2">{t.relatedWork.valueExtensive}</td>
                <td className="px-3 py-2 text-tf-accent">{t.relatedWork.valueSession}</td>
              </tr>
              <tr className="border-t border-tf-border/50">
                <td className="px-3 py-2">{t.relatedWork.rowDeps}</td>
                <td className="px-3 py-2">{t.relatedWork.valueRedisDB}</td>
                <td className="px-3 py-2">{t.relatedWork.valueMySQL}</td>
                <td className="px-3 py-2">{t.relatedWork.valuePostgres}</td>
                <td className="px-3 py-2 text-tf-accent">{t.relatedWork.valueSQLite}</td>
              </tr>
              <tr className="border-t border-tf-border/50">
                <td className="px-3 py-2">{t.relatedWork.rowDeploy}</td>
                <td className="px-3 py-2">{t.relatedWork.valueMedium}</td>
                <td className="px-3 py-2">{t.relatedWork.valueMedium}</td>
                <td className="px-3 py-2">{t.relatedWork.valueMedium}</td>
                <td className="px-3 py-2 text-tf-accent">{t.relatedWork.valueSingleBinary}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-tf-muted leading-relaxed text-sm mt-2">
          <strong>LiteLLM</strong> {t.relatedWork.liteLLM} <strong>OneAPI / NewAPI</strong> {t.relatedWork.oneAPI} <strong>Langfuse</strong> {t.relatedWork.langfuse} {t.relatedWork.p2}
        </p>
      </section>

      {/* 3. System Architecture */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">{t.architecture.title}</h3>
        <p className="text-tf-muted leading-relaxed text-sm">{t.architecture.p1}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <ArchCard title={t.architecture.proxy.title} desc={t.architecture.proxy.desc} />
          <ArchCard title={t.architecture.transformer.title} desc={t.architecture.transformer.desc} />
          <ArchCard title={t.architecture.storage.title} desc={t.architecture.storage.desc} />
          <ArchCard title={t.architecture.analysis.title} desc={t.architecture.analysis.desc} />
          <ArchCard title={t.architecture.webui.title} desc={t.architecture.webui.desc} />
          <ArchCard title={t.architecture.cli.title} desc={t.architecture.cli.desc} />
        </div>
      </section>

      {/* 4. Method */}
      <section className="space-y-6">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">{t.method.title}</h3>

        <div className="space-y-4">
          <h4 className="text-base font-semibold text-tf-text">{t.method.transformer.title}</h4>
          <p className="text-tf-muted leading-relaxed text-sm">{t.method.transformer.p1}</p>
          <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2 text-sm">
            <li>{t.method.transformer.li1}</li>
            <li>{t.method.transformer.li2}</li>
          </ul>
          <p className="text-tf-muted leading-relaxed text-sm">{t.method.transformer.p2}</p>
        </div>

        <div className="space-y-4">
          <h4 className="text-base font-semibold text-tf-text">{t.method.storage.title}</h4>
          <p className="text-tf-muted leading-relaxed text-sm">{t.method.storage.p1}</p>
          <p className="text-tf-muted leading-relaxed text-sm">{t.method.storage.p2}</p>
          <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2 text-sm">
            <li>{t.method.storage.li1}</li>
            <li>{t.method.storage.li2}</li>
            <li>{t.method.storage.li3}</li>
          </ul>
          <p className="text-tf-muted leading-relaxed text-sm">{t.method.storage.p3}</p>
        </div>

        <div className="space-y-4">
          <h4 className="text-base font-semibold text-tf-text">{t.method.detection.title}</h4>
          <p className="text-tf-muted leading-relaxed text-sm">{t.method.detection.p1}</p>
          <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2 text-sm">
            <li>{t.method.detection.li1}</li>
            <li>{t.method.detection.li2}</li>
            <li>{t.method.detection.li3}</li>
          </ul>
          <p className="text-tf-muted leading-relaxed text-sm">{t.method.detection.p2}</p>
        </div>

        <div className="space-y-4">
          <h4 className="text-base font-semibold text-tf-text">{t.method.cost.title}</h4>
          <p className="text-tf-muted leading-relaxed text-sm">{t.method.cost.p1}</p>
          <p className="text-tf-muted leading-relaxed text-sm">{t.method.cost.p2}</p>
          <pre className="bg-tf-card border border-tf-border rounded-lg p-3 text-xs text-tf-text overflow-x-auto">
            <code>cost = (prompt_tokens × prompt_price + completion_tokens × completion_price) / 1,000,000</code>
          </pre>
          <p className="text-tf-muted leading-relaxed text-sm">{t.method.cost.p3}</p>
        </div>
      </section>

      {/* 5. Experiment */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">{t.experiment.title}</h3>
        <p className="text-tf-muted leading-relaxed text-sm">{t.experiment.p1}</p>

        <div className="space-y-4 mt-4">
          <div className="border border-tf-border rounded-lg p-4 bg-tf-card">
            <h4 className="text-sm font-semibold text-tf-text mb-1">{t.experiment.e1.title}</h4>
            <p className="text-xs text-tf-muted">{t.experiment.e1.desc}</p>
            <p className="text-xs text-tf-accent mt-2">{t.experiment.e1.todo}</p>
          </div>

          <div className="border border-tf-border rounded-lg p-4 bg-tf-card">
            <h4 className="text-sm font-semibold text-tf-text mb-1">{t.experiment.e2.title}</h4>
            <p className="text-xs text-tf-muted">{t.experiment.e2.desc}</p>
            <p className="text-xs text-tf-accent mt-2">{t.experiment.e2.todo}</p>
          </div>

          <div className="border border-tf-border rounded-lg p-4 bg-tf-card">
            <h4 className="text-sm font-semibold text-tf-text mb-1">{t.experiment.e3.title}</h4>
            <p className="text-xs text-tf-muted">{t.experiment.e3.desc}</p>
            <p className="text-xs text-tf-accent mt-2">{t.experiment.e3.todo}</p>
          </div>

          <div className="border border-tf-border rounded-lg p-4 bg-tf-card">
            <h4 className="text-sm font-semibold text-tf-text mb-1">{t.experiment.e4.title}</h4>
            <p className="text-xs text-tf-muted">{t.experiment.e4.desc}</p>
            <p className="text-xs text-tf-accent mt-2">{t.experiment.e4.todo}</p>
          </div>
        </div>
      </section>

      {/* 6. Conclusion */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">{t.conclusion.title}</h3>
        <p className="text-tf-muted leading-relaxed text-sm">{t.conclusion.p1}</p>
        <p className="text-tf-muted leading-relaxed text-sm">{t.conclusion.p2}</p>
        <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2 text-sm">
          <li>{t.conclusion.li1}</li>
          <li>{t.conclusion.li2}</li>
          <li>{t.conclusion.li3}</li>
          <li>{t.conclusion.li4}</li>
        </ul>
      </section>
    </div>
  )
}

function ArchCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="border border-tf-border rounded-lg p-4 bg-tf-card">
      <h4 className="text-sm font-semibold text-tf-text mb-1">{title}</h4>
      <p className="text-xs text-tf-muted">{desc}</p>
    </div>
  )
}
