# Sessions Page Spec

**Date**: 2026-04-18
**Status**: Decided (Interview)

## 核心定位

Sessions 页面是**使用效率分析入口**，目的是快速定位低效 session、理解上下文模式、监控 token 消耗。
Keys 页面负责 key 压力/承载，两者是不同的筛选策略。

## 页面结构：Tab 布局 + 详情页

```
Navbar: [Dashboard] [Keys] [Sessions] [Analysis]

Sessions 页面内部:
  Tab 1: 概览 (Overview)
  Tab 2: Session 列表
  点击卡片 → Session 详情页（独立页面，不弹窗）
```

Analysis 页面暂时保持独立（Phase 3 原计划），后续看是否有合并必要。

---

## Tab 1 — 概览

### 统计卡片
- 总 session 数
- 总 token 消耗
- 平均效率评分
- 当前活跃 session 数

### 模式分布图
- 环形图或柱状图
- 展示 full_context / sliding_window / summarization 等模式占比

### Token 趋势图
- Session 级别的趋势，不做全局总体趋势
- 是否在概览显式展示，做完卡片后再看效果决定

---

## Tab 2 — Session 列表

### 双展示模式

**主模式：Session 为单位的卡片**
- 目的：找到最低效的 session
- 卡片高度概括运行状态
- 颜色指示 token 用量 + 效率

**次模式：Key 为单位的分组视图**
- 目的：管理维度，看每个 key 下的 session 使用情况
- 按 key 分组，可展开看该 key 下的 session 卡片

用户可在两种模式间切换。

### 卡片设计（折叠态）

```
┌─ Session abc123 ────────────────────────┐
│  ● Active  │  5 msgs  │  12,300 tok     │
│  模式: full_context    │  效率: D (23%)  │
│  Key: my-openai-key                      │
└──────────────────────────────────────────┘
```

- 状态指示灯（Active = 绿点，Idle = 灰点）
- 消息数、token 总量
- 上下文模式
- 效率评分（A/B/C/D + 数字）
- 关联的 Key 名称

### 颜色编码（双重编码）

- **效率颜色**：A=绿，B=黄绿，C=黄，D=红
- **Token 量**：卡片视觉权重（背景色深浅或侧边色条粗细）
- 两者叠加，一眼看到"浪费最多的 session"

### 卡片展开态

点击卡片下拉展开，显示详细信息：

```
┌─ Session abc123 ────────────────────────┐
│  ● Active  │  5 msgs  │  12,300 tok     │
│  模式: full_context    │  效率: D (23%)  │
│  Key: my-openai-key                      │
│                                          │
│  Prompt 趋势: 1k → 2k → 3k → 4k → 5k   │
│  ⚠️ 每轮都在重发完整上下文                 │
│  建议: 考虑 sliding_window               │
│                                          │
│  [▼ 查看最近对话]                         │
│  [user] 帮我写一个 Python 排序...          │
│  [asst] 好的，这是冒泡排序...             │
│  [user] 再写一个（几乎一样）...           │
│  [asst] 这是选择排序...                   │
│  [user] 第三个排序...                     │
│                                          │
│  [进入详情页 →]                           │
└──────────────────────────────────────────┘
```

- **指标区**：prompt token 趋势、模式描述、警告、建议
- **对话预览**：最近 5 条消息，role + 智能摘要（前 ~50 字）
- **入口按钮**：点击进入完整 Session 详情页

### Session 状态（两状态）

| 状态 | 条件 | 标识 |
|------|------|------|
| Active | 5 分钟内有请求 | 绿点 |
| Idle | 超过 5 分钟无请求 | 灰点 |

不做"已结束"状态，因为没有显式关闭机制。

### 筛选器

- **时间范围**：快捷预设（今天 / 7天 / 30天）+ 自定义范围
- **API Key**：下拉选择某个 key
- **上下文模式**：full_context / sliding_window / summarization 等
- **效率评分区间**：滑块或输入框，如"只看效率 < 50%"

### 排序

- **默认**：时间降序（最近活动在前）
- **可切换**：效率升序、token 降序、消息数降序

### 分页

- 无限滚动加载

---

## Session 详情页

点击卡片上的"进入详情页"跳转到独立页面，包含：

### 1. 完整日志表格
- 该 session 的所有 request_logs
- 列：时间、模型、prompt tokens、completion tokens、模式、效率评分

### 2. Token 趋势图
- recharts AreaChart
- X 轴：request 序号
- Y 轴：token 数
- 双线：prompt_tokens vs completion_tokens
- Anthropic 风格：简洁线条，浅色填充

### 3. 分析报告
- 检测到的上下文模式 + 详细说明
- 效率评分 + Grade 颜色卡片
- 每个检测器的详细结果
- 警告列表 (warnings[])
- 优化建议列表 (suggestions[])

### 不包含
- 不做聊天界面式的对话历史视图
- 不做 key 压力/承载信息（属于 Keys 页面）

---

## 与其他页面的关系

| 页面 | 职责 |
|------|------|
| **Sessions** | 使用效率分析、上下文模式、token 消耗 |
| **Keys** | Key 压力/承载、rate limit、调用趋势（像看股票） |
| **Analysis** | 独立分析入口，暂时不合并 |

Keys 页面的 Key 压力描述（如 rate limit 使用百分比、调用趋势图、超出承载预警）属于 Keys 页面功能，不在 Sessions 页面中重复。

---

## 对 Analysis 页面的参考

本次讨论的以下设计决策同样适用于独立 Analysis 页面：

- **Session 详情页的分析报告**（检测模式、效率评分、建议）直接复用 Analysis 页面的组件
- **颜色编码方案**（A/B/C/D 着色）在 Analysis 页面中保持一致
- **Token 趋势图**（recharts AreaChart，双线 prompt/completion）Analysis 页面也用同样的图表组件
- **筛选维度**：Analysis 页面可能需要跨 session 的聚合分析（如"所有 full_context session 的平均效率"），可复用 Sessions 的筛选器 UI

Analysis 页面的差异点（待讨论）：
- 可能增加跨 session 的聚合视图（如模式对比、时间段对比）
- 可能增加"全局建议"（如"你 80% 的 session 都在用 full_context，建议启用 sliding_window"）

---

## 实施备注

- 双展示模式（session-centric / key-centric）可先做 session-centric，key-centric 作为增强
- 颜色编码的具体阈值和视觉效果需要实际调参
- 对话预览需要 API 支持返回最近消息内容（当前 API 可能未返回 message content）
- 无限滚动需要 API 支持分页参数（offset/limit 或 cursor）
- Key-centric 视图需要 key 维度的聚合 API
