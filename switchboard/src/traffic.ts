/**
 * Page-view counting for every site, without cookies or ids.
 *
 * Each site sends `{ s: site, p: path, r: referrer }` as a text/plain beacon to POST /hit. We keep
 * counts per site, UTC day and path, plus counts by referrer site, country and device type. Unique
 * visitors are a hash of (daily salt, IP, user agent, site); the salt is deleted after two days, so
 * yesterday's hashes cannot be recomputed or linked to today's.
 */
import { SERVICES } from './services'
import { getSetting, setSetting, type Sql } from './sql'

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|curl|wget|python|axios|node-fetch|go-http|playwright|puppeteer/i
const MAX_PATH = 120

export type Device = 'mobile' | 'tablet' | 'desktop'

export interface Hit {
  site: string
  path: string
  /** The referring site's host, or null for direct visits and links from our own sites. */
  ref: string | null
}

/** Validates a beacon. Returns null (and the beacon is dropped) for bots, unknown sites and spoofed origins. */
export function readHit(body: string, origin: string | null, ua: string): Hit | null {
  if (!ua || BOT.test(ua)) return null
  let data: { s?: unknown; p?: unknown; r?: unknown }
  try {
    data = JSON.parse(body)
  } catch {
    return null
  }
  const svc = SERVICES.find(s => s.id === data.s)
  if (!svc || typeof data.p !== 'string') return null
  const allowed = [svc.origin, ...(svc.id === 'archive' ? ['https://amittal.dev'] : [])]
  if (!origin || !allowed.includes(origin)) return null
  const path = ('/' + data.p.split(/[?#]/)[0].replace(/^\/+/, '')).slice(0, MAX_PATH)
  return { site: svc.id, path, ref: refHost(data.r) }
}

function refHost(r: unknown): string | null {
  if (typeof r !== 'string' || !r) return null
  try {
    const host = new URL(r).hostname.replace(/^www\./, '')
    return host === 'amittal.dev' || host.endsWith('.amittal.dev') ? null : host.slice(0, 80)
  } catch {
    return null
  }
}

export function deviceOf(ua: string): Device {
  if (/iPad|Tablet/i.test(ua)) return 'tablet'
  return /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop'
}

export const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)

let saltCache: { day: string; value: string } | null = null

/** Today's visitor salt: created on first use, shared by every isolate through the settings table. */
async function saltFor(sql: Sql, day: string): Promise<string> {
  if (saltCache?.day === day) return saltCache.value
  const key = 'salt:' + day
  await sql.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', key, crypto.randomUUID())
  const value = (await getSetting(sql, key))!
  saltCache = { day, value }
  return value
}

async function visitorHash(salt: string, ip: string, ua: string, site: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode([salt, ip, ua, site].join('|')))
  return Array.from(new Uint8Array(digest).slice(0, 8), b => b.toString(16).padStart(2, '0')).join('')
}

export async function recordHit(sql: Sql, hit: Hit, meta: { ip: string; ua: string; country: string | null; now: number }) {
  const day = dayOf(meta.now)
  const h = await visitorHash(await saltFor(sql, day), meta.ip, meta.ua, hit.site)
  const dim = 'INSERT INTO dims (site, day, kind, value, n) VALUES (?, ?, ?, ?, 1) ON CONFLICT (site, day, kind, value) DO UPDATE SET n = n + 1'
  await sql.batch([
    ['INSERT INTO views (site, day, path, n) VALUES (?, ?, ?, 1) ON CONFLICT (site, day, path) DO UPDATE SET n = n + 1', hit.site, day, hit.path],
    ['INSERT OR IGNORE INTO visitors (site, day, h) VALUES (?, ?, ?)', hit.site, day, h],
    [dim, hit.site, day, 'ref', hit.ref ?? '(direct)'],
    [dim, hit.site, day, 'country', meta.country ?? '??'],
    [dim, hit.site, day, 'device', deviceOf(meta.ua)],
  ])
}

export interface Count { label: string; n: number }

export interface Traffic {
  site: string | null
  days: number
  from: string
  to: string
  totals: { views: number; visitors: number }
  series: { day: string; views: number; visitors: number }[]
  sites: { site: string; views: number; visitors: number }[]
  pages: { site: string; path: string; n: number }[]
  refs: Count[]
  countries: Count[]
  devices: Count[]
}

/** Everything the Traffic screen draws, for one site (or all when null) over the last `days` days. */
export async function trafficReport(sql: Sql, site: string | null, days: number, now: number): Promise<Traffic> {
  const to = dayOf(now)
  const from = dayOf(now - (days - 1) * 86_400_000)
  const where = site ? 'day >= ? AND site = ?' : 'day >= ?'
  const args = site ? [from, site] : [from]

  const [views, visitors, perSiteViews, perSiteVisitors, pages, dims] = await Promise.all([
    sql.all<{ day: string; n: number }>(`SELECT day, SUM(n) AS n FROM views WHERE ${where} GROUP BY day`, ...args),
    sql.all<{ day: string; n: number }>(`SELECT day, COUNT(*) AS n FROM visitors WHERE ${where} GROUP BY day`, ...args),
    sql.all<{ site: string; n: number }>('SELECT site, SUM(n) AS n FROM views WHERE day >= ? GROUP BY site', from),
    sql.all<{ site: string; n: number }>('SELECT site, COUNT(*) AS n FROM visitors WHERE day >= ? GROUP BY site', from),
    sql.all<{ site: string; path: string; n: number }>(
      `SELECT site, path, SUM(n) AS n FROM views WHERE ${where} GROUP BY site, path ORDER BY n DESC LIMIT 15`, ...args),
    sql.all<{ kind: string; value: string; n: number }>(
      `SELECT kind, value, SUM(n) AS n FROM dims WHERE ${where} GROUP BY kind, value ORDER BY n DESC`, ...args),
  ])

  const byDay = (rows: { day: string; n: number }[]) => new Map(rows.map(r => [r.day, Number(r.n)]))
  const v = byDay(views), u = byDay(visitors)
  const series = Array.from({ length: days }, (_, i) => {
    const day = dayOf(now - (days - 1 - i) * 86_400_000)
    return { day, views: v.get(day) ?? 0, visitors: u.get(day) ?? 0 }
  })
  const siteVisitors = new Map(perSiteVisitors.map(r => [r.site, Number(r.n)]))
  const top = (kind: string, limit = 10) => dims.filter(d => d.kind === kind).slice(0, limit).map(d => ({ label: d.value, n: Number(d.n) }))

  return {
    site, days, from, to,
    totals: { views: series.reduce((a, d) => a + d.views, 0), visitors: series.reduce((a, d) => a + d.visitors, 0) },
    series,
    sites: perSiteViews.map(r => ({ site: r.site, views: Number(r.n), visitors: siteVisitors.get(r.site) ?? 0 })).sort((a, b) => b.views - a.views),
    pages: pages.map(p => ({ ...p, n: Number(p.n) })),
    refs: top('ref'),
    countries: top('country'),
    devices: top('device', 3),
  }
}

/** Once a day: drop old counts, old visitor hashes and every salt but today's and yesterday's. */
export async function pruneTraffic(sql: Sql, now: number) {
  const today = dayOf(now)
  if ((await getSetting(sql, 'traffic:pruned')) === today) return
  await sql.batch([
    ['DELETE FROM views WHERE day < ?', dayOf(now - 400 * 86_400_000)],
    ['DELETE FROM dims WHERE day < ?', dayOf(now - 400 * 86_400_000)],
    ['DELETE FROM visitors WHERE day < ?', dayOf(now - 90 * 86_400_000)],
    ["DELETE FROM settings WHERE key LIKE 'salt:%' AND key < ?", 'salt:' + dayOf(now - 86_400_000)],
  ])
  await setSetting(sql, 'traffic:pruned', today)
}
