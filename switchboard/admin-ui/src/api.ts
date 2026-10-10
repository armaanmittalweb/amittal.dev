// The dashboard's view of the Worker's /api. The shapes mirror src/admin/*.ts and src/traffic.ts.

export type Level = 'warn' | 'critical'

export interface Check { at: number; ok: number; ms: number | null; code: number | null }
export interface Day { day: string; up: number; total: number; avgMs: number | null }

export interface Line {
  id: string
  name: string
  hosts: string[]
  origin: string
  live: boolean
  recent: Check[]
  days: Day[]
  today: { views: number; visitors: number }
}

export interface Alert { key: string; level: Level; message: string; openedAt: number; resolvedAt: number | null }

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

export interface Connection { id: 'bindings' | 'cloudflare' | 'neon' | 'vercel' | 'modal' | 'ntfy'; label: string; state: 'connected' | 'missing' | 'error'; detail: string }
export interface Deployment { site: string; project: string; state: string; at: number; commit: string | null; sha: string | null; url: string }

export interface Resources {
  at: number
  meters: Meter[]
  connections: Connection[]
  deployments: Deployment[]
  projects: Record<string, Record<string, number> | { error: string }>
  workers: { script: string; requests: number; errors: number }[]
  modal?: { at: number; cycleStart: string; metered: number; billed: number; apps: Record<string, number> } | null
}

export interface Overview {
  now: number
  services: Line[]
  alerts: Alert[]
  resources: Resources | null
  week: { totals: { views: number; visitors: number }; series: { day: string; views: number; visitors: number }[] }
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

// Game Night (games.amittal.dev): the shape of /internal/analytics there (src/analytics.ts in the games repo).
export type Ratio = number | null
export interface Retention { n: number; back: number; pct: Ratio; within: Ratio }
export interface Text { text: string; n: number; last: number; game: string }
export interface GameRow { id: string; started: number; done: number; completion: Ratio; avgPlayers: number; medianMin: number; replay: Ratio; rating: number | null; ratings: number; again: Ratio }
export interface GamesReport {
  now: number; today: string; since: string; from: string; days: number; tz: string
  names: Record<string, string>
  /** Right now. games/players: games under way and their seats; the rest: people connected to a room (online), the
   * rooms they are in, and how many of them are in a game (playing) or a lobby or results screen (waiting). */
  live: { games: number; players: number; online?: number; rooms?: number; playing?: number; waiting?: number }
  acquisition: {
    dau: number; wau: number; mau: number; dauPlayers: number; wauPlayers: number; mauPlayers: number; avgDau: number; avgDauPlayers: number
    visitors: number; newVisitors: number; sessions: number; viewsPerSession: number | null
    sources: (Count & { played: number })[]; referrers: Count[]; landings: Count[]; countries: Count[]; devices: Count[]
  }
  funnel: { newVisitors: number; played: number; twoRooms: number; returned: number }
  activation: { created: number; started: number; rate: Ratio; avgPlayers: number | null; medianPlayers: number; avgSeats: number | null; sizes: Count[] }
  engagement: {
    games: number; done: number; gamesPerRoom: number | null; medianGamesPerNight: number; medianNightMin: number; avgNightMin: number | null
    completed: Ratio; second: Ratio; third: Ratio; nightPlanner: Ratio; medianGameMin: number; playerHours: number
    rulesSkipped: Ratio; medianRulesSec: number; peakPlayers: number; peakAt: number | null; hours: number[]; byGame: GameRow[]; multiRoom: Ratio
  }
  retention: { d1: Retention; d7: Retention; d14: Retention; d30: Retention; cohort: number }
  virality: {
    shares: number; sharesNative: number; inviteOpens: number; newFromInvites: number; newFromInvitesPlayed: number; shareOfNew: Ratio
    playersPerRoom: number | null; roomsByReferred: number; roomsStarted: number; perHost: number | null
  }
  quality: {
    completion: Ratio; aborted: Ratio; unfinished: Ratio; dropRate: Ratio; dropped: number; seats: number; reconnect: Ratio; rejoined: number
    errorSessions: Ratio; errorGames: Ratio; actions: number; serverErrors: number; topErrors: Count[]
  }
  feedback: { responses: number; ratings: number; avgRating: number | null; stars: number[]; againVotes: number; again: Ratio; complaints: Text[]; ideas: Text[]; reports?: Text[] }
  series: { day: string; visitors: number; players: number; newVisitors: number; rooms: number; games: number }[]
}

/** The session ended (or never started): the app shows the sign-in screen. */
export class SignedOut extends Error {}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, credentials: 'same-origin', headers: { 'content-type': 'application/json', ...init.headers } })
  if (res.status === 401 && path !== '/api/login') throw new SignedOut()
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(body.error ?? `The server answered ${res.status}`)
  return body as T
}

const post = <T>(path: string, body: unknown = {}) => call<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const api = {
  session: () => call<{ authed: boolean; configured: boolean }>('/api/session'),
  login: (password: string) => post<{ ok: true }>('/api/login', { password }),
  logout: () => post<{ ok: true }>('/api/logout'),
  overview: () => call<Overview>('/api/overview'),
  traffic: (site: string | null, days: number) => call<Traffic>(`/api/traffic?days=${days}${site ? `&site=${site}` : ''}`),
  resources: (fresh = false) => call<Resources | null>('/api/resources' + (fresh ? '?fresh=1' : '')),
  games: (days: number) => call<GamesReport>(`/api/games?days=${days}`),
  alerts: () => call<Alert[]>('/api/alerts'),
  action: (name: string, body: Record<string, unknown> = {}) => post<{ ok: true; message: string }>(`/api/actions/${name}`, body),
}
