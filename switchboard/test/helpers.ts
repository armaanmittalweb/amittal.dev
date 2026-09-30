import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import type { Sql } from '../src/sql'

/** node:sqlite behind the same interface as D1, loaded with the real schema. */
export function sqliteSql(): Sql & { db: DatabaseSync } {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync(fileURLToPath(new URL('../schema.sql', import.meta.url).href), 'utf8'))
  const args = (p: unknown[]) => p.map(v => (v === undefined ? null : v)) as (string | number | null)[]
  return {
    db,
    async all<T>(query: string, ...params: unknown[]) {
      return db.prepare(query).all(...args(params)) as T[]
    },
    async run(query, ...params) {
      db.prepare(query).run(...args(params))
    },
    async batch(statements) {
      db.exec('BEGIN')
      try {
        for (const [q, ...p] of statements) db.prepare(q).run(...args(p))
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
    async size() {
      return 4096
    },
  }
}
