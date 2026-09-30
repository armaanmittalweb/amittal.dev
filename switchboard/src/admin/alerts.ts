/**
 * Alerts: conditions worth a look, kept in D1 and optionally pushed to a phone through ntfy.sh.
 *   - a live service failed its last two checks (critical);
 *   - a free-tier meter is at 70% (warn) or 90% (critical).
 * Each condition has a stable key, so a problem opens one alert, escalates it if it gets worse, and
 * resolves it when it clears.
 */
import type { Sql } from '../sql'
import type { Meter } from './resources'

export type Level = 'warn' | 'critical'

export interface Alert {
  key: string
  level: Level
  message: string
  openedAt: number
  resolvedAt: number | null
}

export interface Wanted { level: Level; message: string }

export const WARN_AT = 0.7
export const CRITICAL_AT = 0.9

export function pct(m: Pick<Meter, 'used' | 'limit'>) {
  return m.limit > 0 ? m.used / m.limit : 0
}

/** What should be open right now, from the latest checks (newest first per service) and meters. */
export function wantedAlerts(
  recent: Record<string, { ok: number; code: number | null }[]>,
  names: Record<string, string>,
  live: Set<string>,
  meters: Meter[],
): Map<string, Wanted> {
  const out = new Map<string, Wanted>()
  for (const id of live) {
    const last = recent[id] ?? []
    if (last.length >= 2 && !last[0].ok && !last[1].ok) {
      const code = last[0].code ? ` (last answer: HTTP ${last[0].code})` : ' (no answer)'
      out.set('down:' + id, { level: 'critical', message: `${names[id] ?? id} failed its last two checks${code}` })
    }
  }
  for (const m of meters) {
    const p = pct(m)
    if (p >= WARN_AT) out.set('meter:' + m.id, { level: p >= CRITICAL_AT ? 'critical' : 'warn', message: `${m.label} is at ${Math.round(p * 100)}% of the free limit` })
  }
  return out
}

export type Notify = (title: string, body: string, level: Level | 'resolved') => Promise<void>

/** Opens, escalates and resolves alert rows so they match `wanted`. Returns what changed. */
export async function syncAlerts(sql: Sql, wanted: Map<string, Wanted>, now: number, notify?: Notify) {
  const open = await sql.all<{ key: string; level: Level; message: string }>('SELECT key, level, message FROM alerts WHERE resolved_at IS NULL')
  const openByKey = new Map(open.map(a => [a.key, a]))
  const changes: { key: string; change: 'opened' | 'escalated' | 'resolved' }[] = []

  for (const [key, w] of wanted) {
    const cur = openByKey.get(key)
    if (!cur) {
      await sql.run(
        'INSERT INTO alerts (key, level, message, opened_at, resolved_at) VALUES (?, ?, ?, ?, NULL) ON CONFLICT (key) DO UPDATE SET level = excluded.level, message = excluded.message, opened_at = excluded.opened_at, resolved_at = NULL',
        key, w.level, w.message, now)
      changes.push({ key, change: 'opened' })
      await notify?.(w.level === 'critical' ? 'Critical: ' + w.message : w.message, w.message, w.level)
    } else if (cur.level === 'warn' && w.level === 'critical') {
      await sql.run('UPDATE alerts SET level = ?, message = ? WHERE key = ?', w.level, w.message, key)
      changes.push({ key, change: 'escalated' })
      await notify?.('Critical: ' + w.message, w.message, 'critical')
    } else if (cur.message !== w.message) {
      await sql.run('UPDATE alerts SET message = ? WHERE key = ?', w.message, key)
    }
  }
  for (const a of open) {
    if (wanted.has(a.key)) continue
    await sql.run('UPDATE alerts SET resolved_at = ? WHERE key = ?', now, a.key)
    changes.push({ key: a.key, change: 'resolved' })
    await notify?.('Resolved: ' + a.message, a.message, 'resolved')
  }
  await sql.run('DELETE FROM alerts WHERE resolved_at IS NOT NULL AND resolved_at < ?', now - 30 * 86_400_000)
  return changes
}

export async function listAlerts(sql: Sql): Promise<Alert[]> {
  const rows = await sql.all<{ key: string; level: Level; message: string; opened_at: number; resolved_at: number | null }>(
    'SELECT key, level, message, opened_at, resolved_at FROM alerts ORDER BY resolved_at IS NOT NULL, opened_at DESC LIMIT 40')
  return rows.map(r => ({ key: r.key, level: r.level, message: r.message, openedAt: Number(r.opened_at), resolvedAt: r.resolved_at === null ? null : Number(r.resolved_at) }))
}

/** Pushes to https://ntfy.sh/<topic>. The topic name is the only secret, so make it long and random. */
export function ntfy(topic: string | undefined, f: typeof fetch = fetch): Notify | undefined {
  if (!topic) return undefined
  return async (title, body, level) => {
    await f(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: 'POST',
      body,
      headers: {
        Title: title.slice(0, 120),
        Priority: level === 'critical' ? '5' : level === 'warn' ? '3' : '2',
        Tags: level === 'critical' ? 'rotating_light' : level === 'warn' ? 'warning' : 'white_check_mark',
        Click: 'https://admin.amittal.dev/',
      },
    }).catch(() => {})
  }
}
