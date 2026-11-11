import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { api, SignedOut, type AdsConfig, type GamesReport, type LiveNow, type Overview, type SiteConfig } from '../api'
import { clock } from '../format'
import { AdsPage } from './AdsPage'
import { ControlsPage } from './ControlsPage'
import { LaunchPage } from './LaunchPage'
import { AudiencePage, FeedbackPage, GamesPage, GrowthPage, HealthPage, OverviewPage } from './pages'

// dash.chaotictails.com: Chaotic Tails' console. The same sign-in and data as the Switchboard (admin.amittal.dev),
// laid out for running one site: what is happening now, who comes and from where, what they play, what they say,
// and every switch the site has (ads, a notice, pausing new rooms, games out, search engines).

export type Route = 'overview' | 'audience' | 'games' | 'growth' | 'feedback' | 'ads' | 'controls' | 'health' | 'launch'
const ROUTES: { id: Route; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'M4 13h6V4H4zm10 7h6v-9h-6zM4 20h6v-4H4zm10-11h6V4h-6z' },
  { id: 'audience', label: 'Audience', icon: 'M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm0 2c-2.7 0-6 1.3-6 3.5V19h12v-2.5C14 14.3 10.7 13 8 13zm8 0c-.3 0-.7 0-1.1.1A4.2 4.2 0 0 1 16 16.5V19h6v-2.5c0-2.2-3.3-3.5-6-3.5z' },
  { id: 'games', label: 'Games', icon: 'M7 6h10a5 5 0 0 1 0 10h-1l-2 2h-4l-2-2H7A5 5 0 0 1 7 6zm0 3v2H5v2h2v2h2v-2h2v-2H9V9zm9 1a1 1 0 1 0 1 1 1 1 0 0 0-1-1zm2 2a1 1 0 1 0 1 1 1 1 0 0 0-1-1z' },
  { id: 'growth', label: 'Growth', icon: 'M3 17l6-6 4 4 7-7v5h2V4h-9v2h5l-5 5-4-4-8 8z' },
  { id: 'feedback', label: 'Feedback', icon: 'M4 4h16v12H7l-3 3zm4 5v2h2V9zm4 0v2h2V9zm4 0v2h2V9z' },
  { id: 'ads', label: 'Ads', icon: 'M3 6h18v12H3zm4 9h2l.5-1.5h2L12 15h2l-2.6-6H9.6zm2.9-3.2.6-1.8.6 1.8zM15 9v6h2.5a3 3 0 0 0 0-6zm2 1.6h.5a1.4 1.4 0 0 1 0 2.8H17z' },
  { id: 'controls', label: 'Controls', icon: 'M6 3v4.2a3 3 0 0 0 0 5.6V21h2v-8.2a3 3 0 0 0 0-5.6V3zm10 0v8.2a3 3 0 0 0 0 5.6V21h2v-4.2a3 3 0 0 0 0-5.6V3zM7 9a1 1 0 1 1-1 1 1 1 0 0 1 1-1zm10 4a1 1 0 1 1-1 1 1 1 0 0 1 1-1z' },
  { id: 'health', label: 'Health', icon: 'M12 21s-7.5-4.6-9.3-9.3C1.5 8.6 3.6 5 7 5c2 0 3.3 1 5 3 1.7-2 3-3 5-3 3.4 0 5.5 3.6 4.3 6.7C19.5 16.4 12 21 12 21zm-5-9h2l1.5-3 3 6 1.5-3h2' },
  { id: 'launch', label: 'Launch', icon: 'M12 2c3 2 5 6 5 10l-2 3H9l-2-3c0-4 2-8 5-10zm0 6a2 2 0 1 0 2 2 2 2 0 0 0-2-2zM9 17h6l-1 4h-4z' },
]
const RANGES = [7, 30, 90] as const
const REFRESH_MS = 60_000
/** The live strip (who is here, today so far, the latest happenings) is asked for this often while the tab is in view. */
const LIVE_MS = 5_000

const routeFromHash = (): Route => {
  const id = location.hash.replace(/^#\/?/, '') as Route
  return ROUTES.some(r => r.id === id) ? id : 'overview'
}

export interface Shared {
  days: number
  games: GamesReport | null
  gamesErr: string | null
  /** Right now and today so far, fresh every few seconds (null until the first answer). */
  now: LiveNow | null
  overview: Overview | null
  site: SiteConfig | null
  ads: AdsConfig | null
  setSite: (c: SiteConfig) => void
  toast: (text: string, tone?: 'ok' | 'err') => void
  signedOut: () => void
  reload: () => void
}

type Toast = { id: number; text: string; tone: 'ok' | 'err' }
let seq = 0

function readTheme(): 'dark' | 'light' | null {
  try { const t = localStorage.getItem('ct-dash-theme'); return t === 'dark' || t === 'light' ? t : null } catch { return null }
}
function readDays(): number {
  try { const d = Number(localStorage.getItem('ct-dash-days')); return RANGES.includes(d as 7) ? d : 30 } catch { return 30 }
}

export function Dash() {
  const [session, setSession] = useState<'loading' | 'out' | 'in'>('loading')
  const [configured, setConfigured] = useState(true)
  const [route, setRoute] = useState<Route>(routeFromHash)
  const [days, setDays] = useState(readDays)
  const [games, setGames] = useState<GamesReport | null>(null)
  const [gamesErr, setGamesErr] = useState<string | null>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [site, setSite] = useState<SiteConfig | null>(null)
  const [ads, setAds] = useState<AdsConfig | null>(null)
  const [at, setAt] = useState<number | null>(null)
  const [now, setNow] = useState<LiveNow | null>(null)
  const [nowAt, setNowAt] = useState<number | null>(null)
  const [nowErr, setNowErr] = useState(false)
  const [, tick] = useState(0)
  const fullAt = useRef(0)
  const [loading, setLoading] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [theme, setTheme] = useState(readTheme)
  const [menu, setMenu] = useState(false)

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = ++seq
    setToasts(t => [...t, { id, text, tone }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 6000)
  }, [])
  const signedOut = useCallback(() => { setSession('out'); setGames(null); setOverview(null); setSite(null) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const fail = (e: unknown) => { if (e instanceof SignedOut) signedOut(); return null }
    const [g, o, s, ad] = await Promise.all([
      api.games(days).catch(e => { if (!(e instanceof SignedOut)) setGamesErr(e.message); return fail(e) }),
      api.overview().catch(fail),
      api.site().catch(fail),
      api.adsSettings().catch(fail),
    ])
    if (g) { setGames(g); setGamesErr(null) }
    if (o) setOverview(o)
    if (s) setSite(s)
    if (ad) setAds(ad)
    setAt(Date.now())
    fullAt.current = Date.now()
    setLoading(false)
  }, [days, signedOut])

  // The live strip: asked for every LIVE_MS while the tab is in view (one request at a time), and at once when the tab
  // comes back into view, when the full report is also read again if it is more than a minute old.
  const pull = useCallback(async () => {
    try { const r = await api.live(); setNow(r); setNowAt(Date.now()); setNowErr(false) } catch (e) { if (e instanceof SignedOut) signedOut(); else setNowErr(true) }
  }, [signedOut])

  useEffect(() => {
    api.session().then(r => { setConfigured(r.configured); setSession(r.authed ? 'in' : 'out') }).catch(() => setSession('out'))
    const onHash = () => { setRoute(routeFromHash()); setMenu(false); window.scrollTo(0, 0) }
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    if (session !== 'in') return
    void load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load() }, REFRESH_MS)
    return () => clearInterval(t)
  }, [session, load])
  useEffect(() => {
    if (session !== 'in') return
    let stop = false, timer = 0
    const loop = async () => {
      if (stop) return
      if (document.visibilityState === 'visible') await pull()
      if (!stop) timer = window.setTimeout(loop, LIVE_MS)
    }
    const back = () => {
      if (document.visibilityState !== 'visible') return
      window.clearTimeout(timer)
      if (Date.now() - fullAt.current > REFRESH_MS) void load()
      void loop()
    }
    void loop()
    document.addEventListener('visibilitychange', back)
    addEventListener('online', back)
    // "Updated 3 s ago" counts up between answers.
    const clockT = window.setInterval(() => { if (document.visibilityState === 'visible') tick(n => n + 1) }, 1000)
    return () => { stop = true; window.clearTimeout(timer); window.clearInterval(clockT); document.removeEventListener('visibilitychange', back); removeEventListener('online', back) }
  }, [session, pull, load])
  useEffect(() => {
    const root = document.documentElement
    if (theme) root.dataset.theme = theme
    else delete root.dataset.theme
  }, [theme])

  const flipTheme = () => {
    const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
    const next = dark ? 'light' : 'dark'
    setTheme(next)
    try { localStorage.setItem('ct-dash-theme', next) } catch { /* private mode */ }
  }
  const pickDays = (d: number) => { setDays(d); try { localStorage.setItem('ct-dash-days', String(d)) } catch { /* private mode */ } }
  const logout = async () => { await api.logout().catch(() => {}); signedOut() }

  if (session === 'loading') return <div class="d-boot" aria-busy="true"><Mark /></div>
  if (session === 'out') return <Login configured={configured} onIn={() => setSession('in')} />

  const shared: Shared = { days, games, gamesErr, now, overview, site, ads, setSite, toast, signedOut, reload: () => { void load(); void pull() } }
  const live = now?.live ?? games?.live
  const fresh = nowAt !== null && !nowErr && Date.now() - nowAt < LIVE_MS * 3
  const since = nowAt ? Math.max(0, Math.round((Date.now() - nowAt) / 1000)) : null
  const here = route === 'ads' || route === 'controls' || route === 'launch' ? null : RANGES
  const current = ROUTES.find(r => r.id === route)!

  return (
    <div class="d-shell">
      <a class="d-skip" href="#d-main">Skip to the numbers</a>
      <aside class={`d-side ${menu ? 'is-open' : ''}`}>
        <a class="d-brand" href="#/overview" aria-label="Chaotic Tails console, overview"><Mark /><span><b>chaotic tails</b><small>console</small></span></a>
        <nav class="d-nav" aria-label="Sections">
          {ROUTES.map(r => (
            <a key={r.id} href={`#/${r.id}`} class={r.id === route ? 'is-on' : ''} aria-current={r.id === route ? 'page' : undefined}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={r.icon} /></svg>{r.label}
              {r.id === 'controls' && site && (site.paused.on || site.gamesOff.length > 0) && <i class="d-nav-dot" title="A switch is on" />}
            </a>
          ))}
        </nav>
        <div class="d-side-foot">
          <a href="https://chaotictails.com" target="_blank" rel="noopener">Open the site ↗</a>
          <a href="https://admin.amittal.dev" target="_blank" rel="noopener">Switchboard ↗</a>
          <button type="button" class="d-link" onClick={logout}>Sign out</button>
        </div>
      </aside>
      {menu && <button type="button" class="d-scrim" aria-label="Close the menu" onClick={() => setMenu(false)} />}
      <div class="d-body">
        <header class="d-top">
          <button type="button" class="d-menu" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" /></svg></button>
          <h1 class="d-title">{current.label}</h1>
          {live && (
            <span class={`d-live ${fresh ? '' : 'is-stale'}`} title={fresh ? 'Live: updates every 5 seconds' : 'Live numbers are not coming through; showing the last ones'}>
              <i class="d-pulse" aria-hidden="true" /><b><Bump v={live.online ?? live.players} /></b> online
              <span class="d-live-more"> · <Bump v={live.playing ?? live.players} /> playing · <Bump v={live.games} /> game{live.games === 1 ? '' : 's'}</span>
            </span>
          )}
          <span class="d-top-gap" />
          {here && (
            <div class="d-seg" role="group" aria-label="Range">
              {here.map(d => <button key={d} type="button" aria-pressed={days === d} class={days === d ? 'is-on' : ''} onClick={() => pickDays(d)}>{d}d</button>)}
            </div>
          )}
          <button type="button" class="d-icon-btn" onClick={() => { void load(); void pull() }} aria-label="Refresh" title={at ? `Updated ${clock(at)}` : 'Refresh'} disabled={loading}>
            <svg class={loading ? 'is-spin' : ''} viewBox="0 0 24 24" aria-hidden="true"><path d="M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.2L13 11h7V4z" /></svg>
          </button>
          <button type="button" class="d-icon-btn" onClick={flipTheme} aria-label="Light or dark">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
          </button>
        </header>
        <main id="d-main" class="d-main" tabIndex={-1}>
          {route === 'overview' && <OverviewPage {...shared} />}
          {route === 'audience' && <AudiencePage {...shared} />}
          {route === 'games' && <GamesPage {...shared} />}
          {route === 'growth' && <GrowthPage {...shared} />}
          {route === 'feedback' && <FeedbackPage {...shared} />}
          {route === 'ads' && <AdsPage {...shared} />}
          {route === 'controls' && <ControlsPage {...shared} />}
          {route === 'health' && <HealthPage {...shared} />}
          {route === 'launch' && <LaunchPage {...shared} />}
        </main>
        <footer class="d-foot">{fresh ? <span class="d-foot-live"><i class="d-pulse" aria-hidden="true" /> Live · updated {since === 0 ? 'just now' : `${since} s ago`}</span> : nowErr ? 'Live numbers are not coming through, trying again' : 'Connecting…'}{at ? ` · charts and totals updated ${clock(at)}, every minute` : ''} · times in IST · test browsers and yours are left out of every count</footer>
      </div>
      <div class="d-toasts" aria-live="polite">{toasts.map(t => <div key={t.id} class={`d-toast is-${t.tone}`} role={t.tone === 'err' ? 'alert' : 'status'}>{t.text}</div>)}</div>
    </div>
  )
}

/** A number that flashes for a moment when it changes, so a live change is seen. */
export function Bump({ v, format = (x: number) => x.toLocaleString('en-IN') }: { v: number; format?: (x: number) => string }) {
  const was = useRef(v)
  const [hot, setHot] = useState(false)
  useEffect(() => {
    if (was.current === v) return
    was.current = v
    setHot(true)
    const t = setTimeout(() => setHot(false), 1200)
    return () => clearTimeout(t)
  }, [v])
  return <span class={hot ? 'd-bump' : undefined}>{format(v)}</span>
}

export function Mark() {
  return (
    <svg class="d-mark" viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="118" fill="#ff5a3c" />
      <g transform="translate(256 256) scale(0.9) translate(-289 -249)">
        <path d="M238 196C214 168 128 172 118 252C108 332 192 360 238 320" fill="none" stroke="#fff4dc" stroke-width="46" stroke-linecap="round" />
        <path d="M310 110V318C310 384 384 396 404 346C420 306 372 290 360 320C346 356 406 386 460 336M262 200H368" fill="none" stroke="#15161a" stroke-width="46" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </svg>
  )
}

function Login({ configured, onIn }: { configured: boolean; onIn: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: Event) => {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError(null)
    try { await api.login(password); onIn() } catch (err) { setError(err instanceof Error ? err.message : 'Could not sign in.'); setBusy(false) }
  }
  return (
    <main class="d-login">
      <form class="d-login-card" onSubmit={submit}>
        <Mark />
        <h1>chaotic tails <span>console</span></h1>
        <p>Everything about the site, and every switch it has.</p>
        {!configured && <p class="d-note is-err" role="alert">The console password has not been set on the Worker yet.</p>}
        <label class="d-field"><span>Password</span>
          <input type="password" autoComplete="current-password" autoFocus value={password} onInput={e => setPassword((e.target as HTMLInputElement).value)} disabled={!configured} />
        </label>
        {error && <p class="d-note is-err" role="alert">{error}</p>}
        <button type="submit" class="d-btn d-btn-wide" disabled={busy || !password || !configured}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p class="d-fine">Five tries a minute. You stay signed in on this device for seven days.</p>
      </form>
    </main>
  )
}
