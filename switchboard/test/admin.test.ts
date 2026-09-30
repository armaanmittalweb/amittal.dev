import { beforeEach, describe, expect, it } from 'vitest'
import { createApp, type Bindings } from '../src/app'
import { adminTick, createAdmin, type AdminDeps } from '../src/admin/app'
import { syncAlerts, wantedAlerts } from '../src/admin/alerts'
import { hashPassword, SESSION_COOKIE, signSession, verifyPassword, verifySession } from '../src/admin/auth'
import { collectResources, type Meter } from '../src/admin/resources'
import { liveIds, SERVICES } from '../src/services'
import { getSetting } from '../src/sql'
import { memoryStore } from '../src/store'
import { readHit, trafficReport } from '../src/traffic'
import { sqliteSql } from './helpers'

const T0 = Date.UTC(2026, 8, 30, 12, 0, 0)
const PASSWORD = 'correct horse battery staple'
const ORIGIN = 'https://admin.amittal.dev'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'

let passwordHash: string
beforeEach(async () => {
  passwordHash ??= await hashPassword(PASSWORD, 1000)
})

/** A binding that answers /internal/* like the project Workers, and records what it was asked. */
function fakeWorker(stats: Record<string, number>, calls: string[] = []) {
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init)
      calls.push(req.method + ' ' + new URL(req.url).pathname)
      if (req.headers.get('x-internal-key') !== 'ik') return new Response('{}', { status: 404 })
      if (new URL(req.url).pathname.endsWith('/stats')) return Response.json(stats)
      return Response.json({ deleted: 3 })
    },
  } as unknown as Fetcher
}

function setup(extra: Partial<Bindings> = {}) {
  const sql = sqliteSql(), store = memoryStore(), clock = { t: T0 }, sent: string[] = []
  const probe = () => async () => new Response('ok')
  const fakeFetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    sent.push(url)
    return new Response('{}', { status: url.includes('ntfy.sh') ? 200 : 500 })
  }) as typeof fetch
  const deps: AdminDeps = {
    store: () => store, probe, sql: () => sql, now: () => clock.t, fetch: fakeFetch,
    live: async env => liveIds((await getSetting(sql, 'live')) ?? env.LIVE),
  }
  const env = {
    DB: {} as D1Database, LIVE: 'archive,edusched', ADMIN_PASSWORD_HASH: passwordHash, SESSION_SECRET: 'session-secret',
    INTERNAL_KEY: 'ik',
    EDUSCHED: fakeWorker({ dbBytes: 40 * 1024 ** 2, overlays: 2, sandboxes24h: 5, users: 9 }),
    OPENINGOS: fakeWorker({ snapshots: 12, tableBytes: 90_000, maxTableBytes: 400_000_000, dbBytes: 30 * 1024 ** 2, written24h: 4, active30d: 10 }),
    ASSETS: { fetch: async () => new Response('<!doctype html><title>Switchboard</title>', { headers: { 'content-type': 'text/html' } }) } as unknown as Fetcher,
    ...extra,
  } as Bindings
  return { sql, store, clock, sent, deps, env, api: createApp(deps), admin: createAdmin(deps) }
}

type Setup = ReturnType<typeof setup>

async function login(s: Setup) {
  const res = await s.admin.request('/api/login', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify({ password: PASSWORD }) }, s.env)
  expect(res.status).toBe(200)
  return (res.headers.get('set-cookie') ?? '').split(';')[0]
}

const beacon = (s: Setup, body: object, headers: Record<string, string> = {}) =>
  s.api.request('/hit', { method: 'POST', headers: { 'content-type': 'text/plain', origin: 'https://openingos.amittal.dev', 'user-agent': UA, 'cf-connecting-ip': '203.0.113.7', ...headers }, body: JSON.stringify(body) }, s.env)

describe('page-view beacons', () => {
  it('counts a view, a visitor, the referrer site, country and device', async () => {
    const s = setup()
    expect((await beacon(s, { s: 'openingos', p: '/drill?x=1#y', r: 'https://www.google.com/search?q=chess' })).status).toBe(204)
    await beacon(s, { s: 'openingos', p: '/drill', r: 'https://openingos.amittal.dev/' })
    await beacon(s, { s: 'openingos', p: '/', r: '' }, { 'user-agent': PHONE, 'cf-connecting-ip': '198.51.100.2' })
    const r = await trafficReport(s.sql, 'openingos', 7, T0)
    expect(r.totals).toEqual({ views: 3, visitors: 2 })
    expect(r.pages[0]).toEqual({ site: 'openingos', path: '/drill', n: 2 })
    expect(r.refs).toEqual(expect.arrayContaining([{ label: 'google.com', n: 1 }, { label: '(direct)', n: 2 }]))
    expect(r.devices).toEqual(expect.arrayContaining([{ label: 'desktop', n: 2 }, { label: 'mobile', n: 1 }]))
    expect(r.series).toHaveLength(7)
    expect(r.series.at(-1)).toMatchObject({ views: 3, visitors: 2 })
  })

  it('drops bots, unknown sites and beacons from the wrong origin', async () => {
    expect(readHit(JSON.stringify({ s: 'openingos', p: '/' }), 'https://openingos.amittal.dev', 'Googlebot/2.1')).toBeNull()
    expect(readHit(JSON.stringify({ s: 'nope', p: '/' }), 'https://openingos.amittal.dev', UA)).toBeNull()
    expect(readHit(JSON.stringify({ s: 'openingos', p: '/' }), 'https://evil.example', UA)).toBeNull()
    expect(readHit(JSON.stringify({ s: 'archive', p: '/lab' }), 'https://amittal.dev', UA)).toMatchObject({ site: 'archive', path: '/lab' })
    expect(readHit('not json', 'https://openingos.amittal.dev', UA)).toBeNull()
  })

  it('does not link visitors across days', async () => {
    const s = setup()
    await beacon(s, { s: 'openingos', p: '/' })
    s.clock.t += 86_400_000
    await beacon(s, { s: 'openingos', p: '/' })
    const rows = s.sql.db.prepare('SELECT h FROM visitors ORDER BY day').all() as { h: string }[]
    expect(rows).toHaveLength(2)
    expect(rows[0].h).not.toBe(rows[1].h)
  })
})

describe('admin login', () => {
  it('hashes and verifies passwords, and rejects tampered hashes', async () => {
    expect(await verifyPassword(PASSWORD, passwordHash)).toBe(true)
    expect(await verifyPassword('wrong', passwordHash)).toBe(false)
    expect(await verifyPassword(PASSWORD, passwordHash.replace('pbkdf2_sha256$1000', 'pbkdf2_sha256$1001'))).toBe(false)
    expect(await verifyPassword(PASSWORD, undefined)).toBe(false)
  })

  it('signs sessions that expire and cannot be forged', async () => {
    const token = await signSession('k', T0)
    expect(await verifySession('k', token, T0 + 1000)).toBe(true)
    expect(await verifySession('other', token, T0 + 1000)).toBe(false)
    expect(await verifySession('k', token, T0 + 8 * 86_400_000)).toBe(false)
    expect(await verifySession('k', token.replace(/^\d+/, String(T0 + 99 * 86_400_000)), T0)).toBe(false)
  })

  it('keeps the API closed until you log in', async () => {
    const s = setup()
    expect((await s.admin.request('/api/overview', {}, s.env)).status).toBe(401)
    const wrong = await s.admin.request('/api/login', { method: 'POST', headers: { origin: ORIGIN }, body: JSON.stringify({ password: 'nope' }) }, s.env)
    expect(wrong.status).toBe(401)
    const cookie = await login(s)
    expect(cookie.startsWith(SESSION_COOKIE + '=')).toBe(true)
    expect((await s.admin.request('/api/overview', { headers: { cookie } }, s.env)).status).toBe(200)
    expect(await (await s.admin.request('/api/session', { headers: { cookie } }, s.env)).json()).toMatchObject({ authed: true })
  })

  it('refuses logins and actions that do not come from the dashboard', async () => {
    const s = setup()
    const res = await s.admin.request('/api/login', { method: 'POST', headers: { origin: 'https://evil.example' }, body: JSON.stringify({ password: PASSWORD }) }, s.env)
    expect(res.status).toBe(403)
    const cookie = await login(s)
    expect((await s.admin.request('/api/actions/check-now', { method: 'POST', headers: { cookie } }, s.env)).status).toBe(403)
    expect((await s.admin.request('/api/actions/check-now', { method: 'POST', headers: { cookie, origin: ORIGIN } }, s.env)).status).toBe(200)
  })

  it('answers 429 when the login limiter says no', async () => {
    const s = setup({ LOGIN_LIMITER: { limit: async () => ({ success: false }) } })
    const res = await s.admin.request('/api/login', { method: 'POST', headers: { origin: ORIGIN }, body: JSON.stringify({ password: PASSWORD }) }, s.env)
    expect(res.status).toBe(429)
  })

  it('serves the dashboard files with a strict CSP and noindex', async () => {
    const s = setup()
    const res = await s.admin.request('/traffic', {}, s.env)
    expect(await res.text()).toContain('Switchboard')
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'")
    expect(res.headers.get('x-robots-tag')).toContain('noindex')
  })
})

describe('resources', () => {
  it('reads database sizes over the bindings and says which tokens are missing', async () => {
    const s = setup()
    const res = await collectResources(s.env, s.sql, T0, s.deps.fetch)
    const ids = res.meters.map(m => m.id)
    expect(ids).toEqual(expect.arrayContaining(['neon-edusched', 'neon-openingos', 'sync-cap', 'd1-switchboard']))
    expect(res.meters.find(m => m.id === 'neon-edusched')?.used).toBe(40 * 1024 ** 2)
    expect(Object.fromEntries(res.connections.map(c => [c.id, c.state]))).toEqual({ bindings: 'connected', cloudflare: 'missing', neon: 'missing', vercel: 'missing', ntfy: 'missing' })
  })

  it('reads Worker requests and D1 rows from Cloudflare when a token is set', async () => {
    const s = setup({ CF_API_TOKEN: 't', CF_ACCOUNT_ID: 'acct' })
    const f = (async () => Response.json({ data: { viewer: { accounts: [{
      workers: [{ sum: { requests: 900, errors: 2 }, dimensions: { scriptName: 'switchboard' } }, { sum: { requests: 100, errors: 0 }, dimensions: { scriptName: 'edusched-api' } }],
      d1: [{ sum: { rowsRead: 5000, rowsWritten: 300 } }],
    }] } } })) as unknown as typeof fetch
    const res = await collectResources(s.env, s.sql, T0, f)
    expect(res.meters.find(m => m.id === 'workers-requests')).toMatchObject({ used: 1000, limit: 100_000 })
    expect(res.meters.find(m => m.id === 'd1-rows-written')).toMatchObject({ used: 300 })
    expect(res.workers[0]).toEqual({ script: 'switchboard', requests: 900, errors: 2 })
  })

  it('reports a broken binding instead of failing the whole snapshot', async () => {
    const s = setup({ INTERNAL_KEY: 'wrong' })
    const res = await collectResources(s.env, s.sql, T0, s.deps.fetch)
    expect(res.connections.find(c => c.id === 'bindings')?.state).toBe('error')
    expect(res.projects.edusched).toMatchObject({ error: expect.stringContaining('404') })
    expect(res.meters.some(m => m.id === 'd1-switchboard')).toBe(true)
  })
})

describe('alerts', () => {
  const meter = (used: number): Meter => ({ id: 'neon-edusched', group: 'Neon', label: 'EduSched database', used, limit: 100, unit: 'bytes', period: 'now' })
  const names = Object.fromEntries(SERVICES.map(s => [s.id, s.name]))

  it('opens on two failed checks, escalates meters, and resolves when things clear', async () => {
    const s = setup(), pushed: string[] = []
    const notify = async (title: string) => { pushed.push(title) }
    const live = new Set(['edusched'])
    const down = { edusched: [{ ok: 0, code: 503 }, { ok: 0, code: 503 }] }

    await syncAlerts(s.sql, wantedAlerts(down, names, live, [meter(75)]), T0, notify)
    let rows = s.sql.db.prepare('SELECT key, level FROM alerts WHERE resolved_at IS NULL ORDER BY key').all()
    expect(rows).toEqual([{ key: 'down:edusched', level: 'critical' }, { key: 'meter:neon-edusched', level: 'warn' }])

    await syncAlerts(s.sql, wantedAlerts(down, names, live, [meter(95)]), T0 + 1, notify)
    expect(s.sql.db.prepare("SELECT level FROM alerts WHERE key = 'meter:neon-edusched'").get()).toEqual({ level: 'critical' })

    await syncAlerts(s.sql, wantedAlerts({ edusched: [{ ok: 1, code: 200 }, { ok: 0, code: 503 }] }, names, live, [meter(10)]), T0 + 2, notify)
    rows = s.sql.db.prepare('SELECT key FROM alerts WHERE resolved_at IS NULL').all()
    expect(rows).toEqual([])
    expect(pushed).toEqual([
      'Critical: EduSched failed its last two checks (last answer: HTTP 503)',
      'EduSched database is at 75% of the free limit',
      'Critical: EduSched database is at 95% of the free limit',
      'Resolved: EduSched failed its last two checks (last answer: HTTP 503)',
      'Resolved: EduSched database is at 95% of the free limit',
    ])
  })

  it('ignores a single failed check and services that are not live', async () => {
    const w = wantedAlerts({ edusched: [{ ok: 0, code: 500 }, { ok: 1, code: 200 }], safespace: [{ ok: 0, code: null }, { ok: 0, code: null }] }, names, new Set(['edusched']), [])
    expect(w.size).toBe(0)
  })

  it('the cron refreshes resources, raises alerts and pushes them to ntfy', async () => {
    const s = setup({ NTFY_TOPIC: 'my-topic', EDUSCHED: fakeWorker({ dbBytes: 500 * 1024 ** 2, overlays: 0, sandboxes24h: 0, users: 1 }) })
    await adminTick(s.env, s.deps)
    expect(await getSetting(s.sql, 'resources')).toContain('neon-edusched')
    expect(s.sql.db.prepare('SELECT key, level FROM alerts').all()).toEqual([{ key: 'meter:neon-edusched', level: 'critical' }])
    expect(s.sent.some(u => u === 'https://ntfy.sh/my-topic')).toBe(true)
  })
})

describe('actions', () => {
  it('changes which services are watched without a deploy', async () => {
    const s = setup()
    const cookie = await login(s)
    const res = await s.admin.request('/api/actions/set-live', { method: 'POST', headers: { cookie, origin: ORIGIN }, body: JSON.stringify({ id: 'safespace', live: true }) }, s.env)
    expect(res.status).toBe(200)
    const status = (await (await s.api.request('/status', {}, s.env)).json()) as { services: { id: string; state: string }[] }
    expect(status.services.find(x => x.id === 'safespace')?.state).toBe('up')
  })

  it('runs cleanup jobs on the project Workers', async () => {
    const calls: string[] = []
    const s = setup({ OPENINGOS: fakeWorker({}, calls) })
    const cookie = await login(s)
    const res = await s.admin.request('/api/actions/prune-openingos', { method: 'POST', headers: { cookie, origin: ORIGIN } }, s.env)
    expect(await res.json()).toMatchObject({ ok: true, message: 'Deleted 3 snapshots untouched for a year.' })
    expect(calls).toEqual(['POST /internal/prune'])
  })

  it('explains what is missing instead of failing silently', async () => {
    const s = setup()
    const cookie = await login(s)
    const res = await s.admin.request('/api/actions/redeploy', { method: 'POST', headers: { cookie, origin: ORIGIN }, body: JSON.stringify({ site: 'openingos' }) }, s.env)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'VERCEL_TOKEN is not set' })
  })
})
