import { useState, useEffect, useLayoutEffect } from 'react'

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
      p1: '我们将 Token Flow 与五个代表性系统进行定位，每个系统分别解决了 LLM 代理问题的一个子集。',
      liteLLM: '在多 Provider 路由和回退策略方面表现出色，但将格式转换视为次要关注点，通常需要 Provider 特定的 SDK 包装器。',
      oneAPI: '为中国 LLM 平台提供了广泛的适配器覆盖，但作为重量级网关运行，依赖 MySQL/PostgreSQL。',
      langfuse: '提供了一流的追踪和提示管理，但严格来说只是一个可观测性层——它不代理或转换请求。',
      claudeRouter: '是 Anthropic 官方 CLI 的内置模型切换机制，支持在同一工作区内选择不同 Claude 模型，但仅限于 Anthropic 生态，不涉及多 Provider 代理或成本追踪。',
      claudeSwitch: '用于在多个 Claude Code 项目/工作区之间切换配置，本质上是客户端环境管理工具，不参与请求代理。',
      p2: 'Token Flow 的差异化在于其集成深度：四种能力（代理、转换、计费、可观测性）共享同一个请求生命周期，从而实现了跨领域功能，如按 Key 成本归因和实时效率评分。',
      colCapability: '能力',
      colLiteLLM: 'LiteLLM',
      colOneAPI: 'OneAPI / NewAPI',
      colLangfuse: 'Langfuse',
      colClaudeRouter: 'Claude Code Router',
      colClaudeSwitch: 'Claude Code Switch',
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
      valueSession: '会话 + 趋势 + Key 详情展开',
      valueInternal: '内部模型切换',
      valueProjectSwitch: '项目配置切换',
      valueRedisDB: 'Redis, DB',
      valueMySQL: 'MySQL / Postgres',
      valuePostgres: 'Postgres',
      valueSQLite: '仅 SQLite',
      valueNone: '无',
      valueMedium: '中等',
      valueSingleBinary: '单一二进制',
      valueCliBuiltin: 'CLI 内置',
    },
    architecture: {
      title: '3. System Architecture',
      p1: 'Token Flow 采用模块化单体架构。所有组件运行在单个 Fastify 进程内，通过内存引用而非 RPC 或消息队列进行通信。这种设计优先考虑部署简单性而非水平可扩展性，这与大多数 LLM 代理部署服务于单租户或小团队工作负载、单节点即足够的观察一致。',
      p2: '除核心代理流水线外，系统配套 React 19 + Vite Web 仪表盘（Providers、Sessions、Analysis、Settings）以及用于服务生命周期管理和交互式配置的 CLI / TUI 工具。',
      diagram: {
        client: 'Client',
        clientSub: 'SDK / Browser / cURL',
        proxy: 'Token Flow Proxy',
        proxySub: 'Fastify · Auth · Session · Routing',
        proxyItems: ['请求校验 & API Key 认证', '会话绑定与生命周期', '上游 Provider 转发'],
        transformer: 'Transformer Pipeline',
        transformerSub: 'MainTransformer → ProviderTransformer',
        transformerItems: ['端点级协议转换', 'Provider 模板适配'],
        upstream: 'Upstream Providers',
        upstreamSub: '11 种 Provider 模板',
        upstreamItems: ['OpenAI · Anthropic · Gemini · DeepSeek · Groq · Cerebras · Vertex · OpenRouter · Vercel'],
        storage: 'Storage Layer',
        storageSub: 'SQLite WAL',
        storageItems: ['request_logs 全量追踪', 'sessions 聚合', 'stats_aggregates 小时/天窗口'],
        analysisEngine: 'Traffic Analyzer',
        analysisEngineSub: '可插拔流量分析：Transformer 内置 / Client SDK / 独立服务',
        analysisEngineItems: ['0-01~0-03 流量分析', '0-04~0-08 扩展接口（预留）', '探针接口 Probe（TODO）', '插件注册机制'],
        costStats: 'Cost & Stats',
        costStatsSub: '实时计费 & 可视化',
        costStatsItems: ['模型单价 × Token 量', 'Key 维度趋势图', '请求明细溯源'],
      },
    },
    method: {
      title: '4. Method',
      transformer: {
        title: '4.1 Two-Layer Transformer Pipeline',
        p1: 'LLM API 暴露了概念上相似的操作——聊天补全、基于消息的对话和结构化响应——但具有不兼容的传输格式。Token Flow 引入了两层 Transformer 来管理这种复杂性，而无需创建 O(N×M) 转换函数（N 端点 × M Provider）。',
        li1: 'MainTransformer 在端点粒度上运行。它识别传入请求的目标是 /v1/chat/completions、/v1/messages 还是 /v1/responses，并调度到适当的请求/响应序列化器。',
        li2: 'ProviderTransformer 处理端点族内的 Provider 特定适配。例如，在 chat.completions 端点下，Anthropic Provider Transformer 将 OpenAI 的 messages 数组映射到 Anthropic 的 messages 格式，转换 temperature 语义，并将流式 SSE 块转换回 OpenAI 风格的 chat.completion.chunk 事件。',
        p2: '这种分离允许通过仅实现 Provider 特定差异来添加新 Provider，通常只需 200–400 行 TypeScript，同时复用端点级逻辑。截至目前，支持 11 种 Provider 模板：openai、anthropic、openai-responses、gemini、deepseek、openrouter、groq、cerebras、vercel、vertex-gemini 和 vertex-claude。',
        diagramN: 'N 端点',
        diagramM: 'M Provider',
        mainTransformerSub: '端点级归一化',
        providerTransformerSub: 'Provider 特定适配',
      },
      storage: {
        title: '4.2 Data Storage and Pre-aggregation',
        p1: 'Token Flow 持久化三类数据，为后续分析提供基础：',
        li1: 'request_logs 保留原始请求追踪，支持会话级详情查看、模式检测和自定义分析。',
        li2: 'stats_aggregates 按 (window_type, window_start, api_key_id, model) 存储小时和天级别汇总，包含请求数、Token 量和预估成本，确保趋势查询无需扫描全量日志。',
        li3: 'sessions 聚合同一 session 的多条请求，用于上下文模式检测和效率评分。',
        p2: '后台清理任务会修剪超过 90 天的旧数据，限制存储增长。',
      },
      detection: {
        title: '4.3 Context Pattern Detection',
        p1: 'Token Flow 的一个独特功能是其对会话级上下文管理策略进行分类的能力，这直接影响 Token 效率。我们定义了三种典型模式：',
        li1: 'Full Context (0-01)：每次请求传输完整的对话历史。实现简单，但导致二次 Token 增长。',
        li2: 'Sliding Window (0-02)：仅保留最近的 N 条消息。线性增长，但早期上下文会丢失。',
        li3: 'Summarization (0-03)：历史消息被压缩为摘要。次线性增长，受控的信息损失。',
        p2: '检测通过分析会话窗口内提示 Token 数量与消息数量之间的比率来执行。效率评分（0–100）根据实际 Token 消耗与传达相同信息内容的理论最小值之间的偏差推导得出。',
        p3: '当前局限：三个 Detector 的置信度阈值（0.3）和信号权重基于启发式设定，尚未通过受控实验进行系统调优。我们没有针对每个 Detector 设计独立的验证实验来确认超参数的合理性，也没有资源研发 0-04 及以后的扩展检测器。因此，当前的模式分类结果应视为实验性特征，而非经过严格验证的诊断工具。',
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
      p1: '我们从七个维度评估 Token Flow：转换正确性、仪表盘查询延迟、成本估算准确性、上下文策略调研、数据集构建、被动上下文模式检测和主动探针设计。',
      e1: {
        title: 'Experiment 1: Transformation Correctness',
        desc: '用 mock 的 Provider 和 mock 的用户请求，把 11 个 Provider 模板逐个跑一遍，确认请求能正常转发并返回结构有效的响应。',
        strategy: '搭建 mock upstream 模拟各 Provider 响应；Vitest 单元测试覆盖 Transformer 核心逻辑；集成测试验证端到端 pipeline 往返。',
        script: 'pnpm test（tests/unit/ + tests/integration/）',
        result: '单元测试 98 passed / 13 files；集成测试 4 passed / 2 files。',
        summary: '大白话：就是搭了个假环境，把每个 Provider 都跑了一遍，看看格式转换有没有写错。',
      },
      e2: {
        title: 'Experiment 2: Dashboard Query Latency',
        desc: 'Dashboard 涉及大规模数据读取，因此使用预聚合表来缓存分析结果。比较预聚合查询与原始日志扫描的延迟差异。',
        strategy: '用 better-sqlite3 在 :memory: 数据库生成不同规模的测试数据，分别执行两种查询并计时。',
        script: 'scripts/bench-query-latency.ts',
        result: '预聚合查询稳定在 ~0.05 ms；原始日志扫描随数据量线性增长：10K→1.7 ms、50K→9.0 ms、100K→18.7 ms、500K→106 ms。差距约 2,000 倍。',
        summary: '大白话：Dashboard 要读大量数据，所以用一个缓存表存分析结果，读缓存比读原始日志快约 2000 倍。',
      },
      e3: {
        title: 'Experiment 3: Cost Estimation Accuracy',
        desc: '验证定价解析和成本计算的准确性。',
        strategy: '单元测试覆盖 resolvePricing（精确匹配、provider 前缀剥离）和 computeCost（已知模型定价 × token 量），确保所有 studio-sim 模型均有定价。',
        script: 'tests/unit/pricing.test.ts',
        result: '12 个测试全部通过，覆盖 18 个模型（含前缀形式）。',
        summary: '大白话：确认算钱没算错，每个支持的模型都有正确的单价和计算公式。',
      },
      e4: {
        title: 'Experiment 4: Context Strategy Survey',
        desc: '调研当前市面上主流 LLM 应用的上下文管理策略，建立分类体系。',
        strategy: '通过文献调研与产品分析，梳理 ChatGPT、Claude、Cursor、Coze、Dify 等系统的上下文处理方式。',
        table: [
          { label: '方法', value: '文献调研 + 产品逆向分析' },
          { label: '调研对象', value: '① OpenCoder（开源优先） ② Codex ③ Claude Code（曾泄露，可参考） ④ ChatGPT / Claude / Cursor / Coze / Dify（闭源，优先级降低）' },
          { label: '目标', value: '总结现有上下文管理策略的分类体系，为后续检测实验提供参照基线' },
        ],
        todo: '[TODO] 完成系统性调研并整理分类表格。',
      },
      e5: {
        title: 'Experiment 5: Dataset Selection',
        desc: '选择并构建适用于上下文管理策略检测的评测数据集，按领域划分并对比不同数据源的特征。',
        strategy: '从三个方向收集数据：公开多轮对话数据集、studio-sim 模拟流量、按领域人工构造的合成数据。',
        table: [
          { label: '数据源', value: '① ShareGPT 等公开数据集 ② studio-sim 模拟流量 ③ 人工构造合成数据' },
          { label: '领域划分', value: 'Coding / Customer Service / Creative Writing / Research / Agent Tool-Use' },
          { label: '目标', value: '建立覆盖多领域的基准数据集，为 0-01~0-03 的检测提供统一评测基础' },
        ],
        todo: '[TODO] 确定数据集来源、清洗策略与领域比例。',
      },
      e6: {
        title: 'Experiment 6: Passive Traffic Analysis',
        desc: '基于代理层采集的流量特征，对会话级上下文管理策略进行分类。',
        strategy: '被动分析基于消息结构、token 增长曲线、消息长度分布等零入侵特征。',
        table: [
          { label: '方法', value: '被动流量分析（代理层观察，零入侵）' },
          { label: '输入特征', value: 'messages 结构、token 增长曲线、消息长度分布' },
          { label: '评估指标', value: '分类一致性、领域泛化能力' },
          { label: '目标', value: '评估 0-01~0-03 在不同领域下的检测准确率与一致性' },
        ],
        todo: '[TODO] 在 E5 数据集上跑通被动检测流程，建立基线对比。',
      },
      e7: {
        title: 'Experiment 7: Active Probe Design',
        desc: '探索主动探针作为被动分析的补充手段。',
        strategy: '主动探针通过构造特定输入并观察响应行为来推断上下文策略。',
        table: [
          { label: '方法', value: '主动探针（构造输入→观察响应，高准确度但有入侵性）' },
          { label: '实验设计', value: '与 E6 共用同一份数据集，对比两种范式在相同场景下的一致性差异' },
          { label: '目标', value: '为 1-xx 探针系列建立方法论基础' },
          { label: '状态', value: '探针接口已在 Architecture Diagram 中预留' },
        ],
        todo: '[TODO] 设计探针范式框架，与被动分析形成对照实验。',
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
      p1: 'We position Token Flow against five representative systems that each address a subset of the LLM proxy problem.',
      liteLLM: 'Excels at multi-provider routing and fallback strategies but treats format conversion as a secondary concern, often requiring provider-specific SDK wrappers.',
      oneAPI: 'Provides extensive adapter coverage for Chinese LLM platforms but operates as a heavyweight gateway with MySQL/PostgreSQL dependencies.',
      langfuse: 'Offers best-in-class tracing and prompt management but is strictly an observability layer—it does not proxy or transform requests.',
      claudeRouter: 'The built-in model-switching mechanism of the Anthropic official CLI. It supports selecting different Claude models within a single workspace but is limited to the Anthropic ecosystem and does not handle multi-provider proxying or cost tracking.',
      claudeSwitch: 'Used to toggle between multiple Claude Code projects/workspaces. It is fundamentally a client-side environment management tool and does not participate in request proxying.',
      p2: "Token Flow's differentiation lies in its integration depth: all four capabilities (proxying, conversion, costing, observability) share the same request lifecycle, enabling cross-cutting features such as per-key cost attribution and real-time efficiency scoring.",
      colCapability: 'Capability',
      colLiteLLM: 'LiteLLM',
      colOneAPI: 'OneAPI / NewAPI',
      colLangfuse: 'Langfuse',
      colClaudeRouter: 'Claude Code Router',
      colClaudeSwitch: 'Claude Code Switch',
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
      valueSession: 'Session + trend + key detail expansion',
      valueInternal: 'Internal model switch',
      valueProjectSwitch: 'Project config switch',
      valueRedisDB: 'Redis, DB',
      valueMySQL: 'MySQL / Postgres',
      valuePostgres: 'Postgres',
      valueSQLite: 'SQLite only',
      valueNone: 'None',
      valueMedium: 'Medium',
      valueSingleBinary: 'Single binary',
      valueCliBuiltin: 'CLI built-in',
    },
    architecture: {
      title: '3. System Architecture',
      p1: 'Token Flow follows a modular monolith architecture. All components run within a single Fastify process, communicating through in-memory references rather than RPC or message queues. This design prioritizes deployment simplicity over horizontal scalability, which aligns with the observation that most LLM proxy deployments serve single-tenant or small-team workloads where a single node is sufficient.',
      p2: 'Beyond the core proxy pipeline, the system ships with a React 19 + Vite web dashboard (Providers, Sessions, Analysis, Settings) and CLI / TUI tools for service lifecycle management and interactive configuration.',
      diagram: {
        client: 'Client',
        clientSub: 'SDK / Browser / cURL',
        proxy: 'Token Flow Proxy',
        proxySub: 'Fastify · Auth · Session · Routing',
        proxyItems: ['Request validation & API Key auth', 'Session binding & lifecycle', 'Upstream provider forwarding'],
        transformer: 'Transformer Pipeline',
        transformerSub: 'MainTransformer → ProviderTransformer',
        transformerItems: ['Endpoint-level protocol translation', 'Provider template adaptation'],
        upstream: 'Upstream Providers',
        upstreamSub: '11 Provider templates',
        upstreamItems: ['OpenAI · Anthropic · Gemini · DeepSeek · Groq · Cerebras · Vertex · OpenRouter · Vercel'],
        storage: 'Storage Layer',
        storageSub: 'SQLite WAL',
        storageItems: ['request_logs full tracing', 'sessions aggregation', 'stats_aggregates hour/day windows'],
        analysisEngine: 'Traffic Analyzer',
        analysisEngineSub: 'Pluggable traffic analysis: inline / client SDK / standalone',
        analysisEngineItems: ['0-01~0-03 traffic analysis', '0-04~0-08 extensible (planned)', 'Probe interface (TODO)', 'Plugin registry'],
        costStats: 'Cost & Stats',
        costStatsSub: 'Real-time billing & visualization',
        costStatsItems: ['Model price × token count', 'Key-level trend charts', 'Request traceability'],
      },
    },
    method: {
      title: '4. Method',
      transformer: {
        title: '4.1 Two-Layer Transformer Pipeline',
        p1: 'LLM APIs expose conceptually similar operations—chat completions, message-based conversations, and structured responses—but with incompatible wire formats. Token Flow introduces a two-layer transformer to manage this complexity without creating O(N×M) conversion functions (N endpoints × M providers).',
        li1: 'MainTransformer operates at the endpoint granularity. It identifies whether the incoming request targets /v1/chat/completions, /v1/messages, or /v1/responses, and dispatches to the appropriate request/response serializer.',
        li2: 'ProviderTransformer handles provider-specific adaptations within an endpoint family. For example, under the chat.completions endpoint, an Anthropic provider transformer maps OpenAI\'s messages array to Anthropic\'s messages format, translates temperature semantics, and converts streaming SSE chunks back to OpenAI-style chat.completion.chunk events.',
        p2: 'This separation allows adding a new provider by implementing only the provider-specific delta, typically 200–400 lines of TypeScript, while reusing the endpoint-level logic. At the time of writing, 11 provider templates are supported: openai, anthropic, openai-responses, gemini, deepseek, openrouter, groq, cerebras, vercel, vertex-gemini, and vertex-claude.',
        diagramN: 'N Endpoints',
        diagramM: 'M Providers',
        mainTransformerSub: 'Endpoint normalization',
        providerTransformerSub: 'Provider-specific adaptation',
      },
      storage: {
        title: '4.2 Data Storage and Pre-aggregation',
        p1: 'Token Flow persists three categories of data to enable downstream analysis:',
        li1: 'request_logs retains raw request traces, supporting session-level detail inspection, pattern detection, and custom analysis.',
        li2: 'stats_aggregates stores hourly and daily rollups keyed by (window_type, window_start, api_key_id, model), including request counts, token volumes, and estimated costs, ensuring trend queries do not require scanning full raw logs.',
        li3: 'sessions aggregates multiple requests under the same session for context pattern detection and efficiency scoring.',
        p2: 'A background cleanup task prunes data older than 90 days to bound storage growth.',
      },
      detection: {
        title: '4.3 Context Pattern Detection',
        p1: 'A unique feature of Token Flow is its ability to classify session-level context management strategies, which directly impact token efficiency. We define three canonical patterns:',
        li1: 'Full Context (0-01): Every request transmits the complete conversation history. Simple to implement but incurs quadratic token growth.',
        li2: 'Sliding Window (0-02): Only the most recent N messages are retained. Linear growth but early context is lost.',
        li3: 'Summarization (0-03): Historical messages are compressed into a summary. Sub-linear growth with controlled information loss.',
        p2: 'Detection is performed by analyzing the ratio between prompt token count and message count within a session window. An efficiency score (0–100) is derived from the deviation between actual token consumption and the theoretical minimum required to convey the same information content.',
        p3: 'Current limitations: The confidence threshold (0.3) and signal weights for all three detectors are set heuristically and have not been systematically tuned through controlled experiments. We have not designed dedicated validation experiments for each detector to confirm hyperparameter suitability, nor do we have the resources to develop extended detectors beyond 0-03. Consequently, the current pattern classifications should be regarded as experimental features rather than rigorously validated diagnostic tools.',
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
      p1: 'We evaluate Token Flow across seven dimensions: transformation correctness, dashboard query latency, cost estimation accuracy, context strategy survey, dataset construction, passive context-pattern detection, and active probe design.',
      e1: {
        title: 'Experiment 1: Transformation Correctness',
        desc: 'Use mock providers and mock user requests to run all 11 provider templates end-to-end, confirming requests forward correctly and return valid responses.',
        strategy: 'Set up mock upstream servers to simulate provider responses; Vitest unit tests cover Transformer core logic; integration tests validate end-to-end pipeline round-trips.',
        script: 'pnpm test (tests/unit/ + tests/integration/)',
        result: 'Unit tests: 98 passed / 13 files; Integration tests: 4 passed / 2 files.',
        summary: 'In plain terms: we built a fake environment and ran every provider through it to check if format conversions are correct.',
      },
      e2: {
        title: 'Experiment 2: Dashboard Query Latency',
        desc: 'Dashboard reads large amounts of data, so we use a pre-aggregated table to cache analysis results. Compare query latency between pre-aggregated and raw log scans.',
        strategy: 'Generate test data at different scales in an in-memory SQLite database via better-sqlite3, then time both query paths.',
        script: 'scripts/bench-query-latency.ts',
        result: 'Pre-aggregated queries remain stable at ~0.05 ms; raw scans grow linearly: 10K→1.7 ms, 50K→9.0 ms, 100K→18.7 ms, 500K→106 ms. Gap ~2,000×.',
        summary: 'In plain terms: Dashboard reads a lot of data, so we cache analysis results — reading cache is ~2000× faster than reading raw logs.',
      },
      e3: {
        title: 'Experiment 3: Cost Estimation Accuracy',
        desc: 'Validate pricing resolution and cost computation accuracy.',
        strategy: 'Unit tests cover resolvePricing (exact match, provider prefix stripping) and computeCost (known model price × token count), ensuring all studio-sim models have pricing.',
        script: 'tests/unit/pricing.test.ts',
        result: '12 tests passed, covering 18 models (including prefixed forms).',
        summary: 'In plain terms: this confirms the billing math is correct and every supported model has a valid price.',
      },
      e4: {
        title: 'Experiment 4: Context Strategy Survey',
        desc: 'Survey context management strategies used by mainstream LLM applications and establish a classification taxonomy.',
        strategy: 'Review literature and analyze products such as ChatGPT, Claude, Cursor, Coze, and Dify to understand their context handling approaches.',
        table: [
          { label: 'Method', value: 'Literature review + product reverse analysis' },
          { label: 'Targets', value: '① OpenCoder (open-source, high priority) ② Codex ③ Claude Code (leaked, consider) ④ ChatGPT / Claude / Cursor / Coze / Dify (closed-source, lower priority)' },
          { label: 'Goal', value: 'Summarize a taxonomy of existing context management strategies as a reference baseline for detection experiments' },
        ],
        todo: '[TODO] Complete systematic survey and compile classification table.',
      },
      e5: {
        title: 'Experiment 5: Dataset Selection',
        desc: 'Select and construct evaluation datasets suitable for context management strategy detection, split by domain and compare characteristics across data sources.',
        strategy: 'Collect data from three directions: public multi-turn dialogue datasets, studio-sim simulated traffic, and manually constructed synthetic data per domain.',
        table: [
          { label: 'Data Sources', value: '① Public datasets (e.g., ShareGPT) ② studio-sim traffic ③ Synthetic data per domain' },
          { label: 'Domain Split', value: 'Coding / Customer Service / Creative Writing / Research / Agent Tool-Use' },
          { label: 'Goal', value: 'Build a multi-domain benchmark dataset providing a unified evaluation base for 0-01~0-03 detection' },
        ],
        todo: '[TODO] Identify dataset sources, cleaning strategies, and domain proportions.',
      },
      e6: {
        title: 'Experiment 6: Passive Traffic Analysis',
        desc: 'Classify session-level context management strategies based on traffic features collected at the proxy layer.',
        strategy: 'Passive analysis relies on zero-intrusion features such as message structure, token growth curves, and message length distribution.',
        table: [
          { label: 'Method', value: 'Passive traffic analysis (proxy-layer observation, zero-intrusion)' },
          { label: 'Input Features', value: 'Message structure, token growth curves, message length distribution' },
          { label: 'Metrics', value: 'Classification consistency, cross-domain generalization' },
          { label: 'Goal', value: 'Evaluate detection accuracy and consistency of 0-01~0-03 across domains' },
        ],
        todo: '[TODO] Run passive detection on E5 dataset and establish baseline comparisons.',
      },
      e7: {
        title: 'Experiment 7: Active Probe Design',
        desc: 'Explore active probing as a complementary method to passive analysis.',
        strategy: 'Active probes infer context strategies by crafting specific inputs and observing response behavior.',
        table: [
          { label: 'Method', value: 'Active probing (crafted input → observe response, higher accuracy but invasive)' },
          { label: 'Experiment Design', value: 'Shares the same dataset with E6; compares consistency between paradigms under identical scenarios' },
          { label: 'Goal', value: 'Establish methodological foundation for the 1-xx probe series' },
          { label: 'Status', value: 'Probe interface reserved in Traffic Analyzer architecture' },
        ],
        todo: '[TODO] Design the probe paradigm framework and establish a controlled comparison with passive analysis.',
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

interface Comment {
  id: string
  sectionId: string
  sectionOrder: number
  author: 'user' | 'cooperator'
  content: string
  selectedText: string
  timestamp: number
}

type Lang = 'zh' | 'en'

const COMMENT_SECTIONS = [
  { value: 'abstract', label: 'Abstract' },
  { value: 'intro', label: 'Introduction' },
  { value: 'relatedWork', label: 'Related Work' },
  { value: 'architecture', label: 'Architecture' },
  { value: 'method', label: 'Method' },
  { value: 'experiment', label: 'Experiment' },
  { value: 'conclusion', label: 'Conclusion' },
]

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function getSelectionInfo(): { text: string; sectionId: string; sectionOrder: number } | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return null
  const text = sel.toString().trim()
  if (text.length < 2) return null

  const range = sel.getRangeAt(0)
  let node: Node = range.commonAncestorContainer
  if (node.nodeType === Node.TEXT_NODE) node = node.parentNode!
  const sectionEl = (node as HTMLElement).closest('section[data-section-id]')
  if (!sectionEl) return null

  const sectionId = sectionEl.getAttribute('data-section-id')!
  const preRange = range.cloneRange()
  preRange.selectNodeContents(sectionEl)
  preRange.setEnd(range.startContainer, range.startOffset)
  const sectionOrder = preRange.toString().length

  return { text, sectionId, sectionOrder }
}

function wrapSelectionWithTempHighlight(): HTMLSpanElement | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return null
  const range = sel.getRangeAt(0)

  const span = document.createElement('span')
  span.className = 'tf-temp-highlight'
  span.style.backgroundColor = 'rgba(234, 179, 8, 0.5)'
  span.style.borderRadius = '2px'

  try {
    range.surroundContents(span)
  } catch {
    const contents = range.extractContents()
    span.appendChild(contents)
    range.insertNode(span)
  }
  return span
}

function removeTempHighlights() {
  document.querySelectorAll('.tf-temp-highlight').forEach(el => {
    const parent = el.parentNode
    if (parent) {
      parent.replaceChild(document.createTextNode(el.textContent || ''), el)
      parent.normalize()
    }
  })
}

export default function TechnicalDoc() {
  const [lang, setLang] = useState<Lang>('zh')
  const [commentsOpen, setCommentsOpen] = useState(true)
  const [comments, setComments] = useState<Comment[]>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('tf-technicaldoc-comments') : null
    return saved ? JSON.parse(saved) : []
  })

  const [selectedInfo, setSelectedInfo] = useState<{ text: string; sectionId: string; sectionOrder: number } | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tf-technicaldoc-comments', JSON.stringify(comments))
    }
  }, [comments])

  // Restore persistent highlights after render
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return

    // Clear old highlights
    document.querySelectorAll('.tf-highlight').forEach(el => {
      const parent = el.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el)
        parent.normalize()
      }
    })

    // Apply new highlights
    comments.forEach(comment => {
      if (!comment.selectedText) return
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      )
      let node: Text | null
      while ((node = walker.nextNode() as Text)) {
        const idx = node.textContent?.indexOf(comment.selectedText)
        if (idx !== undefined && idx !== -1 && idx >= 0) {
          const after = node.splitText(idx + comment.selectedText.length)
          const middle = node.splitText(idx)
          const span = document.createElement('span')
          span.className = 'tf-highlight'
          span.style.backgroundColor = 'rgba(234, 179, 8, 0.3)'
          span.style.cursor = 'pointer'
          span.style.borderRadius = '2px'
          span.dataset.commentId = comment.id
          span.textContent = comment.selectedText
          span.addEventListener('click', () => {
            const bubble = document.querySelector(`.comment-bubble[data-comment-id="${comment.id}"]`)
            if (bubble) {
              bubble.scrollIntoView({ behavior: 'smooth', block: 'center' })
              bubble.classList.add('bubble-flash')
              setTimeout(() => bubble.classList.remove('bubble-flash'), 1500)
            }
          })
          middle.parentNode?.replaceChild(span, middle)
          break
        }
      }
    })
  }, [comments])

  // Mouse up handler: wrap selection with temp highlight
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleMouseUp = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // If clicked inside the comments panel, ignore
      if (target.closest('.comments-panel')) return

      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) {
        removeTempHighlights()
        setSelectedInfo(null)
        return
      }

      const info = getSelectionInfo()
      if (!info) {
        removeTempHighlights()
        setSelectedInfo(null)
        return
      }

      // Remove previous temp highlight
      removeTempHighlights()

      // Wrap with temp highlight
      wrapSelectionWithTempHighlight()
      setSelectedInfo(info)
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  const t = CONTENT[lang]

  const onAddWithSelection = () => {
    if (!selectedInfo) return
    removeTempHighlights()
    setComments(prev => {
      const newComments = [...prev, {
        id: generateId(),
        timestamp: Date.now(),
        sectionId: selectedInfo.sectionId,
        sectionOrder: selectedInfo.sectionOrder,
        author: 'user' as const,
        content: '',
        selectedText: selectedInfo.text,
      }]
      return newComments
    })
    setSelectedInfo(null)
    window.getSelection()?.removeAllRanges()
  }

  return (
    <div className="space-y-10 relative" id="technical-doc-root">
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
      <section className="space-y-3" data-section-id="abstract">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">{t.abstract.title}</h3>
        <p className="text-tf-muted leading-relaxed text-sm">{t.abstract.body}</p>
      </section>

      {/* 1. Introduction */}
      <section className="space-y-3" data-section-id="intro">
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
      <section className="space-y-3" data-section-id="relatedWork">
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
                <th className="text-left px-3 py-2 font-medium">{t.relatedWork.colClaudeRouter}</th>
                <th className="text-left px-3 py-2 font-medium">{t.relatedWork.colClaudeSwitch}</th>
                <th className="text-left px-3 py-2 font-medium">{t.relatedWork.colTokenFlow}</th>
              </tr>
            </thead>
            <tbody className="text-tf-muted">
              <tr className="border-t border-tf-border/50">
                <td className="px-3 py-2">{t.relatedWork.rowFormat}</td>
                <td className="px-3 py-2">{t.relatedWork.valuePartial}</td>
                <td className="px-3 py-2">{t.relatedWork.valueExtensive}</td>
                <td className="px-3 py-2">{t.relatedWork.valueNo}</td>
                <td className="px-3 py-2">{t.relatedWork.valueNo}</td>
                <td className="px-3 py-2">{t.relatedWork.valueNo}</td>
                <td className="px-3 py-2 text-tf-accent">{t.relatedWork.valueBuiltIn}</td>
              </tr>
              <tr className="border-t border-tf-border/50">
                <td className="px-3 py-2">{t.relatedWork.rowRouting}</td>
                <td className="px-3 py-2">{t.relatedWork.valueYes}</td>
                <td className="px-3 py-2">{t.relatedWork.valueYes}</td>
                <td className="px-3 py-2">{t.relatedWork.valueNo}</td>
                <td className="px-3 py-2">{t.relatedWork.valueInternal}</td>
                <td className="px-3 py-2">{t.relatedWork.valueProjectSwitch}</td>
                <td className="px-3 py-2 text-tf-accent">{t.relatedWork.valueKeyBased}</td>
              </tr>
              <tr className="border-t border-tf-border/50">
                <td className="px-3 py-2">{t.relatedWork.rowCost}</td>
                <td className="px-3 py-2">{t.relatedWork.valueBasic}</td>
                <td className="px-3 py-2">{t.relatedWork.valueBasic}</td>
                <td className="px-3 py-2">{t.relatedWork.valueNo}</td>
                <td className="px-3 py-2">{t.relatedWork.valueNo}</td>
                <td className="px-3 py-2">{t.relatedWork.valueNo}</td>
                <td className="px-3 py-2 text-tf-accent">{t.relatedWork.valueRealtime}</td>
              </tr>
              <tr className="border-t border-tf-border/50">
                <td className="px-3 py-2">{t.relatedWork.rowObservability}</td>
                <td className="px-3 py-2">{t.relatedWork.valueLimited}</td>
                <td className="px-3 py-2">{t.relatedWork.valueLimited}</td>
                <td className="px-3 py-2">{t.relatedWork.valueExtensive}</td>
                <td className="px-3 py-2">{t.relatedWork.valueNo}</td>
                <td className="px-3 py-2">{t.relatedWork.valueNo}</td>
                <td className="px-3 py-2 text-tf-accent">{t.relatedWork.valueSession}</td>
              </tr>
              <tr className="border-t border-tf-border/50">
                <td className="px-3 py-2">{t.relatedWork.rowDeps}</td>
                <td className="px-3 py-2">{t.relatedWork.valueRedisDB}</td>
                <td className="px-3 py-2">{t.relatedWork.valueMySQL}</td>
                <td className="px-3 py-2">{t.relatedWork.valuePostgres}</td>
                <td className="px-3 py-2">{t.relatedWork.valueNone}</td>
                <td className="px-3 py-2">{t.relatedWork.valueNone}</td>
                <td className="px-3 py-2 text-tf-accent">{t.relatedWork.valueSQLite}</td>
              </tr>
              <tr className="border-t border-tf-border/50">
                <td className="px-3 py-2">{t.relatedWork.rowDeploy}</td>
                <td className="px-3 py-2">{t.relatedWork.valueMedium}</td>
                <td className="px-3 py-2">{t.relatedWork.valueMedium}</td>
                <td className="px-3 py-2">{t.relatedWork.valueMedium}</td>
                <td className="px-3 py-2">{t.relatedWork.valueCliBuiltin}</td>
                <td className="px-3 py-2">{t.relatedWork.valueCliBuiltin}</td>
                <td className="px-3 py-2 text-tf-accent">{t.relatedWork.valueSingleBinary}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-tf-muted leading-relaxed text-sm mt-2">
          <strong>LiteLLM</strong> {t.relatedWork.liteLLM} <strong>OneAPI / NewAPI</strong> {t.relatedWork.oneAPI} <strong>Langfuse</strong> {t.relatedWork.langfuse}{' '}
          <strong>Claude Code Router</strong> {t.relatedWork.claudeRouter} <strong>Claude Code Switch</strong> {t.relatedWork.claudeSwitch} {t.relatedWork.p2}
        </p>
      </section>

      {/* 3. System Architecture */}
      <section className="space-y-3" data-section-id="architecture">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">{t.architecture.title}</h3>
        <p className="text-tf-muted leading-relaxed text-sm">{t.architecture.p1}</p>

        <ArchitectureDiagram t={t} />

        <p className="text-tf-muted leading-relaxed text-sm mt-4">{t.architecture.p2}</p>
      </section>

      {/* 4. Method */}
      <section className="space-y-6" data-section-id="method">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">{t.method.title}</h3>

        <div className="space-y-4">
          <h4 className="text-base font-semibold text-tf-text">{t.method.transformer.title}</h4>
          <p className="text-tf-muted leading-relaxed text-sm">{t.method.transformer.p1}</p>
          <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2 text-sm">
            <li>{t.method.transformer.li1}</li>
            <li>{t.method.transformer.li2}</li>
          </ul>
          <p className="text-tf-muted leading-relaxed text-sm">{t.method.transformer.p2}</p>
          <TransformerDiagram t={t} />
        </div>

        <div className="space-y-4">
          <h4 className="text-base font-semibold text-tf-text">{t.method.storage.title}</h4>
          <p className="text-tf-muted leading-relaxed text-sm">{t.method.storage.p1}</p>
          <ul className="list-disc list-inside text-tf-muted space-y-1 ml-2 text-sm">
            <li>{t.method.storage.li1}</li>
            <li>{t.method.storage.li2}</li>
            <li>{t.method.storage.li3}</li>
          </ul>
          <p className="text-tf-muted leading-relaxed text-sm">{t.method.storage.p2}</p>
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
          <p className="text-tf-muted leading-relaxed text-sm">{t.method.detection.p3}</p>
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
      <section className="space-y-3" data-section-id="experiment">
        <h3 className="text-lg font-semibold text-tf-text border-b border-tf-border pb-2">{t.experiment.title}</h3>
        <p className="text-tf-muted leading-relaxed text-sm">{t.experiment.p1}</p>

        <div className="space-y-4 mt-4">
          {(['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7'] as const).map((key) => {
            const e = t.experiment[key]
            return (
              <div key={key} className="border border-tf-border rounded-lg p-4 bg-tf-card">
                <h4 className="text-sm font-semibold text-tf-text mb-1">{e.title}</h4>
                <p className="text-xs text-tf-muted">{e.desc}</p>
                <p className="text-xs text-tf-muted mt-2"><span className="font-medium text-tf-text">Strategy:</span> {e.strategy}</p>
                {'script' in e && (
                  <p className="text-xs text-tf-muted mt-1"><span className="font-medium text-tf-text">Script:</span> {e.script}</p>
                )}
                {'table' in e && (
                  <div className="mt-2 border border-tf-border/50 rounded overflow-hidden">
                    <table className="w-full text-xs">
                      <tbody>
                        {e.table.map((row: { label: string; value: string }, i: number) => (
                          <tr key={i} className={i > 0 ? 'border-t border-tf-border/30' : ''}>
                            <td className="px-3 py-1.5 bg-tf-border/10 text-tf-text font-medium w-28 shrink-0">{row.label}</td>
                            <td className="px-3 py-1.5 text-tf-muted">{row.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {'result' in e && (
                  <p className="text-xs text-tf-muted mt-2"><span className="font-medium text-tf-text">Result:</span> {e.result}</p>
                )}
                {'todo' in e && (
                  <p className="text-xs text-tf-accent mt-2">{e.todo}</p>
                )}
                {'summary' in e && (
                  <p className="text-xs text-green-600 mt-2 italic">{e.summary}</p>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* 6. Conclusion */}
      <section className="space-y-3" data-section-id="conclusion">
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

      <CommentsPanel
        open={commentsOpen}
        onToggle={() => setCommentsOpen(o => !o)}
        comments={comments}
        selectedInfo={selectedInfo}
        onAddWithSelection={onAddWithSelection}
        onDelete={(id) => setComments(prev => prev.filter(c => c.id !== id))}
        onUpdate={(id, content) => setComments(prev => prev.map(c => c.id === id ? { ...c, content } : c))}
        onExport={() => {
          const blob = new Blob([JSON.stringify({ version: '1', comments }, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'technicaldoc-comments.json'
          a.click()
          URL.revokeObjectURL(url)
        }}
        onImport={(json) => {
          try {
            const data = JSON.parse(json)
            if (data.comments && Array.isArray(data.comments)) {
              setComments(data.comments)
            }
          } catch {
            alert('Invalid JSON')
          }
        }}
      />
    </div>
  )
}

function TransformerDiagram({ t }: { t: any }) {
  const d = t.method.transformer
  return (
    <div className="mt-4 bg-tf-card border border-tf-border rounded-lg p-5">
      <div className="flex flex-col md:flex-row items-center justify-center gap-3">
        {/* Left: N Endpoints */}
        <div className="flex flex-col gap-1.5 w-44">
          <div className="text-xs text-tf-muted text-center">{d.diagramN}</div>
          <div className="rounded border border-tf-border bg-tf-bg px-2 py-1 text-[11px] text-tf-text text-center">/v1/chat/completions</div>
          <div className="rounded border border-tf-border bg-tf-bg px-2 py-1 text-[11px] text-tf-text text-center">/v1/messages</div>
          <div className="rounded border border-tf-border bg-tf-bg px-2 py-1 text-[11px] text-tf-text text-center">/v1/responses</div>
        </div>

        {/* Converge arrows */}
        <div className="hidden md:flex flex-col items-center gap-1 text-tf-muted text-xs">
          <div>→</div>
          <div>→</div>
          <div>→</div>
        </div>
        <div className="md:hidden">
          <Arrow />
        </div>

        {/* Middle: Two layers */}
        <div className="flex flex-col gap-2 items-center w-48">
          <div className="w-full rounded-lg px-3 py-2 text-center border border-tf-accent/40 bg-tf-accent/5">
            <div className="text-sm font-medium text-tf-text">MainTransformer</div>
            <div className="text-[11px] text-tf-muted mt-0.5">{d.mainTransformerSub}</div>
          </div>
          <Arrow />
          <div className="w-full rounded-lg px-3 py-2 text-center border border-tf-accent/40 bg-tf-accent/5">
            <div className="text-sm font-medium text-tf-text">ProviderTransformer</div>
            <div className="text-[11px] text-tf-muted mt-0.5">{d.providerTransformerSub}</div>
          </div>
        </div>

        {/* Diverge arrows */}
        <div className="hidden md:flex flex-col items-center gap-1 text-tf-muted text-xs">
          <div>→</div>
          <div>→</div>
          <div>→</div>
        </div>
        <div className="md:hidden">
          <Arrow />
        </div>

        {/* Right: M Providers */}
        <div className="flex flex-col gap-1.5 w-44">
          <div className="text-xs text-tf-muted text-center">{d.diagramM}</div>
          <div className="rounded border border-tf-border bg-tf-bg px-2 py-1 text-[11px] text-tf-text text-center">OpenAI</div>
          <div className="rounded border border-tf-border bg-tf-bg px-2 py-1 text-[11px] text-tf-text text-center">Anthropic</div>
          <div className="rounded border border-tf-border bg-tf-bg px-2 py-1 text-[11px] text-tf-text text-center">Gemini (+8 more)</div>
        </div>
      </div>
    </div>
  )
}

function ArchitectureDiagram({ t }: { t: any }) {
  const d = t.architecture.diagram
  return (
    <div className="mt-4 bg-tf-card border border-tf-border rounded-lg p-6">
      <div className="flex flex-col md:flex-row gap-6 items-stretch">
        {/* Main request flow */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <Box title={d.client} sub={d.clientSub} />
          <Arrow />
          <Box title={d.proxy} sub={d.proxySub} items={d.proxyItems} accent />
          <Arrow />
          <Box title={d.transformer} sub={d.transformerSub} items={d.transformerItems} accent />
          <Arrow />
          <Box title={d.upstream} sub={d.upstreamSub} items={d.upstreamItems} />
        </div>

        {/* Side modules */}
        <div className="md:w-52 flex flex-col gap-3 justify-center">
          <div className="relative">
            <Box title={d.storage} sub={d.storageSub} items={d.storageItems} />
            <div className="hidden md:flex absolute -left-6 top-1/2 -translate-y-1/2 items-center">
              <div className="w-4 h-px bg-tf-border" />
              <div className="w-0 h-0 border-y-4 border-y-transparent border-l-[6px] border-l-tf-border" />
            </div>
          </div>
          <Arrow />
          <div className="flex flex-col gap-2">
            <Box title={d.analysisEngine} sub={d.analysisEngineSub} items={d.analysisEngineItems} />
            <Box title={d.costStats} sub={d.costStatsSub} items={d.costStatsItems} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Box({ title, sub, items, accent = false }: { title: string; sub: string; items?: string[]; accent?: boolean }) {
  return (
    <div className={`w-full rounded-lg px-3 py-2 text-center border ${accent ? 'border-tf-accent/40 bg-tf-accent/5' : 'border-tf-border bg-tf-bg'}`}>
      <div className="text-sm font-medium text-tf-text">{title}</div>
      <div className="text-[11px] text-tf-muted mt-0.5">{sub}</div>
      {items && items.length > 0 && (
        <div className="mt-1 flex flex-wrap justify-center gap-x-2 gap-y-0">
          {items.map((item, i) => {
            const isTodo = item.includes('TODO')
            return (
              <span key={i} className={`text-[10px] inline-flex items-center gap-1 ${isTodo ? 'text-tf-accent' : 'text-tf-muted'}`}>
                <span className="text-tf-accent">•</span>
                {item}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Arrow() {
  return (
    <div className="flex flex-col items-center py-0.5">
      <div className="w-px h-3 bg-tf-border" />
      <div className="w-0 h-0 border-x-4 border-x-transparent border-t-[5px] border-t-tf-border" />
    </div>
  )
}

function CommentsPanel({
  open,
  onToggle,
  comments,
  selectedInfo,
  onAddWithSelection,
  onDelete,
  onUpdate,
  onExport,
  onImport,
}: {
  open: boolean
  onToggle: () => void
  comments: Comment[]
  selectedInfo: { text: string; sectionId: string; sectionOrder: number } | null
  onAddWithSelection: () => void
  onDelete: (id: string) => void
  onUpdate: (id: string, content: string) => void
  onExport: () => void
  onImport: (json: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const scrollToHighlight = (id: string) => {
    const el = document.querySelector(`.tf-highlight[data-comment-id="${id}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      ;(el as HTMLElement).style.backgroundColor = 'rgba(234, 179, 8, 0.6)'
      setTimeout(() => {
        ;(el as HTMLElement).style.backgroundColor = 'rgba(234, 179, 8, 0.3)'
      }, 1500)
    }
  }

  const saveEdit = (id: string) => {
    if (!editContent.trim()) return
    onUpdate(id, editContent.trim())
    setEditingId(null)
    setEditContent('')
  }

  const sortedComments = [...comments].sort((a, b) => {
    const aIdx = COMMENT_SECTIONS.findIndex(s => s.value === a.sectionId)
    const bIdx = COMMENT_SECTIONS.findIndex(s => s.value === b.sectionId)
    if (aIdx !== bIdx) return aIdx - bIdx
    return a.sectionOrder - b.sectionOrder
  })

  return (
    <>
      {/* Collapsed state: small floating button */}
      {!open && (
        <button
          onClick={onToggle}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-tf-card text-tf-text border border-tf-border hover:border-tf-accent/50 transition-colors"
          title="Annotations"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {comments.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
              {comments.length}
            </span>
          )}
        </button>
      )}

      {/* Right-side panel */}
      {open && (
        <div className="comments-panel fixed top-0 right-0 z-50 w-80 h-screen bg-tf-card border-l border-tf-border shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-tf-border flex items-center justify-between bg-tf-border/10 shrink-0">
            <h3 className="text-sm font-semibold text-tf-text">Annotations</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={onExport}
                className="text-[10px] px-2 py-1 rounded bg-tf-border/30 text-tf-muted hover:text-tf-text transition-colors"
                title="Export JSON"
              >
                Export
              </button>
              <label className="text-[10px] px-2 py-1 rounded bg-tf-border/30 text-tf-muted hover:text-tf-text transition-colors cursor-pointer">
                Import
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = (ev) => onImport(String(ev.target?.result || ''))
                    reader.readAsText(file)
                    e.target.value = ''
                  }}
                />
              </label>
              <button onClick={onToggle} className="text-tf-muted hover:text-tf-text ml-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Add annotation button */}
          <div className="px-3 py-2 border-b border-tf-border shrink-0">
            <button
              onClick={onAddWithSelection}
              disabled={!selectedInfo}
              className={`w-full text-xs px-3 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-1.5 ${
                selectedInfo
                  ? 'bg-tf-accent text-white hover:bg-tf-accent/90 animate-bounce-small'
                  : 'bg-tf-border/20 text-tf-muted cursor-not-allowed'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {selectedInfo ? '添加批注' : '先选中文字'}
            </button>
            {selectedInfo && (
              <p className="text-[10px] text-tf-muted mt-1.5 truncate px-1">
                已选: "{selectedInfo.text.length > 40 ? selectedInfo.text.slice(0, 40) + '...' : selectedInfo.text}"
              </p>
            )}
          </div>

          {/* Annotation list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {comments.length === 0 && (
              <p className="text-xs text-tf-muted text-center py-4">Select text on the page and click "添加批注" to add an annotation.</p>
            )}
            {sortedComments.map(c => {
              const section = COMMENT_SECTIONS.find(s => s.value === c.sectionId)
              const isEditing = editingId === c.id
              return (
                <div
                  key={c.id}
                  data-comment-id={c.id}
                  className="comment-bubble bg-tf-bg border border-tf-border/40 rounded-xl p-3 cursor-pointer hover:border-tf-accent/30 transition-all shadow-sm hover:shadow-md"
                  onClick={() => scrollToHighlight(c.id)}
                >
                  {/* Selected text quote */}
                  {c.selectedText && (
                    <div className="text-[10px] bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded-lg mb-2 truncate border border-yellow-500/20">
                      "{c.selectedText.length > 60 ? c.selectedText.slice(0, 60) + '...' : c.selectedText}"
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${c.author === 'user' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}`}>
                        {c.author}
                      </span>
                      <span className="text-[9px] text-tf-muted">{section?.label || c.sectionId}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(c.id) }}
                      className="text-tf-muted hover:text-red-400 transition-colors"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>

                  {isEditing ? (
                    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={2}
                        className="w-full text-[11px] bg-tf-card border border-tf-border rounded-lg px-2 py-1.5 text-tf-text resize-none focus:border-tf-accent/50 focus:outline-none"
                        autoFocus
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => saveEdit(c.id)}
                          className="text-[10px] px-2.5 py-1 rounded-lg bg-tf-accent text-white hover:bg-tf-accent/90"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditContent('') }}
                          className="text-[10px] px-2.5 py-1 rounded-lg bg-tf-border/30 text-tf-muted hover:text-tf-text"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div onClick={(e) => { e.stopPropagation(); setEditingId(c.id); setEditContent(c.content) }}>
                      {c.content ? (
                        <p className="text-[11px] text-tf-text whitespace-pre-wrap leading-relaxed">{c.content}</p>
                      ) : (
                        <p className="text-[11px] text-tf-muted italic">Click to add annotation text...</p>
                      )}
                    </div>
                  )}

                  <p className="text-[9px] text-tf-muted mt-2">{new Date(c.timestamp).toLocaleString()}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
