import type { Result } from './checks'

export interface Day { day: string; up: number; total: number; avgMs: number | null }

/** Where check results are kept. D1 in production, an array in tests. */
export interface UptimeStore {
  record(at: number, results: Result[]): Promise<void>
  /** Per service, per UTC day since `since` (ms), oldest first. */
  days(since: number): Promise<Record<string, Day[]>>
  /** Deletes rows older than `before` (ms). */
  prune(before: number): Promise<void>
}

export function d1Store(db: D1Database): UptimeStore {
  return {
    async record(at, results) {
      const rows = results.filter(r => r.state !== 'planned')
      if (!rows.length) return
      const stmt = db.prepare('INSERT INTO checks (service, at, ok, ms, code) VALUES (?, ?, ?, ?, ?)')
      await db.batch(rows.map(r => stmt.bind(r.id, at, r.state === 'up' ? 1 : 0, r.ms, r.code)))
    },
    async days(since) {
      const { results } = await db.prepare(
        `SELECT service, date(at / 1000, 'unixepoch') AS day, SUM(ok) AS up, COUNT(*) AS total, CAST(AVG(ms) AS INTEGER) AS avg_ms
           FROM checks WHERE at >= ? GROUP BY service, day ORDER BY day`,
      ).bind(since).all<{ service: string; day: string; up: number; total: number; avg_ms: number | null }>()
      const out: Record<string, Day[]> = {}
      for (const r of results) (out[r.service] ??= []).push({ day: r.day, up: r.up, total: r.total, avgMs: r.avg_ms })
      return out
    },
    async prune(before) {
      await db.prepare('DELETE FROM checks WHERE at < ?').bind(before).run()
    },
  }
}

/** The same contract over an array, for tests and local runs. */
export function memoryStore(): UptimeStore & { rows: { service: string; at: number; ok: number; ms: number | null }[] } {
  const rows: { service: string; at: number; ok: number; ms: number | null }[] = []
  return {
    rows,
    async record(at, results) {
      for (const r of results) if (r.state !== 'planned') rows.push({ service: r.id, at, ok: r.state === 'up' ? 1 : 0, ms: r.ms })
    },
    async days(since) {
      const out: Record<string, Day[]> = {}
      const groups = new Map<string, { service: string; day: string; up: number; total: number; ms: number[] }>()
      for (const r of rows.filter(x => x.at >= since).sort((a, b) => a.at - b.at)) {
        const day = new Date(r.at).toISOString().slice(0, 10), key = r.service + '|' + day
        const g = groups.get(key) ?? { service: r.service, day, up: 0, total: 0, ms: [] }
        g.up += r.ok; g.total++
        if (r.ms !== null) g.ms.push(r.ms)
        groups.set(key, g)
      }
      for (const g of groups.values()) (out[g.service] ??= []).push({ day: g.day, up: g.up, total: g.total, avgMs: g.ms.length ? Math.trunc(g.ms.reduce((a, b) => a + b, 0) / g.ms.length) : null })
      return out
    },
    async prune(before) {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].at < before) rows.splice(i, 1)
    },
  }
}
