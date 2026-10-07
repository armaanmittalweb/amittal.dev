import { describe, expect, it } from 'vitest'
import type { Result } from '../src/checks'
import { d1Store } from '../src/store'
import { sqliteSql } from './helpers'

const DAY = 86_400_000

/** Just enough of D1 over node:sqlite to run d1Store's own SQL. */
function d1() {
  const { db } = sqliteSql()
  const args = (p: unknown[]) => p.map(v => (v === undefined ? null : v)) as (string | number | null)[]
  const prepare = (q: string, params: unknown[] = []) => ({
    q, params,
    bind: (...p: unknown[]) => prepare(q, p),
    all: async () => ({ results: db.prepare(q).all(...args(params)) }),
    run: async () => { db.prepare(q).run(...args(params)) },
  })
  const batch = async (stmts: { q: string; params: unknown[] }[]) => {
    db.exec('BEGIN')
    for (const s of stmts) db.prepare(s.q).run(...args(s.params))
    db.exec('COMMIT')
  }
  return { db, binding: { prepare, batch } as unknown as D1Database }
}

const result = (id: string, state: 'up' | 'down', ms: number | null): Result => ({ id, state, ms, code: state === 'up' ? 200 : 503 }) as Result

describe('d1Store', () => {
  it('keeps the per-day totals equal to adding up every check', async () => {
    const { db, binding } = d1(), store = d1Store(binding)
    const t0 = Date.UTC(2026, 9, 1, 23, 50)
    for (let i = 0; i < 6; i++) { // crosses midnight UTC after two runs
      await store.record(t0 + i * 5 * 60_000, [result('archive', 'up', 100 + i), result('edusched', i % 2 ? 'down' : 'up', i % 2 ? null : 300 + i)])
    }
    const raw = db.prepare(`SELECT service, date(at / 1000, 'unixepoch') AS day, SUM(ok) AS up, COUNT(*) AS total, CAST(AVG(ms) AS INTEGER) AS avgMs
      FROM checks GROUP BY service, day ORDER BY day`).all() as { service: string; day: string; up: number; total: number; avgMs: number | null }[]
    const want: Record<string, unknown[]> = {}
    for (const r of raw) (want[r.service] ??= []).push({ day: r.day, up: r.up, total: r.total, avgMs: r.avgMs })
    expect(await store.days(t0 - DAY)).toEqual(want)
    expect((await store.days(t0 + DAY)).archive.map(d => d.day)).toEqual(['2026-10-02'])
  })

  it('prunes checks and day totals together', async () => {
    const { db, binding } = d1(), store = d1Store(binding)
    const t0 = Date.UTC(2026, 9, 1, 12)
    await store.record(t0, [result('archive', 'up', 100)])
    await store.record(t0 + 36 * DAY, [result('archive', 'up', 100)])
    await store.prune(t0 + DAY)
    expect(db.prepare('SELECT COUNT(*) AS n FROM checks').get()).toEqual({ n: 1 })
    expect(db.prepare('SELECT day FROM check_days').all()).toEqual([{ day: '2026-11-06' }])
  })
})
