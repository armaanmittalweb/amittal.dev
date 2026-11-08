/**
 * admin.amittal.dev: the dashboard's JSON API under /api/*, and its static files for everything else.
 * Every /api route but session and login needs the session cookie; every POST must come from the
 * dashboard's own origin (the cookie is SameSite=Strict as well).
 */
import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { liveOf, recordChecks, type Bindings, type Deps } from '../app'
import { SERVICES } from '../services'
import { getSetting, setSetting, type Sql } from '../sql'
import { dayOf, pruneTraffic, trafficReport } from '../traffic'
import { floodAlerts, listAlerts, ntfy, syncAlerts, wantedAlerts, type Wanted } from './alerts'
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession, verifyPassword } from './auth'
import { adsense } from './adsense'
import { indexNow, launchChecks } from './chaotic'
import { callInternal, collectResources, redeploy, REFRESH_MS, type Resources } from './resources'

export interface AdminDeps extends Deps {
  sql(env: Bindings): Sql
  fetch?: typeof fetch
}

type Env = { Bindings: Bindings }
const DAY = 86_400_000

const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'"

/**
 * True when the request comes from the dashboard's own pages. Compares the host only: production is
 * HTTPS-only, and `wrangler dev` rewrites Origin to http://<first route>. Local dev on localhost is
 * allowed too; the cookie is SameSite=Strict, so another site could not use it anyway.
 */
function fromDashboard(c: Context<Env>) {
  try {
    const { host, hostname } = new URL(c.req.header('origin') ?? '')
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true
    // Either console's own pages (admin.amittal.dev, dash.chaotictails.com). The session cookie is per host and
    // SameSite=Strict, so a page on one cannot act with the other's session.
    const consoles = [c.env.ADMIN_HOST ?? 'admin.amittal.dev', c.env.DASH_HOST ?? 'dash.chaotictails.com']
    return consoles.includes(host)
  } catch {
    return false
  }
}

/** The last few checks per service, newest first. */
async function recentChecks(sql: Sql, now: number) {
  const rows = await sql.all<{ service: string; at: number; ok: number; ms: number | null; code: number | null }>(
    'SELECT service, at, ok, ms, code FROM checks WHERE at >= ? ORDER BY at DESC', now - 2 * 3_600_000)
  const out: Record<string, { at: number; ok: number; ms: number | null; code: number | null }[]> = {}
  for (const r of rows) {
    const list = (out[r.service] ??= [])
    if (list.length < 24) list.push({ at: Number(r.at), ok: Number(r.ok), ms: r.ms === null ? null : Number(r.ms), code: r.code === null ? null : Number(r.code) })
  }
  return out
}

async function cachedResources(sql: Sql): Promise<Resources | null> {
  const raw = await getSetting(sql, 'resources')
  return raw ? (JSON.parse(raw) as Resources) : null
}

async function freshResources(env: Bindings, deps: AdminDeps, now: number) {
  const sql = deps.sql(env)
  const res = await collectResources(env, sql, now, deps.fetch)
  await setSetting(sql, 'resources', JSON.stringify(res))
  return res
}

/** Re-evaluates alerts from the latest checks and the cached (or given) resource snapshot. */
async function evaluate(env: Bindings, deps: AdminDeps, now: number, resources?: Resources | null) {
  const sql = deps.sql(env)
  const res = resources ?? (await cachedResources(sql))
  const names = Object.fromEntries(SERVICES.map(s => [s.id, s.name]))
  const wanted = wantedAlerts(await recentChecks(sql, now), names, await liveOf(deps, env), res?.meters ?? [])
  // Flood alerts are worked out by the cron (floodCheck) and kept, so an evaluation from a button keeps them open.
  const flood = JSON.parse((await getSetting(sql, 'flood')) ?? '[]') as [string, Wanted][]
  for (const [k, w] of flood) wanted.set(k, w)
  return syncAlerts(sql, wanted, now, ntfy(env.NTFY_TOPIC, deps.fetch))
}

/** Chaotic Tails' rooms since the last tick (from today's count in IST; a new day starts it again) and rooms open now. */
async function floodCheck(env: Bindings, sql: Sql, now: number) {
  try {
    const g = (await callInternal(env, 'GAMES', '/internal/stats')) as unknown as { liveRooms: number; today: { rooms: number } }
    const was = JSON.parse((await getSetting(sql, 'flood-last')) ?? 'null') as { at: number; rooms: number } | null
    const fresh = was && now - was.at < 11 * 60_000 && g.today.rooms >= was.rooms
    const newRooms = was && fresh ? Math.round(((g.today.rooms - was.rooms) * 5 * 60_000) / Math.max(60_000, now - was.at)) : null
    await setSetting(sql, 'flood-last', JSON.stringify({ at: now, rooms: g.today.rooms }))
    await setSetting(sql, 'flood', JSON.stringify([...floodAlerts(newRooms, g.liveRooms ?? 0)]))
  } catch {
    // The games Worker did not answer: its own down alert covers that; the last flood state stays.
  }
}

/** The cron's admin work, after each round of checks: resources every 6 hours, alerts every time, traffic pruning daily. */
export async function adminTick(env: Bindings, deps: AdminDeps) {
  const now = (deps.now ?? Date.now)()
  const sql = deps.sql(env)
  let res = await cachedResources(sql)
  if (!res || now - res.at > REFRESH_MS) res = await freshResources(env, deps, now)
  await floodCheck(env, sql, now)
  await evaluate(env, deps, now, res)
  await pruneTraffic(sql, now)
}

export function createAdmin(deps: AdminDeps) {
  const now = deps.now ?? Date.now
  const app = new Hono<Env>()

  app.use('*', async (c, next) => {
    await next()
    c.header('X-Robots-Tag', 'noindex, nofollow')
    c.header('Referrer-Policy', 'no-referrer')
    c.header('X-Content-Type-Options', 'nosniff')
    c.header('Content-Security-Policy', CSP)
    if (c.req.path.startsWith('/api/')) c.header('Cache-Control', 'no-store')
  })

  const authed = (c: Context<Env>) => verifySession(c.env.SESSION_SECRET, getCookie(c, SESSION_COOKIE), now())

  app.get('/api/session', async c => c.json({ authed: await authed(c), configured: Boolean(c.env.ADMIN_PASSWORD_HASH && c.env.SESSION_SECRET) }))

  app.post('/api/login', async c => {
    if (!fromDashboard(c)) return c.json({ error: 'Forbidden' }, 403)
    if (!c.env.ADMIN_PASSWORD_HASH || !c.env.SESSION_SECRET) return c.json({ error: 'The admin password is not set up yet. See the Switchboard README.' }, 503)
    const ip = c.req.header('cf-connecting-ip') ?? 'unknown'
    if (c.env.LOGIN_LIMITER && !(await c.env.LOGIN_LIMITER.limit({ key: ip })).success) return c.json({ error: 'Too many tries. Wait a minute and try again.' }, 429)
    const { password } = (await c.req.json().catch(() => ({}))) as { password?: unknown }
    if (typeof password !== 'string' || password.length > 256 || !(await verifyPassword(password, c.env.ADMIN_PASSWORD_HASH))) {
      return c.json({ error: 'That password is not right.' }, 401)
    }
    setCookie(c, SESSION_COOKIE, await signSession(c.env.SESSION_SECRET, now()), { httpOnly: true, secure: true, sameSite: 'Strict', path: '/', maxAge: SESSION_DAYS * 86400 })
    return c.json({ ok: true })
  })

  app.post('/api/logout', c => {
    if (!fromDashboard(c)) return c.json({ error: 'Forbidden' }, 403)
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true })
    return c.json({ ok: true })
  })

  app.use('/api/*', async (c, next) => {
    if (!(await authed(c))) return c.json({ error: 'Signed out' }, 401)
    if (c.req.method !== 'GET' && !fromDashboard(c)) return c.json({ error: 'Forbidden' }, 403)
    await next()
  })

  app.get('/api/overview', async c => {
    const t = now(), sql = deps.sql(c.env)
    const [live, days, recent, alerts, resources, week, todayViews, todayVisitors] = await Promise.all([
      liveOf(deps, c.env),
      deps.store(c.env).days(t - 30 * DAY),
      recentChecks(sql, t),
      listAlerts(sql),
      cachedResources(sql),
      trafficReport(sql, null, 7, t),
      sql.all<{ site: string; n: number }>('SELECT site, SUM(n) AS n FROM views WHERE day = ? GROUP BY site', dayOf(t)),
      sql.all<{ site: string; n: number }>('SELECT site, COUNT(*) AS n FROM visitors WHERE day = ? GROUP BY site', dayOf(t)),
    ])
    const tv = new Map(todayViews.map(r => [r.site, Number(r.n)])), tu = new Map(todayVisitors.map(r => [r.site, Number(r.n)]))
    return c.json({
      now: t,
      services: SERVICES.map(s => ({
        id: s.id, name: s.name, hosts: s.hosts, origin: s.origin, live: live.has(s.id),
        recent: recent[s.id] ?? [], days: days[s.id] ?? [],
        today: { views: tv.get(s.id) ?? 0, visitors: tu.get(s.id) ?? 0 },
      })),
      alerts,
      resources,
      week: { totals: week.totals, series: week.series },
    })
  })

  app.get('/api/traffic', async c => {
    const site = c.req.query('site') || null
    if (site && !SERVICES.some(s => s.id === site)) return c.json({ error: 'Unknown site' }, 400)
    const days = [7, 30, 90].includes(Number(c.req.query('days'))) ? Number(c.req.query('days')) : 30
    return c.json(await trafficReport(deps.sql(c.env), site, days, now()))
  })

  app.get('/api/resources', async c => {
    const res = c.req.query('fresh') ? await freshResources(c.env, deps, now()) : await cachedResources(deps.sql(c.env))
    if (c.req.query('fresh')) await evaluate(c.env, deps, now(), res)
    return c.json(res)
  })

  app.get('/api/alerts', async c => c.json(await listAlerts(deps.sql(c.env))))

  // The Game Night page: games.amittal.dev's product numbers, worked out live by its Stats object (src/analytics.ts there).
  app.get('/api/games', async c => {
    const days = Math.max(0, Math.min(365, Math.floor(Number(c.req.query('days') ?? 30)) || 0))
    try {
      return c.json(await callInternal(c.env, 'GAMES', `/internal/analytics?days=${days}`))
    } catch (e) {
      return c.json({ error: `Could not read Game Night: ${e instanceof Error ? e.message : 'no answer'}` }, 502)
    }
  })

  // The Ads tab: Game Night's box ads. Its own counts and estimate (the games Worker's analytics), with AdSense's
  // figures beside them once AdSense is connected (src/admin/adsense.ts).
  app.get('/api/ads', async c => {
    const days = [7, 30, 90].includes(Number(c.req.query('days'))) ? Number(c.req.query('days')) : 30
    try {
      const r = (await callInternal(c.env, 'GAMES', `/internal/analytics?days=${days}`)) as unknown as { from: string; today: string; ads: unknown; series: { day: string; visitors: number; players: number }[] }
      return c.json({ from: r.from, today: r.today, ads: r.ads, series: r.series.map(s => ({ day: s.day, visitors: s.visitors, players: s.players })), adsense: await adsense(c.env, r.from, r.today) })
    } catch (e) {
      return c.json({ error: `Could not read Game Night: ${e instanceof Error ? e.message : 'no answer'}` }, 502)
    }
  })

  // Just the ads' settings (the console's overview shows whether ads are on).
  app.get('/api/ads/config', async c => {
    try {
      return c.json(await callInternal(c.env, 'GAMES', '/internal/ads'))
    } catch (e) {
      return c.json({ error: `Could not read the ads settings: ${e instanceof Error ? e.message : 'no answer'}` }, 502)
    }
  })

  // The ads' settings: on or off, the AdSense ids, each place on or off, the room split, the estimate's rates.
  app.post('/api/ads/config', async c => {
    const body = await c.req.json().catch(() => null)
    if (!body || typeof body !== 'object') return c.json({ error: 'Could not read that' }, 400)
    try {
      return c.json(await callInternal(c.env, 'GAMES', '/internal/ads', 'POST', body))
    } catch (e) {
      return c.json({ error: `Could not reach Game Night: ${e instanceof Error ? e.message : 'no answer'}` }, 502)
    }
  })

  // Someone asked (through games.amittal.dev/contact) for what is kept under their browser id to be deleted.
  app.post('/api/games/forget', async c => {
    const body = (await c.req.json().catch(() => ({}))) as { vid?: unknown }
    const vid = typeof body.vid === 'string' ? body.vid.trim() : ''
    if (!/^[a-z0-9]{6,40}$/i.test(vid)) return c.json({ error: 'That is not a browser id (6 to 40 letters and digits, from gn.vid)' }, 400)
    try {
      return c.json(await callInternal(c.env, 'GAMES', `/internal/forget?vid=${vid}`, 'POST'))
    } catch (e) {
      return c.json({ error: `Could not reach Game Night: ${e instanceof Error ? e.message : 'no answer'}` }, 502)
    }
  })

  // Chaotic Tails' switches (src/site.ts in the games repo): the notice, pausing new rooms, games taken out.
  app.get('/api/site', async c => {
    try {
      return c.json(await callInternal(c.env, 'GAMES', '/internal/site'))
    } catch (e) {
      return c.json({ error: `Could not read Chaotic Tails: ${e instanceof Error ? e.message : 'no answer'}` }, 502)
    }
  })
  app.post('/api/site', async c => {
    const body = await c.req.json().catch(() => null)
    if (!body || typeof body !== 'object') return c.json({ error: 'Could not read that' }, 400)
    try {
      return c.json(await callInternal(c.env, 'GAMES', '/internal/site', 'POST', body))
    } catch (e) {
      return c.json({ error: `Could not reach Chaotic Tails: ${e instanceof Error ? e.message : 'no answer'}` }, 502)
    }
  })

  // The launch page: the site as Google Search and AdSense see it, checked live (src/admin/chaotic.ts).
  app.get('/api/launch', async c => {
    const mode = await callInternal(c.env, 'GAMES', '/internal/ads').then(r => String((r as unknown as { mode: string }).mode), () => null)
    return c.json(await launchChecks(deps.fetch ?? fetch, mode))
  })

  app.post('/api/actions/:name', async c => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const env = c.env, t = now()
    try {
      switch (c.req.param('name')) {
        case 'check-now': {
          await recordChecks(env, deps)
          const changes = await evaluate(env, deps, t)
          return c.json({ ok: true, message: `Checked every live service${changes.length ? `; ${changes.length} alert change${changes.length > 1 ? 's' : ''}` : ''}.` })
        }
        case 'refresh-resources': {
          const res = await freshResources(env, deps, t)
          await evaluate(env, deps, t, res)
          return c.json({ ok: true, message: `Read ${res.meters.length} meters.` })
        }
        case 'prune-openingos': {
          const { deleted } = await callInternal(env, 'OPENINGOS', '/internal/prune', 'POST')
          return c.json({ ok: true, message: `Deleted ${deleted} snapshot${deleted === 1 ? '' : 's'} untouched for a year.` })
        }
        case 'cleanup-edusched': {
          const { deleted } = await callInternal(env, 'EDUSCHED', '/internal/cleanup', 'POST')
          return c.json({ ok: true, message: `Deleted ${deleted} expired row${deleted === 1 ? '' : 's'}.` })
        }
        case 'set-live': {
          const id = String(body.id ?? '')
          if (!SERVICES.some(s => s.id === id)) return c.json({ error: 'Unknown service' }, 400)
          const live = await liveOf(deps, env)
          if (body.live) live.add(id)
          else live.delete(id)
          await setSetting(deps.sql(env), 'live', [...live].join(','))
          return c.json({ ok: true, message: body.live ? `Now watching ${id}.` : `Stopped watching ${id}; it shows as planned.` })
        }
        case 'redeploy': {
          const id = await redeploy(env, String(body.site ?? ''), deps.fetch)
          return c.json({ ok: true, message: `Build started (${id.slice(0, 12)}…). It takes about a minute.` })
        }
        case 'indexnow': {
          const r = await indexNow(deps.fetch ?? fetch)
          const ok = r.answers.filter(a => a.status === 200 || a.status === 202).length
          if (!ok) return c.json({ error: `No engine took the ${r.urls} pages: ${r.answers.map(a => `${a.engine} ${a.status}`).join(', ')}` }, 502)
          return c.json({ ok: true, message: `Sent ${r.urls} pages; ${ok} of ${r.answers.length} engines took them.` })
        }
        case 'test-alert': {
          const notify = ntfy(env.NTFY_TOPIC, deps.fetch)
          if (!notify) return c.json({ error: 'Set NTFY_TOPIC first.' }, 400)
          await notify('Switchboard test', 'If you can read this, alerts reach your phone.', 'warn')
          return c.json({ ok: true, message: 'Sent. It should arrive in a few seconds.' })
        }
        default:
          return c.json({ error: 'Unknown action' }, 404)
      }
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : 'The action failed' }, 502)
    }
  })

  app.all('/api/*', c => c.json({ error: 'Not found' }, 404))

  // Everything else is the dashboard itself (a single-page app; unknown paths get index.html).
  app.get('*', async c => {
    if (!c.env.ASSETS) return c.text('The dashboard files are not deployed.', 503)
    // dash.chaotictails.com is its own app (admin-ui/dash.html): any page that is not a file gets it.
    const url = new URL(c.req.url)
    if (url.hostname === (c.env.DASH_HOST ?? 'dash.chaotictails.com') && !/\.[a-z0-9]+$/i.test(url.pathname)) {
      const res = await c.env.ASSETS.fetch(new Request(new URL('/dash', url), c.req.raw))
      return new Response(res.body, res)
    }
    const res = await c.env.ASSETS.fetch(c.req.raw)
    return new Response(res.body, res)
  })

  return app
}
