import type { Service } from './services'

export type State = 'up' | 'down' | 'planned'

export interface Result {
  id: string
  name: string
  hosts: string[]
  state: State
  /** Round trip in ms, when checked. */
  ms: number | null
  /** HTTP status, when one came back. */
  code: number | null
}

/** Fetches one service's health endpoint; the caller decides how (public URL or service binding). */
export type Probe = (svc: Service, signal: AbortSignal) => Promise<Response>

export const TIMEOUT_MS = 4000

/** Checks every live service in parallel. A check that fails, errors or outlasts TIMEOUT_MS is down. */
export async function checkAll(services: Service[], live: Set<string>, probe: Probe, now = () => performance.now()): Promise<Result[]> {
  return Promise.all(services.map(async (svc): Promise<Result> => {
    const base = { id: svc.id, name: svc.name, hosts: svc.hosts }
    if (!live.has(svc.id)) return { ...base, state: 'planned', ms: null, code: null }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const t0 = now()
    try {
      const res = await probe(svc, ctrl.signal)
      await res.body?.cancel()
      return { ...base, state: res.ok ? 'up' : 'down', ms: Math.round(now() - t0), code: res.status }
    } catch {
      return { ...base, state: 'down', ms: null, code: null }
    } finally {
      clearTimeout(timer)
    }
  }))
}
