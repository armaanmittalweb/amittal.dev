import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { checkAll, type Probe, type Result } from './checks'
import { SERVICES, liveIds } from './services'
import type { UptimeStore } from './store'

export interface Bindings {
  DB: D1Database
  /** Service binding to the EduSched API Worker. */
  EDUSCHED?: Fetcher
  /** Comma-separated ids of the services that are deployed and should be checked. */
  LIVE?: string
}

export interface Deps {
  store(env: Bindings): UptimeStore
  probe(env: Bindings): Probe
  now?(): number
}

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
      snapshot = { at: now(), services: await checkAll(SERVICES, liveIds(c.env.LIVE), deps.probe(c.env)) }
    }
    c.header('cache-control', 'public, max-age=15')
    return c.json({ at: new Date(snapshot.at).toISOString(), services: snapshot.services })
  })

  app.get('/uptime', async c => {
    const since = now() - UPTIME_DAYS * 86_400_000
    c.header('cache-control', 'public, max-age=300')
    return c.json({ days: UPTIME_DAYS, services: await deps.store(c.env).days(since) })
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
  await store.record(now, await checkAll(SERVICES, liveIds(env.LIVE), deps.probe(env)))
  await store.prune(now - 35 * 86_400_000)
}
