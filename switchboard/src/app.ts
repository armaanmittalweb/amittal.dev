import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { checkAll, type Probe, type Result } from './checks'
import { SERVICES, liveIds } from './services'
import type { Sql } from './sql'
import type { UptimeStore } from './store'
import { readHit, recordHit } from './traffic'

/** The Workers rate limiting binding. */
export interface Limiter {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

export interface Bindings {
  DB: D1Database
  /** Service binding to the EduSched API Worker. */
  EDUSCHED?: Fetcher
  /** Service binding to the OpeningOS sync Worker (admin stats only). */
  OPENINGOS?: Fetcher
  /** Comma-separated ids of the services that are deployed and should be checked. The admin can override it (settings.live). */
  LIVE?: string
  /** The admin dashboard's static files (admin-ui/dist). */
  ASSETS?: Fetcher
  /** Hostname that serves the admin dashboard instead of the public API. */
  ADMIN_HOST?: string
  HIT_LIMITER?: Limiter
  LOGIN_LIMITER?: Limiter
  // Secrets (wrangler secret put). Everything but the first two is optional.
  ADMIN_PASSWORD_HASH?: string
  SESSION_SECRET?: string
  INTERNAL_KEY?: string
  CF_API_TOKEN?: string
  CF_ACCOUNT_ID?: string
  NEON_API_KEY?: string
  NEON_PROJECTS?: string
  VERCEL_TOKEN?: string
  VERCEL_TEAM_ID?: string
  NTFY_TOPIC?: string
}

export interface Deps {
  store(env: Bindings): UptimeStore
  probe(env: Bindings): Probe
  now?(): number
  /** The newer tables (traffic, alerts, settings). Without it, /hit accepts beacons but keeps nothing. */
  sql?(env: Bindings): Sql
  /** Which services to check. Defaults to the LIVE var. */
  live?(env: Bindings): Promise<Set<string>>
}

export const liveOf = (deps: Deps, env: Bindings) => (deps.live ? deps.live(env) : Promise.resolve(liveIds(env.LIVE)))

export const ORIGINS = ['https://www.amittal.dev', 'https://amittal.dev', 'http://localhost:5173']
export const STATUS_TTL_MS = 30_000
export const UPTIME_DAYS = 30

/** Public URLs are fetched; bound Workers are called directly. */
export function defaultProbe(env: Bindings): Probe {
  return (svc, signal) => {
    if ('url' in svc.check) return fetch(svc.check.url, { method: 'GET', signal, headers: { 'user-agent': 'amittal-switchboard' } })
    const target = env[svc.check.binding]
    if (!target) return Promise.reject(new Error('binding ' + svc.check.binding + ' is not configured'))
    return target.fetch('https://' + svc.id + svc.check.path, { signal })
  }
}

export function createApp(deps: Deps) {
  const now = deps.now ?? Date.now
  // One status snapshot per isolate, reused for STATUS_TTL_MS, so a busy Lab costs one round of checks.
  let snapshot: { at: number; services: Result[] } | null = null

  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', cors({ origin: ORIGINS, allowMethods: ['GET', 'POST', 'OPTIONS'], maxAge: 86400 }))

  app.get('/health', c => c.json({ status: 'ok' }))

  app.get('/status', async c => {
    if (!snapshot || now() - snapshot.at > STATUS_TTL_MS) {
      snapshot = { at: now(), services: await checkAll(SERVICES, await liveOf(deps, c.env), deps.probe(c.env)) }
    }
    c.header('cache-control', 'public, max-age=15')
    return c.json({ at: new Date(snapshot.at).toISOString(), services: snapshot.services })
  })

  app.get('/uptime', async c => {
    const since = now() - UPTIME_DAYS * 86_400_000
    c.header('cache-control', 'public, max-age=300')
    return c.json({ days: UPTIME_DAYS, services: await deps.store(c.env).days(since) })
  })

  // Page-view beacons from every site (see traffic.ts). Always 204: a beacon never waits for an answer,
  // and a bot or a spoofed origin learns nothing from the response.
  app.post('/hit', async c => {
    const sql = deps.sql?.(c.env)
    const body = await c.req.text()
    if (!sql || body.length > 2000) return c.body(null, 204)
    const ip = c.req.header('cf-connecting-ip') ?? ''
    if (c.env.HIT_LIMITER && !(await c.env.HIT_LIMITER.limit({ key: ip || 'unknown' })).success) return c.body(null, 204)
    const ua = c.req.header('user-agent') ?? ''
    const hit = readHit(body, c.req.header('origin') ?? null, ua)
    const country = (c.req.raw as Request & { cf?: { country?: string } }).cf?.country ?? null
    if (hit) await recordHit(sql, hit, { ip, ua, country, now: now() })
    return c.body(null, 204)
  })

  // /edusched/api/... → the EduSched Worker's /api/..., through the service binding.
  app.all('/edusched/*', async c => {
    if (!c.env.EDUSCHED) return c.json({ error: 'EduSched is not connected yet' }, 503)
    const url = new URL(c.req.url)
    url.pathname = url.pathname.replace(/^\/edusched/, '') || '/'
    return c.env.EDUSCHED.fetch(new Request(url, c.req.raw))
  })

  app.notFound(c => c.json({ error: 'Not found' }, 404))
  return app
}

/** The cron: check every live service, keep the result, and drop rows older than 35 days. */
export async function recordChecks(env: Bindings, deps: Deps) {
  const now = (deps.now ?? Date.now)()
  const store = deps.store(env)
  await store.record(now, await checkAll(SERVICES, await liveOf(deps, env), deps.probe(env)))
  await store.prune(now - 35 * 86_400_000)
}
