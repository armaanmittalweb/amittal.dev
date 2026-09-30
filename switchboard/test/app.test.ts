import { describe, expect, it, vi } from 'vitest'
import { createApp, recordChecks, STATUS_TTL_MS, type Bindings, type Deps } from '../src/app'
import { TIMEOUT_MS, type Probe } from '../src/checks'
import { memoryStore } from '../src/store'

const DAY = 86_400_000
const env = (extra: Partial<Bindings> = {}) => ({ DB: {} as D1Database, LIVE: 'archive,edusched', ...extra }) as Bindings

/** A probe that answers each service id with a fixed status (or throws for 'error'). */
function probeOf(map: Record<string, number | 'error'>, calls: string[] = []): Probe {
  return async svc => {
    calls.push(svc.id)
    const v = map[svc.id] ?? 200
    if (v === 'error') throw new Error('unreachable')
    return new Response('ok', { status: v })
  }
}

function setup(map: Record<string, number | 'error'> = {}, clock = { t: 1_800_000_000_000 }) {
  const store = memoryStore(), calls: string[] = []
  const deps: Deps = { store: () => store, probe: () => probeOf(map, calls), now: () => clock.t }
  return { app: createApp(deps), deps, store, calls, clock }
}

describe('GET /status', () => {
  it('checks only live services and reports the rest as planned, never as down', async () => {
    const { app, calls } = setup({ edusched: 503 })
    const res = await app.request('/status', {}, env())
    const body = await res.json() as { services: { id: string; state: string; code: number | null }[] }
    const byId = Object.fromEntries(body.services.map(s => [s.id, s]))
    expect(byId.archive.state).toBe('up')
    expect(byId.edusched).toMatchObject({ state: 'down', code: 503 })
    expect(byId.farmsaathi.state).toBe('planned')
    expect(calls.sort()).toEqual(['archive', 'edusched'])
  })

  it('treats a probe that throws as down', async () => {
    const { app } = setup({ archive: 'error' })
    const body = await (await app.request('/status', {}, env({ LIVE: 'archive' }))).json() as { services: { id: string; state: string }[] }
    expect(body.services.find(s => s.id === 'archive')?.state).toBe('down')
  })

  it('reuses one snapshot for STATUS_TTL_MS, then checks again', async () => {
    const { app, calls, clock } = setup()
    await app.request('/status', {}, env())
    await app.request('/status', {}, env())
    expect(calls.length).toBe(2)
    clock.t += STATUS_TTL_MS + 1
    await app.request('/status', {}, env())
    expect(calls.length).toBe(4)
  })

  it('gives up on a service after TIMEOUT_MS', async () => {
    vi.useFakeTimers()
    const hang: Probe = (_svc, signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))
    const app = createApp({ store: () => memoryStore(), probe: () => hang })
    const pending = app.request('/status', {}, env({ LIVE: 'archive' }))
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 10)
    const body = await (await pending).json() as { services: { id: string; state: string }[] }
    vi.useRealTimers()
    expect(body.services.find(s => s.id === 'archive')?.state).toBe('down')
  })
})

describe('uptime', () => {
  it('records live checks per run and aggregates them by day', async () => {
    const { app, deps, store, clock } = setup({ edusched: 500 })
    await recordChecks(env(), deps)
    clock.t += 5 * 60_000
    await recordChecks(env(), deps)
    expect(store.rows.length).toBe(4) // two live services × two runs, planned ones skipped
    const body = await (await app.request('/uptime', {}, env())).json() as { days: number; services: Record<string, { up: number; total: number }[]> }
    expect(body.days).toBe(30)
    expect(body.services.archive[0]).toMatchObject({ up: 2, total: 2 })
    expect(body.services.edusched[0]).toMatchObject({ up: 0, total: 2 })
  })

  it('prunes rows older than 35 days', async () => {
    const { deps, store, clock } = setup()
    await recordChecks(env(), deps)
    clock.t += 36 * DAY
    await recordChecks(env(), deps)
    expect(new Set(store.rows.map(r => r.at))).toEqual(new Set([clock.t]))
  })
})

describe('/edusched proxy', () => {
  it('forwards to the bound Worker without the prefix', async () => {
    const seen: string[] = []
    const EDUSCHED = { fetch: async (req: Request) => { seen.push(new URL(req.url).pathname + new URL(req.url).search); return new Response('{"status":"ok"}') } } as unknown as Fetcher
    const { app } = setup()
    const res = await app.request('/edusched/api/health?x=1', {}, env({ EDUSCHED }))
    expect(res.status).toBe(200)
    expect(seen).toEqual(['/api/health?x=1'])
  })

  it('answers 503 until the binding exists', async () => {
    const { app } = setup()
    expect((await app.request('/edusched/api/health', {}, env())).status).toBe(503)
  })
})

it('allows the archive origin and nobody else', async () => {
  const { app } = setup()
  const ok = await app.request('/health', { headers: { Origin: 'https://www.amittal.dev' } }, env())
  const no = await app.request('/health', { headers: { Origin: 'https://evil.example' } }, env())
  expect(ok.headers.get('access-control-allow-origin')).toBe('https://www.amittal.dev')
  expect(no.headers.get('access-control-allow-origin')).toBeNull()
})
