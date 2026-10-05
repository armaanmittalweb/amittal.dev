/**
 * Free-tier usage for the admin dashboard. Each source is optional and fails on its own:
 *   - the project Workers' /internal/stats, over service bindings (database sizes, row counts);
 *   - this Worker's own D1 size;
 *   - Cloudflare's GraphQL analytics (Worker requests, D1 rows, Workers AI neurons), with CF_API_TOKEN;
 *   - Neon's API (compute hours), with NEON_API_KEY;
 *   - Vercel's API (latest production deploys, redeploys), with VERCEL_TOKEN;
 *   - Modal's spend this month, pushed to /internal/modal by modal/meter.py (Modal has no HTTP API
 *     for billing, and asking a runtime for its health would wake it and spend credits).
 *
 * Collecting wakes both Neon databases, so the cron does it every 6 hours, not every 5 minutes.
 */
import type { Bindings } from '../app'
import { getSetting, type Sql } from '../sql'

/** Free-plan limits as of September 2026. Check the providers' pricing pages if a meter looks wrong. */
export const FREE = {
  workersRequestsDay: 100_000, // whole account, resets 00:00 UTC
  d1RowsReadDay: 5_000_000,
  d1RowsWrittenDay: 100_000,
  d1DatabaseBytes: 500 * 1024 ** 2,
  neonStorageBytes: 512 * 1024 ** 2, // per project
  neonComputeHoursMonth: 100, // CU-hours per project
  workersAiNeuronsDay: 10_000, // whole account, resets 00:00 UTC
  modalCreditsMonth: 30, // Starter plan, US dollars; no card on file, so usage stops there
  durableObjectRequestsDay: 100_000, // whole account, resets 00:00 UTC; WebSocket messages count 20 to 1
  durableObjectBytes: 5 * 1024 ** 3, // SQLite-backed Durable Objects, whole account
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
  unit: 'bytes' | 'count' | 'hours' | 'usd'
  period: 'now' | 'today' | 'month'
  detail?: string
}

export interface Connection {
  id: 'bindings' | 'cloudflare' | 'neon' | 'vercel' | 'modal' | 'ntfy'
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
  projects: Record<string, Record<string, unknown> | { error: string }>
  workers: { script: string; requests: number; errors: number }[]
  /** The latest Modal report, if the meter has sent one. */
  modal: ModalReport | null
}

/** What modal/meter.py sends: this billing cycle's spend in US dollars, in total and per app. */
export interface ModalReport {
  at: number
  cycleStart: string
  metered: number
  billed: number
  apps: Record<string, number>
}

const money = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e6

/** Checks a report before it is kept; null when anything is off. `at` is when it arrived. */
export function readModalReport(body: unknown, at: number): ModalReport | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (!money(b.metered) || !money(b.billed) || typeof b.cycleStart !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(b.cycleStart)) return null
  if (!b.apps || typeof b.apps !== 'object') return null
  const apps = Object.entries(b.apps as Record<string, unknown>)
  if (apps.length > 50 || apps.some(([name, cost]) => !/^[\w.-]{1,64}$/.test(name) || !money(cost))) return null
  return { at, cycleStart: b.cycleStart.slice(0, 10), metered: b.metered as number, billed: b.billed as number, apps: Object.fromEntries(apps) as Record<string, number> }
}

/** Short names for the providers FarmSaathi reports, as the dashboard labels them. */
const FARMSAATHI_PROVIDERS: Record<string, string> = {
  'workers-ai': 'Answers from Workers AI (Llama 3.3 70B)',
  groq: 'Answers from Groq',
  gemini: 'Answers from Gemini',
  openrouter: 'Answers from OpenRouter',
  'indic-stt': 'Hindi and Punjabi heard by IndicConformer',
  'workers-ai-stt': 'Recordings heard by Whisper on Workers AI',
  'groq-stt': 'Recordings heard by Whisper on Groq',
}

/** What the Game Night Worker (games.amittal.dev) reports at /internal/stats. */
interface GamesStats {
  dbBytes: number
  roomsTotal: number
  gamesTotal: number
  rooms24h: number
  liveRooms: number
  players24h: number
  players30d: number
  today: { rooms: number; games: number; finished: number; guesses: number; solved: number; newPlayers: number }
  modes: Record<string, number>
}

interface FarmSaathiStats {
  users: number
  chats: number
  dbBytes: number
  today?: { chat: number; transcribe: number; speak: number }
  byProvider?: Record<string, number>
  caps?: Record<string, number>
}

type Fetch = typeof fetch

/** Calls a project Worker's private route through its service binding. */
export async function callInternal(env: Bindings, name: 'EDUSCHED' | 'OPENINGOS' | 'SAFESPACE' | 'FARMSAATHI' | 'GAMES', path: string, method = 'GET'): Promise<Record<string, number>> {
  const target = env[name]
  if (!target) throw new Error(`the ${name} service binding is not configured`)
  if (!env.INTERNAL_KEY) throw new Error('INTERNAL_KEY is not set')
  const res = await target.fetch(`https://${name.toLowerCase()}.internal${path}`, { method, headers: { 'x-internal-key': env.INTERNAL_KEY } })
  if (!res.ok) throw new Error(`${name.toLowerCase()} answered ${res.status}`)
  return res.json()
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function collectResources(env: Bindings, sql: Sql, now: number, f: Fetch = fetch): Promise<Resources> {
  const out: Resources = { at: now, meters: [], connections: [], deployments: [], projects: {}, workers: [], modal: null }
  const meter = (m: Meter) => out.meters.push(m)

  await Promise.all([
    // Project Workers, over service bindings.
    (async () => {
      const [edu, os, ss, fs, gm] = await Promise.allSettled([
        callInternal(env, 'EDUSCHED', '/internal/stats'),
        callInternal(env, 'OPENINGOS', '/internal/stats'),
        callInternal(env, 'SAFESPACE', '/internal/stats'),
        callInternal(env, 'FARMSAATHI', '/internal/stats'),
        callInternal(env, 'GAMES', '/internal/stats'),
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
        const f = fs.value as unknown as FarmSaathiStats
        out.projects.farmsaathi = fs.value
        meter({ id: 'd1-farmsaathi', group: 'Cloudflare', label: 'FarmSaathi D1 storage', used: f.dbBytes, limit: FREE.d1DatabaseBytes, unit: 'bytes', period: 'now',
          detail: `${f.users} farmers signed in · ${f.chats} saved chats` })
        // Each provider against the daily cap the FarmSaathi Worker stops at (India day, from 00:00 IST).
        for (const [p, cap] of Object.entries(f.caps ?? {})) {
          if (!cap) continue
          meter({ id: 'farmsaathi-' + p, group: 'FarmSaathi', label: FARMSAATHI_PROVIDERS[p] ?? p, used: f.byProvider?.[p] ?? 0, limit: cap, unit: 'count', period: 'today',
            detail: 'Daily cap set in the FarmSaathi Worker; past it the next provider answers' })
        }
      } else errors.push('FarmSaathi: ' + message(fs.reason))
      if (gm.status === 'fulfilled') {
        const g = gm.value as unknown as GamesStats
        out.projects.games = gm.value
        meter({ id: 'do-games', group: 'Game Night', label: 'Game Night stored counts', used: g.dbBytes, limit: FREE.durableObjectBytes, unit: 'bytes', period: 'now',
          detail: `${g.gamesTotal} games in ${g.roomsTotal} rooms so far · rooms delete themselves a day after their last game` })
      } else errors.push('Game Night: ' + message(gm.reason))
      if (gm.status === 'rejected') out.projects.games = { error: message(gm.reason) }
      if (ss.status === 'rejected') out.projects.safespace = { error: message(ss.reason) }
      if (fs.status === 'rejected') out.projects.farmsaathi = { error: message(fs.reason) }
      if (edu.status === 'rejected') out.projects.edusched = { error: message(edu.reason) }
      if (os.status === 'rejected') out.projects.openingos = { error: message(os.reason) }
      out.connections.push({ id: 'bindings', label: 'Project Workers', state: errors.length ? 'error' : 'connected',
        detail: errors.length ? errors.join('; ') : 'EduSched, OpeningOS, SafeSpace, FarmSaathi and Game Night report through service bindings' })
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
        return
      }
      // Workers AI, asked separately so a token without this dataset still gets the meters above.
      try {
        const day = new Date(now).toISOString().slice(0, 10)
        const res = await f('https://api.cloudflare.com/client/v4/graphql', {
          method: 'POST',
          headers: { authorization: `Bearer ${env.CF_API_TOKEN}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            query: `query ($acct: String!, $day: Date!) { viewer { accounts(filter: { accountTag: $acct }) {
              ai: aiInferenceAdaptiveGroups(limit: 50, filter: { date_geq: $day }) { sum { totalNeurons } dimensions { modelId } }
            } } }`,
            variables: { acct: env.CF_ACCOUNT_ID, day },
          }),
        })
        const body = (await res.json()) as { data?: { viewer: { accounts: { ai?: { sum: { totalNeurons: number }; dimensions: { modelId: string } }[] }[] } } }
        const rows = body.data?.viewer.accounts[0]?.ai
        // A throw, not a return: the Durable Object query below still has to run.
        if (!res.ok || !rows) throw new Error('no Workers AI data')
        const byModel = new Map<string, number>()
        for (const r of rows) {
          const name = r.dimensions.modelId.split('/').pop() ?? r.dimensions.modelId
          byModel.set(name, (byModel.get(name) ?? 0) + r.sum.totalNeurons)
        }
        const used = [...byModel.values()].reduce((a, n) => a + n, 0)
        meter({ id: 'workers-ai-neurons', group: 'Cloudflare', label: 'Workers AI neurons today', used, limit: FREE.workersAiNeuronsDay, unit: 'count', period: 'today',
          detail: [...byModel].sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ${Math.round(n).toLocaleString('en')}`).join(' · ') || 'No inference yet today' })
      } catch {
        // No meter: the Worker-request meters above still stand.
      }
      // Durable Objects (Game Night's rooms), also asked separately.
      try {
        const day = new Date(now).toISOString().slice(0, 10)
        const res = await f('https://api.cloudflare.com/client/v4/graphql', {
          method: 'POST',
          headers: { authorization: `Bearer ${env.CF_API_TOKEN}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            query: `query ($acct: String!, $day: Date!) { viewer { accounts(filter: { accountTag: $acct }) {
              objects: durableObjectsInvocationsAdaptiveGroups(limit: 50, filter: { date_geq: $day }) { sum { requests } dimensions { scriptName } }
            } } }`,
            variables: { acct: env.CF_ACCOUNT_ID, day },
          }),
        })
        const body = (await res.json()) as { data?: { viewer: { accounts: { objects?: { sum: { requests: number }; dimensions: { scriptName: string } }[] }[] } } }
        const rows = body.data?.viewer.accounts[0]?.objects
        if (!res.ok || !rows) return
        const used = rows.reduce((a, r) => a + r.sum.requests, 0)
        meter({ id: 'durable-object-requests', group: 'Cloudflare', label: 'Durable Object requests today', used, limit: FREE.durableObjectRequestsDay, unit: 'count', period: 'today',
          detail: rows.map(r => `${r.dimensions.scriptName} ${r.sum.requests.toLocaleString('en')}`).join(' · ') || 'No requests yet today' })
      } catch {
        // No meter.
      }
    })(),

    // Modal: the spend modal/meter.py last reported. Never asks Modal itself (see the top of the file).
    (async () => {
      const raw = await getSetting(sql, 'modal').catch(() => null)
      let report: ModalReport | null = null
      try { report = raw ? (JSON.parse(raw) as ModalReport) : null } catch { report = null }
      if (!report) {
        out.connections.push({ id: 'modal', label: 'Modal', state: 'missing', detail: 'Deploy modal/meter.py to report Modal spend every 6 hours' })
        return
      }
      out.modal = report
      const apps = Object.entries(report.apps).sort((a, b) => b[1] - a[1])
      meter({ id: 'modal-credits', group: 'Modal', label: 'Modal credits this month', used: report.metered, limit: FREE.modalCreditsMonth, unit: 'usd', period: 'month',
        detail: (apps.map(([name, cost]) => `${name} $${cost.toFixed(2)}`).join(' · ') || 'Nothing has run this month') + (report.billed > 0 ? ` · billed $${report.billed.toFixed(2)}` : '') })
      const hours = (now - report.at) / 3_600_000
      out.connections.push(hours > 13
        ? { id: 'modal', label: 'Modal', state: 'error', detail: `The last report is ${Math.round(hours)} hours old; check the switchboard-meter app on Modal` }
        : { id: 'modal', label: 'Modal', state: 'connected', detail: `Spend reported ${hours < 1 ? 'within the hour' : Math.round(hours) + ' h ago'} by the switchboard-meter app` })
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
  const order = ['bindings', 'cloudflare', 'neon', 'vercel', 'modal', 'ntfy']
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
