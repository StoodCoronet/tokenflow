# Analysis Dashboard 改造 Spec

**日期**: 2026-05-06
**状态**: Decision-complete, ready for implementation

---

## Objective

将当前 Analysis 页面从"单 session 下拉选择 + 效率评分"模式，改造为以 API Key 为核心粒度的两层级联分析看板：
- **Overall 看板**：全局用量统计、趋势、Key/Model 分布、效率评分
- **Key Detail**：单个 Key 的用量趋势、Model 分布、Request 明细、Pattern 分析

---

## Key Design Decisions

| 决策 | 选择 | 说明 |
|------|------|------|
| Session 粒度 | **不做 session 区分** | 当前 proxy handler 中若无客户端传 `session_id`，每次请求生成独立 auto-ID，导致 session 实为 per-request。用户决定分析粒度到 key 为止，暂不下钻到 session。 |
| 下钻层级 | **两层级联** | Overall → Key Detail。Key Detail 内展示 Request 明细列表（分页），替代原来的 session 下钻。 |
| 导航 | **面包屑** | Analysis > Key: xxx，点击面包屑返回 Overall。不引入独立路由，保持单页内层级切换。 |
| 数据刷新 | **加载 + 30s 轮询 + 手动刷新** | 进入页面加载数据，定时 30s 自动刷新，提供手动刷新按钮。 |
| 查询性能 | **预聚合 stats 表** | 新增 `stats_aggregates` 表，后端每次收到请求时更新聚合数据，看板查询走聚合表而非全表 scan。 |
| 成本估算 | **预留接口，暂不展示** | 数据结构预留 cost 字段，MVP 阶段 UI 不展示费用，后续接入模型单价配置后启用。 |

---

## Data Model

### New Table: `stats_aggregates`

预聚合表，按时间窗口（hour / day）和维度聚合 `request_logs`。

```sql
CREATE TABLE IF NOT EXISTS stats_aggregates (
  window_type TEXT NOT NULL,         -- 'hour' | 'day'
  window_start TEXT NOT NULL,        -- ISO 8601 datetime, e.g. '2026-05-06T14:00:00Z'
  api_key_id TEXT NOT NULL,
  model TEXT,                        -- NULL 表示该维度为汇总（all models）
  request_count INTEGER DEFAULT 0,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  avg_efficiency REAL DEFAULT 0,     -- 该窗口内平均 efficiency_score
  pattern_full_context INTEGER DEFAULT 0,   -- 该 pattern 出现次数
  pattern_sliding_window INTEGER DEFAULT 0,
  pattern_summarization INTEGER DEFAULT 0,
  estimated_cost REAL DEFAULT 0,     -- 预留，MVP 阶段填 0
  PRIMARY KEY (window_type, window_start, api_key_id, model)
);
```

**索引**:
```sql
CREATE INDEX idx_stats_window ON stats_aggregates(window_type, window_start);
CREATE INDEX idx_stats_key ON stats_aggregates(api_key_id, window_type, window_start);
```

### Existing Tables (used for Key Detail request list)

- `request_logs` — Key Detail 的 Request 明细列表直接查询此表，按 `api_key_id` + `created_at DESC` 分页。
- `api_keys` — 用于展示 Key name。

---

## Aggregation Strategy

### When to Aggregate

在 `proxy/handler.ts` 的 `logRequest()` 函数中，每次请求成功后**同步更新** `stats_aggregates`。

理由：
- SQLite 单文件，单个请求内的同步写入无并发问题（WAL mode）。
- 避免定时任务（cron）的复杂度和额外进程开销。
- 聚合逻辑轻量，单次写入 2 行（hour + day 两个窗口）。

### Aggregation Logic

```typescript
function updateStatsAggregate(log: {
  api_key_id: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  efficiency_score: number
  detected_pattern: string | null
}) {
  const now = new Date()
  const hourWindow = floorToHour(now)
  const dayWindow = floorToDay(now)

  for (const { window_type, window_start } of [
    { window_type: 'hour', window_start: hourWindow },
    { window_type: 'day', window_start: dayWindow },
  ]) {
    // 1. Update model-specific row
    upsertStatsRow({ ...window, api_key_id: log.api_key_id, model: log.model }, log)
    // 2. Update all-models row (model = NULL)
    upsertStatsRow({ ...window, api_key_id: log.api_key_id, model: null }, log)
  }
}
```

`upsertStatsRow` 语义：
- `INSERT OR IGNORE` 先尝试插入（默认值 0）。
- 然后 `UPDATE` 递增各计数器，并重新计算 `avg_efficiency`。
- `avg_efficiency` 用增量公式：`(old_avg * old_count + new_score) / (old_count + 1)`。
- `detected_pattern` 映射到对应 pattern 计数器 +1。

### Cleanup

`stats_aggregates` 保留最近 90 天数据。后端启动时（或每次更新后概率触发）执行：
```sql
DELETE FROM stats_aggregates WHERE window_start < datetime('now', '-90 days');
```

---

## API Specification

### `GET /api/dashboard`

**用途**: Overall 看板数据。

**Query Params**:
- `range`: `'1h' | '6h' | '24h' | '7d' | '30d'` — 默认 `'24h'`

**Response**:
```json
{
  "range": "24h",
  "window_type": "hour",
  "total_requests": 1523,
  "total_prompt_tokens": 450000,
  "total_completion_tokens": 180000,
  "avg_efficiency": 76,
  "grade_distribution": {
    "A": 45, "B": 30, "C": 15, "D": 10
  },
  "pattern_distribution": {
    "full_context": 800,
    "sliding_window": 400,
    "summarization": 200,
    "none": 123
  },
  "trend": [
    { "window_start": "2026-05-05T14:00:00Z", "request_count": 50, "total_tokens": 15000 },
    { "window_start": "2026-05-05T15:00:00Z", "request_count": 65, "total_tokens": 21000 }
  ],
  "key_distribution": [
    { "api_key_id": "key_abc", "key_name": "Production", "total_tokens": 300000, "request_count": 1000 },
    { "api_key_id": "key_def", "key_name": "Dev", "total_tokens": 150000, "request_count": 523 }
  ],
  "model_distribution": [
    { "model": "gpt-4o", "total_tokens": 250000, "request_count": 600 },
    { "model": "claude-3-5-sonnet", "total_tokens": 200000, "request_count": 400 }
  ],
  "anomalies": [
    { "api_key_id": "key_abc", "key_name": "Production", "spike_factor": 3.5, "message": "Token usage increased 350% in the last hour" }
  ]
}
```

**实现**: 查 `stats_aggregates`，按 `window_type`（由 `range` 推导：<=24h 用 hour，>24h 用 day）和 `window_start >= range_start` 过滤，`model IS NULL` 取汇总行。`key_distribution` 按 `api_key_id` GROUP BY。`model_distribution` 按 `model` GROUP BY 且 `model IS NOT NULL`。

### `GET /api/dashboard/keys/:key_id`

**用途**: Key Detail 页面数据。

**Query Params**:
- `range`: 同上，默认 `'24h'`
- `page`: 分页页码，默认 1
- `page_size`: 默认 20

**Response**:
```json
{
  "range": "24h",
  "api_key": {
    "id": "key_abc",
    "name": "Production",
    "provider": "openai",
    "scenario": "coding"
  },
  "summary": {
    "total_requests": 1000,
    "total_prompt_tokens": 300000,
    "total_completion_tokens": 120000,
    "avg_efficiency": 78
  },
  "trend": [
    { "window_start": "...", "request_count": 50, "total_tokens": 15000 }
  ],
  "model_distribution": [
    { "model": "gpt-4o", "total_tokens": 180000, "request_count": 400 }
  ],
  "pattern_distribution": {
    "full_context": 500,
    "sliding_window": 300,
    "summarization": 100,
    "none": 100
  },
  "requests": {
    "items": [
      {
        "id": "req_123",
        "model": "gpt-4o",
        "prompt_tokens": 500,
        "completion_tokens": 200,
        "total_tokens": 700,
        "status": "success",
        "detected_pattern": "full_context",
        "efficiency_score": 82,
        "created_at": "2026-05-06T14:32:00Z",
        "request_data": "{...}",
        "response_data": "{}"
      }
    ],
    "total": 1000,
    "page": 1,
    "page_size": 20
  }
}
```

**实现**: `summary` / `trend` / `model_distribution` / `pattern_distribution` 查 `stats_aggregates` 按 `api_key_id` 过滤。`requests` 查 `request_logs` 按 `api_key_id` 分页。

### `GET /api/sessions/stats` (保留但简化)

当前 `/api/sessions/stats` 返回 session 相关统计。由于不做 session 区分，该端点可保留供其他用途，但 Analysis 页面不再调用它。

---

## Anomaly Detection

### 算法

**目标**: 发现某个 Key 在最近一个时间窗口内 token 消耗异常暴涨。

**实现**:
```typescript
function detectAnomalies(keyId: string, currentWindow: StatsRow, previousWindow: StatsRow) {
  if (!previousWindow || previousWindow.total_tokens === 0) return null
  const spikeFactor = currentWindow.total_tokens / previousWindow.total_tokens
  if (spikeFactor >= 3.0) {
    return {
      api_key_id: keyId,
      spike_factor: Math.round(spikeFactor * 10) / 10,
      message: `Token usage increased ${Math.round(spikeFactor * 100)}% compared to previous ${windowType}`
    }
  }
  return null
}
```

**触发位置**: `/api/dashboard` 接口中，遍历各 Key 的当前窗口和前一个窗口，检测 `total_tokens` 暴涨（>= 300%）。

**展示**: Overall 看板顶部用红色 Alert 卡片展示异常 Key 列表。

---

## UI Specification

### Page Structure

```
┌─ Analysis ──────────────────────────────────────────────┐
│                                                          │
│  [时间范围: 1h | 6h | 24h | 7d | 30d]  [刷新按钮]        │
│                                                          │
│  ┌─ 概览卡片行 ───────────────────────────────────────┐  │
│  │ 总请求数 │ 总 Prompt │ 总 Completion │ 平均效率      │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ 趋势图 ───────────────────────────────────────────┐  │
│  │ Token 用量趋势折线图（按时间窗口）                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ 分布图行 ──────────────────────────────────────────┐ │
│  │  Key 用量横向条形图  │  Model 饼图  │  效率等级饼图  │ │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Pattern 分布 ─────────────────────────────────────┐  │
│  │ full_context / sliding_window / summarization 占比   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [异常 Alert 卡片 - 如有]                                 │
│                                                          │
│  ┌─ Key 列表（可点击下钻）─────────────────────────────┐  │
│  │ Key 名 │ Provider │ 请求数 │ Token 数 │ 效率 │ 趋势   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Key Detail View

```
┌─ Analysis > Key: Production ─────────────────────────────┐
│  [← 返回 Overall]                                        │
│                                                          │
│  Key 信息卡片: Production (openai) — scenario: coding    │
│                                                          │
│  [时间范围切换]  [刷新]                                   │
│                                                          │
│  概览卡片: 请求数 / Prompt / Completion / 效率            │
│  趋势图                                                  │
│  Model 分布饼图                                          │
│  Pattern 分布条形图                                      │
│                                                          │
│  ┌─ Request 明细 ──────────────────────────────────────┐ │
│  │ 时间 │ Model │ Token │ Status │ Pattern │ [展开 ▼]   │ │
│  │ ...                                                 │ │
│  │ [分页: < 1 2 3 ... 50 >]                           │ │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  展开后展示完整 request_data / response_data JSON         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Component Breakdown

| 组件 | 文件 | 职责 |
|------|------|------|
| `AnalysisView` | `packages/ui/src/components/AnalysisView.tsx` | 主容器，管理 `view` 状态（`'overall' | 'key'`）和 `selectedKeyId` |
| `TimeRangeSelector` | 内联或独立组件 | 1h/6h/24h/7d/30d 按钮组 |
| `OverviewCards` | 内联 | 4 个概览数字卡片 |
| `TrendChart` | recharts `AreaChart` | Token 用量趋势折线图/面积图 |
| `KeyDistributionChart` | recharts `BarChart` (horizontal) | Key 用量横向条形图 |
| `ModelDistributionChart` | recharts `PieChart` | Model 用量饼图 |
| `EfficiencyChart` | recharts `PieChart` | A/B/C/D 等级分布饼图 |
| `PatternBarChart` | recharts `BarChart` | Pattern 分布条形图 |
| `AnomalyAlert` | 内联 | 红色 Alert 卡片 |
| `KeyListTable` | recharts + table | Key 列表，点击触发 `onSelectKey` |
| `KeyDetailView` | 内联或独立组件 | Key Detail 完整视图 |
| `RequestTable` | table + pagination | Request 分页列表，可展开 JSON |

### Chart Library

继续使用 `recharts`（已存在于 `packages/ui` 依赖中）。

---

## State Management

### Frontend State (React useState)

```typescript
// AnalysisView 顶层状态
const [view, setView] = useState<'overall' | 'key'>('overall')
const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null)
const [range, setRange] = useState<'1h' | '6h' | '24h' | '7d' | '30d'>('24h')
const [data, setData] = useState<DashboardData | null>(null)
const [loading, setLoading] = useState(false)
const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

// 自动刷新
useEffect(() => {
  fetchData()
  const interval = setInterval(fetchData, 30000)
  return () => clearInterval(interval)
}, [view, selectedKeyId, range])
```

### Backend Aggregation (SQLite)

见上文「Aggregation Strategy」章节。

---

## Implementation Steps

### Step 1: DB Schema + Aggregation Logic

1. `packages/server/src/db/schema.ts`
   - 新增 `stats_aggregates` 表创建语句
   - 新增 `upsertStatsAggregate()` 函数
   - 新增 `queryStatsAggregates()` 函数（支持按 range + key_id 过滤）
   - 新增 `cleanupOldStats()` 函数（保留 90 天）

2. `packages/server/src/proxy/handler.ts`
   - 在 `logRequest()` 中调用 `upsertStatsAggregate()`

### Step 2: Backend API

1. `packages/server/src/routes/index.ts`
   - 重写 `/api/dashboard`（支持 `range` query param）
   - 新增 `/api/dashboard/keys/:key_id`（支持 `range`, `page`, `page_size`）
   - 实现 `detectAnomalies()` 辅助函数

### Step 3: Frontend — Overall View

1. `packages/ui/src/components/AnalysisView.tsx` 重构
   - 新增 `view` / `selectedKeyId` / `range` 状态管理
   - 集成自动刷新（30s）
   - 时间范围选择器

2. 新增/重构图表组件
   - `OverviewCards`
   - `TrendChart` (recharts AreaChart)
   - `KeyDistributionChart` (recharts BarChart horizontal)
   - `ModelDistributionChart` (recharts PieChart)
   - `EfficiencyChart` (recharts PieChart)
   - `PatternBarChart` (recharts BarChart)
   - `KeyListTable` (可点击下钻)
   - `AnomalyAlert`

### Step 4: Frontend — Key Detail View

1. 新增 `KeyDetailView` 组件
   - Key 信息卡片
   - 复用 `OverviewCards` / `TrendChart` / `ModelDistributionChart`
   - `PatternBarChart`（该 Key 的 pattern 分布）
   - `RequestTable`（分页 + 可展开 JSON）
   - 面包屑导航

### Step 5: API Types + Integration

1. `packages/shared/src/types.ts`
   - 新增 `DashboardData`, `KeyDetailData`, `AnomalyItem` 等类型（如果前端需要）
   - 或者仅在前端定义类型（因为 shared 包已包含）

2. `packages/ui/src/api.ts`
   - 新增 `fetchDashboard(range)`
   - 新增 `fetchKeyDetail(keyId, range, page, pageSize)`

### Step 6: Validation

- 启动 server，发送若干请求，验证 `stats_aggregates` 是否正确聚合
- 打开 Analysis 页面，验证 Overall 看板数据正确
- 点击 Key 下钻，验证 Key Detail 数据正确
- 验证 30s 自动刷新、时间范围切换、分页、JSON 展开
- 验证异常检测（手动构造数据或 mock）

---

## Files Changed

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/server/src/db/schema.ts` | 修改 | 新增 `stats_aggregates` 表 + CRUD |
| `packages/server/src/proxy/handler.ts` | 修改 | `logRequest()` 中调用聚合更新 |
| `packages/server/src/routes/index.ts` | 修改 | 重写 `/api/dashboard`，新增 `/api/dashboard/keys/:key_id` |
| `packages/ui/src/components/AnalysisView.tsx` | 重写 | 主容器 + Overall 视图 + Key Detail 视图 |
| `packages/ui/src/api.ts` | 修改 | 新增 dashboard API 调用 |
| `packages/shared/src/types.ts` | 可选修改 | 新增 dashboard 相关类型定义 |

---

## Out of Scope

| 功能 | 原因 |
|------|------|
| Session-level 下钻 | 用户明确决定暂不做 session 区分 |
| 成本估算 UI 展示 | 预留数据结构，等模型单价配置完成后启用 |
| 实时 WebSocket 推送 | 30s 轮询已满足需求，WebSocket 增加复杂度 |
| 自定义时间范围（任意起止） | MVP 阶段用预设范围（1h/6h/24h/7d/30d）足够 |
| 数据导出（CSV/JSON） | 非 must-have，后续按需添加 |
| 多维度交叉过滤（如 Key + Model 联合过滤） | 超出 MVP 范围，当前仅单维度分布展示 |

---

## Risks & Mitigations

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| `stats_aggregates` 表增长过快 | 磁盘占用 | 启动时清理 90 天前数据；hour 窗口数据量 = 90天 × 24h × key数 × (model数+1)，通常 < 10MB |
| 聚合写入阻塞请求响应 | 延迟 | 聚合逻辑极简（单次 upsert 2 行），SQLite WAL mode 下写入性能足够；若担心可改为 `reply.raw.end()` 后的异步写入 |
| recharts 在大量数据点下卡顿 | UI 性能 | 30d 范围按 day 聚合仅 30 个点，24h 按 hour 仅 24 个点，数据量极小 |
| 自动刷新导致页面闪烁 | 用户体验 | 刷新时保留旧数据，新数据加载完成后再替换；loading 状态仅显示在角落 |

---

## Open Questions

1. **Model 单价配置**: 何时接入？需要新增 `model_pricing` 表或 config 字段吗？
2. **Key 列表排序**: 默认按什么排序？总 token 降序？最近活跃？
3. **Request 明细筛选**: 是否需要按 status / model / pattern 过滤 Request 列表？

---

## Success Criteria

- [ ] Overall 看板加载后展示正确的全局统计、趋势图、Key/Model/效率分布
- [ ] 时间范围切换（1h/6h/24h/7d/30d）后数据正确更新
- [ ] 点击 Key 列表中的某一行，平滑切换到 Key Detail 视图
- [ ] Key Detail 展示该 Key 的用量趋势、Model 分布、Pattern 分布、Request 分页列表
- [ ] Request 列表每页 20 条，分页正常，点击可展开 JSON
- [ ] 30s 自动刷新工作正常，手动刷新按钮工作正常
- [ ] 异常检测能正确标记 token 暴涨的 Key
- [ ] `stats_aggregates` 表在每次请求后正确更新
- [ ] 90 天前的聚合数据自动清理
