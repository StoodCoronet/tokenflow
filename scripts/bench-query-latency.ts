import Database from 'better-sqlite3'

function bench(db: Database, name: string, sql: string) {
  const stmt = db.prepare(sql)
  const start = process.hrtime.bigint()
  stmt.all()
  const end = process.hrtime.bigint()
  const ms = Number(end - start) / 1_000_000
  console.log(`  ${name}: ${ms.toFixed(2)} ms`)
}

function seed(db: Database, count: number) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS request_logs (
      id INTEGER PRIMARY KEY,
      api_key_id INTEGER,
      model TEXT,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      estimated_cost REAL,
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS stats_aggregates (
      window_type TEXT,
      window_start INTEGER,
      api_key_id INTEGER,
      model TEXT,
      request_count INTEGER,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      estimated_cost REAL
    );
  `)

  const now = Math.floor(Date.now() / 1000)
  const daySec = 86400

  // Insert request_logs
  const insertReq = db.prepare(`
    INSERT INTO request_logs (api_key_id, model, prompt_tokens, completion_tokens, estimated_cost, created_at)
    VALUES (?, 'gpt-4o', ?, ?, 0.001, ?)
  `)

  const insertAgg = db.prepare(`
    INSERT INTO stats_aggregates (window_type, window_start, api_key_id, model, request_count, prompt_tokens, completion_tokens, estimated_cost)
    VALUES ('day', ?, 1, 'gpt-4o', ?, ?, ?, ?)
  `)

  db.transaction(() => {
    let dailyTokens = 0
    let dailyCount = 0
    let dailyCost = 0
    let currentDay = now - 30 * daySec

    for (let i = 0; i < count; i++) {
      const pt = 500 + Math.floor(Math.random() * 1500)
      const ct = 200 + Math.floor(Math.random() * 800)
      const cost = (pt + ct) * 0.000005
      insertReq.run(1, pt, ct, currentDay)

      dailyTokens += pt + ct
      dailyCount++
      dailyCost += cost

      if (dailyCount >= Math.ceil(count / 30)) {
        insertAgg.run(currentDay, dailyCount, dailyTokens, dailyTokens, dailyCost)
        dailyTokens = 0
        dailyCount = 0
        dailyCost = 0
        currentDay += daySec
      }
    }

    if (dailyCount > 0) {
      insertAgg.run(currentDay, dailyCount, dailyTokens, dailyTokens, dailyCost)
    }
  })()
}

const scales = [10_000, 50_000, 100_000, 500_000]

for (const scale of scales) {
  const db = new Database(':memory:')
  console.log(`\n--- Scale: ${scale.toLocaleString()} request_logs ---`)
  seed(db, scale)

  bench(db, 'Pre-aggregated (stats_aggregates)', `
    SELECT window_start, SUM(request_count), SUM(prompt_tokens), SUM(completion_tokens)
    FROM stats_aggregates
    WHERE window_type = 'day'
    GROUP BY window_start
    ORDER BY window_start
  `)

  bench(db, 'Raw scan (request_logs)', `
    SELECT DATE(created_at, 'unixepoch') as day,
           COUNT(*) as cnt,
           SUM(prompt_tokens) as pt,
           SUM(completion_tokens) as ct
    FROM request_logs
    WHERE created_at >= ${Math.floor(Date.now() / 1000) - 30 * 86400}
    GROUP BY day
    ORDER BY day
  `)

  db.close()
}

console.log('\nDone.')
