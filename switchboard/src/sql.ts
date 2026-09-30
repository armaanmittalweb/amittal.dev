/**
 * The SQL the Switchboard's newer tables need, over D1 in production and node:sqlite in tests.
 * Both are SQLite, so the statements are the same.
 */
export interface Sql {
  all<T = Record<string, unknown>>(query: string, ...params: unknown[]): Promise<T[]>
  run(query: string, ...params: unknown[]): Promise<void>
  /** Runs the statements together (one round trip on D1). */
  batch(statements: [string, ...unknown[]][]): Promise<void>
  /** The database's size in bytes, when the driver reports it. */
  size(): Promise<number | null>
}

export function d1Sql(db: D1Database): Sql {
  return {
    async all<T>(query: string, ...params: unknown[]) {
      return (await db.prepare(query).bind(...params).all<T>()).results
    },
    async run(query, ...params) {
      await db.prepare(query).bind(...params).run()
    },
    async batch(statements) {
      if (statements.length) await db.batch(statements.map(([q, ...p]) => db.prepare(q).bind(...p)))
    },
    async size() {
      const { meta } = await db.prepare('SELECT 1').run()
      return typeof meta.size_after === 'number' ? meta.size_after : null
    },
  }
}

/** Reads one row of the settings table (small key/value state such as the live list and cached snapshots). */
export async function getSetting(sql: Sql, key: string): Promise<string | null> {
  const [row] = await sql.all<{ value: string }>('SELECT value FROM settings WHERE key = ?', key)
  return row?.value ?? null
}

export async function setSetting(sql: Sql, key: string, value: string) {
  await sql.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', key, value)
}
