/**
 * Free-tier usage for the admin dashboard. Each source is optional and fails on its own:
 *   - the project Workers' /internal/stats, over service bindings (database sizes, row counts);
 *   - this Worker's own D1 size;
 *   - Cloudflare's GraphQL analytics (Worker requests, D1 rows), with CF_API_TOKEN;
 *   - Neon's API (compute hours), with NEON_API_KEY;
 *   - Vercel's API (latest production deploys, redeploys), with VERCEL_TOKEN.
 *
 * Collecting wakes both Neon databases, so the cron does it every 6 hours, not every 5 minutes.
 */
import type { Bindings } from '../app'
import type { Sql } from '../sql'

/** Free-plan limits as of September 2026. Check the providers' pricing pages if a meter looks wrong. */
export const FREE = {
  workersRequestsDay: 100_000, // whole account, resets 00:00 UTC
  d1RowsReadDay: 5_000_000,
  d1RowsWrittenDay: 100_000,
  d1DatabaseBytes: 500 * 1024 ** 2,
  neonStorageBytes: 512 * 1024 ** 2, // per project
  neonComputeHoursMonth: 100, // CU-hours per project
}

export const REFRESH_MS = 6 * 3_600_000

/** Vercel projects behind each site, for deploy status and redeploys. */
export const VERCEL_PROJECTS: { site: string; project: string; repo: string }[] = [
  { site: 'archive', project: 'amittal-dev', repo: 'amittal.dev' },
  { site: 'edusched', project: 'edusched', repo: 'TimeTable-Management-for-College' },
  { site: 'safespace', project: 'safespace', repo: 'SafeSpace' },
  { site: 'openingos', project: 'openingos', repo: 'OpeningOS' },
  { site: 'farmsaathi', project: 'farmsaathi', repo: 'FarmSathi' },
  { site: 'loomcore', project: 'loomcore', repo: 'Loomcore' },
]
export const GITHUB_OWNER = 'armaanmittalweb'

export interface Meter {
  id: string
  group: string
  label: string
  used: number
  limit: number
  unit: 'bytes' | 'count' | 'hours'
  period: 'now' | 'today' | 'month'
  detail?: string
}

export interface Connection {
  id: 'bindings' | 'cloudflare' | 'neon' | 'vercel' | 'ntfy'
  label: string
  state: 'connected' | 'missing' | 'error'
  detail: string
}

export interface Deployment {
  site: string
  project: string
  state: string
  at: number
  commit: string | null
  sha: string | null
  url: string
}

export interface Resources {
  at: number
  meters: Meter[]
  connections: Connection[]
  deployments: Deployment[]
  /** Raw numbers from each project's /internal/stats, or the error that stopped them. */
  projects: Record<string, Record<string, number> | { error: string }>
  workers: { script: string; requests: number; errors: number }[]
}

type Fetch = typeof fetch

/** Calls a project Worker's private route through its service binding. */
export async function callInternal(env: Bindings, name: 'EDUSCHED' | 'OPENINGOS' | 'SAFESPACE' | 'FARMSAATHI', path: string, method = 'GET'): Promise<Record<string, number>> {
  const target = env[name]
  if (!target) throw new Error(`the ${name} service binding is not configured`)
  if (!env.INTERNAL_KEY) throw new Error('INTERNAL_KEY is not set')
  const res = await target.fetch(`https://${name.toLowerCase()}.internal${path}`, { method, headers: { 'x-internal-key': env.INTERNAL_KEY } })
  if (!res.ok) throw new Error(`${name.toLowerCase()} answered ${res.status}`)
  return res.json()
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function collectResources(env: Bindings, sql: Sql, now: number, f: Fetch = fetch): Promise<Resources> {
  const out: Resources = { at: now, meters: [], connections: [], deployments: [], projects: {}, workers: [] }
  const meter = (m: Meter) => out.meters.push(m)

  await Promise.all([
    // Project Workers, over service bindings.
    (async () => {
      const [edu, os, ss, fs] = await Promise.allSettled([
        callInternal(env, 'EDUSCHED', '/internal/stats'),
        callInternal(env, 'OPENINGOS', '/internal/stats'),
        callInternal(env, 'SAFESPACE', '/internal/stats'),
        callInternal(env, 'FARMSAATHI', '/internal/stats'),
      ])
      const errors: string[] = []
      if (edu.status === 'fulfilled') {
        out.projects.edusched = edu.value
        meter({ id: 'neon-edusched', group: 'Neon', label: 'EduSched database', used: edu.value.dbBytes, limit: FREE.neonStorageBytes, unit: 'bytes', period: 'now',
          detail: `${edu.value.workspaces} departments · ${edu.value.changes} class changes · ${edu.value.demoCopies} demo copies open` })
      } else errors.push('EduSched: ' + message(edu.reason))
      if (os.status === 'fulfilled') {
        out.projects.openingos = os.value
        meter({ id: 'neon-openingos', group: 'Neon', label: 'OpeningOS database', used: os.value.dbBytes, limit: FREE.neonStorageBytes, unit: 'bytes', period: 'now',
          detail: `${os.value.snapshots} synced phrases · ${os.value.written24h} written today` })
        meter({ id: 'sync-cap', group: 'OpeningOS sync', label: 'Snapshot table against its cap', used: os.value.tableBytes, limit: os.value.maxTableBytes, unit: 'bytes', period: 'now',
          detail: 'New phrases pause at the cap; existing ones keep working' })
      } else errors.push('OpeningOS: ' + message(os.reason))
      if (ss.status === 'fulfilled') {
        out.projects.safespace = ss.value
        meter({ id: 'd1-safespace', group: 'Cloudflare', label: 'SafeSpace D1 storage', used: ss.value.dbBytes, limit: FREE.d1DatabaseBytes, unit: 'bytes', period: 'now',
          detail: `${ss.value.users} accounts · ${ss.value.records} encrypted records` })
      } else errors.push('SafeSpace: ' + message(ss.reason))
      if (fs.status === 'fulfilled') {
        out.projects.farmsaathi = fs.value
        meter({ id: 'd1-farmsaathi', group: 'Cloudflare', label: 'FarmSaathi D1 storage', used: fs.value.dbBytes, limit: FREE.d1DatabaseBytes, unit: 'bytes', period: 'now',
          detail: `${fs.value.users} farmers signed in · ${fs.value.chats} saved chats` })
      } else errors.push('FarmSaathi: ' + message(fs.reason))
      if (ss.status === 'rejected') out.projects.safespace = { error: message(ss.reason) }
      if (fs.status === 'rejected') out.projects.farmsaathi = { error: message(fs.reason) }
      if (edu.status === 'rejected') out.projects.edusched = { error: message(edu.reason) }
      if (os.status === 'rejected') out.projects.openingos = { error: message(os.reason) }
      out.connections.push({ id: 'bindings', label: 'Project Workers', state: errors.length ? 'error' : 'connected',
        detail: errors.length ? errors.join('; ') : 'EduSched, OpeningOS, SafeSpace and FarmSaathi report through service bindings' })
    })(),

    // This Worker's own D1 database.
    (async () => {
      const size = await sql.size().catch(() => null)
      if (size !== null) meter({ id: 'd1-switchboard', group: 'Cloudflare', label: 'Switchboard D1 storage', used: size, limit: FREE.d1DatabaseBytes, unit: 'bytes', period: 'now', detail: 'Uptime log and traffic counts' })
    })(),

    // Cloudflare analytics: requests per Worker today, D1 rows today.
    (async () => {
      if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
        out.connections.push({ id: 'cloudflare', label: 'Cloudflare analytics', state: 'missing', detail: 'Add CF_API_TOKEN for Worker requests and D1 rows against the daily limits' })
        return
      }
      try {
        const day = new Date(now).toISOString().slice(0, 10)
        const res = await f('https://api.cloudflare.com/client/v4/graphql', {
          method: 'POST',
          headers: { authorization: `Bearer ${env.CF_API_TOKEN}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            query: `query ($acct: String!, $since: Time!, $day: Date!) { viewer { accounts(filter: { accountTag: $acct }) {
              workers: workersInvocationsAdaptive(limit: 50, filter: { datetime_geq: $since }) { sum { requests errors } dimensions { scriptName } }
              d1: d1AnalyticsAdaptiveGroups(limit: 50, filter: { date_geq: $day }) { sum { rowsRead rowsWritten } }
            } } }`,
            variables: { acct: env.CF_ACCOUNT_ID, since: day + 'T00:00:00Z', day },
          }),
        })
        const body = (await res.json()) as {
          data?: { viewer: { accounts: { workers: { sum: { requests: number; errors: number }; dimensions: { scriptName: string } }[]; d1: { sum: { rowsRead: number; rowsWritten: number } }[] }[] } }
          errors?: { message: string }[] | null
        }
        if (!res.ok || body.errors?.length || !body.data) throw new Error(body.errors?.[0]?.message ?? `Cloudflare answered ${res.status}`)
        const acct = body.data.viewer.accounts[0]
        const byScript = new Map<string, { requests: number; errors: number }>()
        for (const w of acct?.workers ?? []) {
          // Cloudflare reports some requests without a script ("__unknown__"); they still count toward the daily limit.
          const name = w.dimensions.scriptName === '__unknown__' ? 'unattributed' : w.dimensions.scriptName
          const cur = byScript.get(name) ?? { requests: 0, errors: 0 }
          byScript.set(name, { requests: cur.requests + w.sum.requests, errors: cur.errors + w.sum.errors })
        }
        out.workers = [...byScript].map(([script, v]) => ({ script, ...v })).sort((a, b) => b.requests - a.requests)
        const requests = out.workers.reduce((a, w) => a + w.requests, 0)
        const rows = (acct?.d1 ?? []).reduce((a, d) => ({ read: a.read + d.sum.rowsRead, written: a.written + d.sum.rowsWritten }), { read: 0, written: 0 })
        meter({ id: 'workers-requests', group: 'Cloudflare', label: 'Worker requests today', used: requests, limit: FREE.workersRequestsDay, unit: 'count', period: 'today',
          detail: out.workers.map(w => `${w.script} ${w.requests.toLocaleString('en')}`).join(' · ') || 'No requests yet today' })
        meter({ id: 'd1-rows-read', group: 'Cloudflare', label: 'D1 rows read today', used: rows.read, limit: FREE.d1RowsReadDay, unit: 'count', period: 'today' })
        meter({ id: 'd1-rows-written', group: 'Cloudflare', label: 'D1 rows written today', used: rows.written, limit: FREE.d1RowsWrittenDay, unit: 'count', period: 'today', detail: 'Mostly page-view counts: about 5 rows per view' })
        out.connections.push({ id: 'cloudflare', label: 'Cloudflare analytics', state: 'connected', detail: `${out.workers.length} Workers reporting` })
      } catch (e) {
        out.connections.push({ id: 'cloudflare', label: 'Cloudflare analytics', state: 'error', detail: message(e) })
      }
    })(),

    // Neon: compute hours this month, per project.
    (async () => {
      const projects = (env.NEON_PROJECTS ?? '').split(',').map(p => p.trim().split(':')).filter(p => p.length === 2) as [string, string][]
      if (!env.NEON_API_KEY) {
        out.connections.push({ id: 'neon', label: 'Neon', state: 'missing', detail: 'Add NEON_API_KEY for compute hours this month (storage works without it)' })
        return
      }
      try {
        for (const [site, id] of projects) {
          const res = await f(`https://console.neon.tech/api/v2/projects/${id}`, { headers: { authorization: `Bearer ${env.NEON_API_KEY}`, accept: 'application/json' } })
          if (!res.ok) throw new Error(`Neon answered ${res.status} for ${site}`)
          const { project } = (await res.json()) as { project: { compute_time_seconds?: number; active_time_seconds?: number } }
          meter({ id: 'neon-compute-' + site, group: 'Neon', label: `${site === 'edusched' ? 'EduSched' : 'OpeningOS'} compute this month`, used: (project.compute_time_seconds ?? 0) / 3600,
            limit: FREE.neonComputeHoursMonth, unit: 'hours', period: 'month', detail: `Awake ${Math.round((project.active_time_seconds ?? 0) / 3600)} h; it sleeps after 5 idle minutes` })
        }
        out.connections.push({ id: 'neon', label: 'Neon', state: 'connected', detail: `${projects.length} projects` })
      } catch (e) {
        out.connections.push({ id: 'neon', label: 'Neon', state: 'error', detail: message(e) })
      }
    })(),

    // Vercel: the latest production deploy of each site.
    (async () => {
      if (!env.VERCEL_TOKEN) {
        out.connections.push({ id: 'vercel', label: 'Vercel', state: 'missing', detail: 'Add VERCEL_TOKEN for deploy status and one-click redeploys' })
        return
      }
      try {
        const team = env.VERCEL_TEAM_ID ? `&teamId=${env.VERCEL_TEAM_ID}` : ''
        out.deployments = await Promise.all(VERCEL_PROJECTS.map(async p => {
          const res = await f(`https://api.vercel.com/v6/deployments?projectId=${p.project}&target=production&limit=1${team}`, { headers: { authorization: `Bearer ${env.VERCEL_TOKEN}` } })
          if (!res.ok) throw new Error(`Vercel answered ${res.status} for ${p.project}`)
          const d = ((await res.json()) as { deployments: { state?: string; readyState?: string; created: number; url: string; meta?: Record<string, string> }[] }).deployments[0]
          return { site: p.site, project: p.project, state: d?.state ?? d?.readyState ?? 'NONE', at: d?.created ?? 0,
            commit: d?.meta?.githubCommitMessage?.split('\n')[0] ?? null, sha: d?.meta?.githubCommitSha?.slice(0, 7) ?? null, url: d ? 'https://' + d.url : '' }
        }))
        out.connections.push({ id: 'vercel', label: 'Vercel', state: 'connected', detail: `${out.deployments.length} projects` })
      } catch (e) {
        out.connections.push({ id: 'vercel', label: 'Vercel', state: 'error', detail: message(e) })
      }
    })(),
  ])

  out.connections.push(env.NTFY_TOPIC
    ? { id: 'ntfy', label: 'Phone alerts (ntfy)', state: 'connected', detail: 'Alerts are pushed to your ntfy topic' }
    : { id: 'ntfy', label: 'Phone alerts (ntfy)', state: 'missing', detail: 'Add NTFY_TOPIC to get alerts on your phone' })
  const order = ['bindings', 'cloudflare', 'neon', 'vercel', 'ntfy']
  out.connections.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
  return out
}

/** Starts a production build of a site from its GitHub main branch. */
export async function redeploy(env: Bindings, site: string, f: Fetch = fetch): Promise<string> {
  const p = VERCEL_PROJECTS.find(v => v.site === site)
  if (!p) throw new Error('unknown site ' + site)
  if (!env.VERCEL_TOKEN) throw new Error('VERCEL_TOKEN is not set')
  const team = env.VERCEL_TEAM_ID ? `?teamId=${env.VERCEL_TEAM_ID}` : ''
  const res = await f(`https://api.vercel.com/v13/deployments${team}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.VERCEL_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name: p.project, project: p.project, target: 'production', gitSource: { type: 'github', org: GITHUB_OWNER, repo: p.repo, ref: 'main' } }),
  })
  const body = (await res.json()) as { id?: string; error?: { message: string } }
  if (!res.ok || !body.id) throw new Error(body.error?.message ?? `Vercel answered ${res.status}`)
  return body.id
}
