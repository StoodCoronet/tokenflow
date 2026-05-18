# 100M Token / 7-Day Simulation Script — Spec

## Goal
Generate realistic 7-day usage data (~100M total tokens) directly into the SQLite database so the Token Flow Analysis dashboard shows production-scale traffic patterns.

## Core Constraints
- **Write path**: Direct SQLite insert (skip HTTP proxy for speed).
- **Time span**: Exactly 7 calendar days ending at `now`.
- **Total tokens**: ~100M (prompt + completion combined).
- **Token split**: Development keys 40M / Business keys 60M.
- **Error rate**: 4% overall, distributed unevenly by role.
- **Weekday/weekend**: Weekdays (Mon-Fri) ~3x traffic of weekends.
- **Hourly granularity**: `stats_aggregates` populated with `hour` and `day` windows.

## Key Roles (10 keys, staggered ramp-up)

### Development Keys (5 keys, 40M tokens)
| # | Role | Model(s) | Pattern | Session | Hours | Notes |
|---|------|----------|---------|---------|-------|-------|
| 1 | Frontend Engineer | gpt-4o | sliding_window | Cross-day | 09:00-22:00 | Medium-length queries |
| 2 | Backend Engineer | claude-3-5-sonnet | sliding_window | Cross-day | 09:00-22:00 | Architecture / API design |
| 3 | Data Scientist | gpt-4o, claude-3-5-sonnet | full_context | Cross-day | 09:00-22:00 | SQL / analysis heavy |
| 4 | Experiment/Debug Bot | mixed (all models) | random | Short | 09:00-22:00 | High frequency, short prompts, ~15% error rate (400s) |
| 5 | CI/CD Code Review | gpt-4o-mini | summarization | Per-batch | 02:00-06:00 | Batch processing, medium length, occasional 502s |

### Business Keys (5 keys, 60M tokens)
| # | Role | Model(s) | Pattern | Session | Hours | Notes |
|---|------|----------|---------|---------|-------|-------|
| 6 | Customer Service Auto-Reply | gpt-4o-mini | summarization | 30-min TTL | 24/7 | Ultra-short (50-150 tokens), morning peak 09:00-11:00 |
| 7 | Document Generation SaaS | gemini-1.5-pro | full_context | Per-document | 09:00-22:00 | Very long completion (3K-8K tokens) |
| 8 | Internal Knowledge Base Search | gpt-4o-mini | sliding_window | 30-min TTL | 09:00-18:00 | Medium queries |
| 9 | Marketing Copy Generator | claude-3-5-sonnet / gpt-4o | full_context | Per-campaign | 09:00-18:00 | Medium-long output |
| 10 | User Behavior Analytics Report | gpt-4o-mini | summarization | Per-batch | 01:00-05:00 | Batch, medium length |

## Ramp-Up Schedule
| Day | Keys Created |
|-----|-------------|
| 0 (start) | Dev #1, Dev #2, Dev #3 |
| 2 | Dev #4 (Experiment), Biz #8 (KB Search) |
| 3 | Biz #6 (Customer Service), Biz #7 (Document Gen) |
| 4 | Dev #5 (CI/CD) |
| 5 | Biz #9 (Marketing), Biz #10 (Analytics) |

## Session Rules
- **Dev keys**: Session IDs persist across days. Same engineer working on the same feature uses the same `session_id` for up to 3 days.
- **Business keys**: Session TTL = 30 minutes of inactivity. New `session_id` generated after idle gap.
- **CI/CD & Batch**: Each batch run gets a new `session_id`.

## Error Injection (4% overall)
- Dev #4 (Experiment): ~15% error rate (mostly 400 bad request, some 422).
- Biz #6 (Customer Service) during peak hours: ~5% 429 rate limit.
- Dev #5 (CI/CD): ~2% 502 timeout (upstream mock-like).
- All others: ~1% random errors (mixed 500/502/429).

## Hourly Load Curves
- **Dev keys**: Gaussian peak at 14:00, near-zero 23:00-08:00.
- **Biz #6 (Customer Service)**: Bimodal — morning peak 09:00-11:00, evening peak 20:00-22:00, low but non-zero overnight.
- **Biz #7 (Document Gen)**: Uniform during work hours, heavy afternoon.
- **CI/CD / Batch keys**: Concentrated in their designated overnight windows.

## Token Distribution per Request Type
- **Customer Service**: prompt 30-80, completion 20-70 (avg ~100 total).
- **Experiment/Debug**: prompt 50-200, completion 30-100 (avg ~150 total).
- **Knowledge Base**: prompt 200-500, completion 100-300 (avg ~500 total).
- **Engineer (Frontend/Backend/Data)**: prompt 500-2000, completion 300-800 (avg ~1500 total).
- **CI/CD Review**: prompt 1000-3000, completion 200-600 (avg ~2000 total).
- **Marketing Copy**: prompt 300-800, completion 500-1500 (avg ~1200 total).
- **Document Generation**: prompt 500-1500, completion 3000-8000 (avg ~5000 total).
- **Analytics Report**: prompt 800-2000, completion 300-800 (avg ~1800 total).

## Data Output
- `request_logs`: one row per request (including `estimated_cost`).
- `sessions`: upserted per session.
- `stats_aggregates`: pre-aggregated `hour` and `day` rows.
- `api_keys`: 10 rows with realistic names, providers, scenarios.

## Implementation Notes
- Script location: `scripts/generate-100m-sim.ts`.
- Should accept `--db <path>` override.
- Should print progress and final summary (total requests, total tokens, total cost, per-key breakdown).
- Should warn if the DB already contains data and offer `--force` to truncate.
- Reuse `computeCost` from `@tokenflow/server/proxy/pricing` for cost calculation.
- Use seeded RNG for reproducibility.
