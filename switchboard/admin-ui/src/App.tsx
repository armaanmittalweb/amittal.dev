import { useCallback, useEffect, useState } from 'preact/hooks'
import { api, SignedOut, type Overview } from './api'
import { Board } from './Board'
import { Controls } from './Controls'
import { clock } from './format'
import { lineState } from './lines'
import { Login } from './Login'
import { Resources } from './Resources'
import { Traffic } from './Traffic'
import { Lamp } from './ui'

export type Route = 'board' | 'traffic' | 'resources' | 'controls'
const ROUTES: { id: Route; label: string; key: string }[] = [
  { id: 'board', label: 'Board', key: '1' },
  { id: 'traffic', label: 'Traffic', key: '2' },
  { id: 'resources', label: 'Resources', key: '3' },
  { id: 'controls', label: 'Controls', key: '4' },
]
const REFRESH_MS = 60_000

const routeFromHash = (): Route => {
  const id = location.hash.replace(/^#\/?/, '') as Route
  return ROUTES.some(r => r.id === id) ? id : 'board'
}

type Toast = { id: number; text: string; tone: 'ok' | 'err' }
let toastSeq = 0

function readTheme(): 'dark' | 'light' | null {
  try {
    const t = localStorage.getItem('sb-theme')
    return t === 'dark' || t === 'light' ? t : null
  } catch {
    return null
  }
}

export function App() {
  const [session, setSession] = useState<'loading' | 'out' | 'in'>('loading')
  const [configured, setConfigured] = useState(true)
  const [route, setRoute] = useState<Route>(routeFromHash)
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [theme, setTheme] = useState(readTheme)

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = ++toastSeq
    setToasts(t => [...t, { id, text, tone }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 6000)
  }, [])

  const signedOut = useCallback(() => {
    setSession('out')
    setData(null)
  }, [])

  const load = useCallback(async () => {
    try {
      setData(await api.overview())
      setError(null)
    } catch (e) {
      if (e instanceof SignedOut) signedOut()
      else setError(e instanceof Error ? e.message : 'Could not reach the Switchboard.')
    }
  }, [signedOut])

  useEffect(() => {
    api.session().then(s => {
      setConfigured(s.configured)
      setSession(s.authed ? 'in' : 'out')
    }).catch(() => setSession('out'))
    const onHash = () => setRoute(routeFromHash())
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (session !== 'in') return
    void load()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void load() }, REFRESH_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [session, load])

  useEffect(() => {
    const root = document.documentElement
    if (theme) root.dataset.theme = theme
    else delete root.dataset.theme
    try {
      if (theme) localStorage.setItem('sb-theme', theme)
      else localStorage.removeItem('sb-theme')
    } catch { /* private mode: the choice lasts until reload */ }
  }, [theme])

  const go = (r: Route) => { location.hash = '/' + r }

  const run = useCallback(async (name: string, body: Record<string, unknown> = {}, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return false
    setBusy(name)
    try {
      const res = await api.action(name, body)
      toast(res.message)
      await load()
      return true
    } catch (e) {
      if (e instanceof SignedOut) signedOut()
      else toast(e instanceof Error ? e.message : 'That did not work.', 'err')
      return false
    } finally {
      setBusy(null)
    }
  }, [load, signedOut, toast])

  useEffect(() => {
    if (session !== 'in') return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest('input, textarea, select, [contenteditable]')) return
      const r = ROUTES.find(x => x.key === e.key)
      if (r) go(r.id)
      else if (e.key === 'r') void load().then(() => toast('Refreshed.'))
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [session, load, toast])

  if (session === 'loading') return <div class="boot" aria-busy="true"><span class="lamp lamp-idle" /></div>
  if (session === 'out') return <Login configured={configured} onIn={() => setSession('in')} />

  const live = data?.services.filter(s => s.live) ?? []
  const down = live.filter(s => lineState(s) === 'down').length
  const openAlerts = data?.alerts.filter(a => a.resolvedAt === null) ?? []
  const critical = openAlerts.some(a => a.level === 'critical')
  const summary = !data ? 'Connecting…' : down ? `${down} line${down > 1 ? 's' : ''} down` : openAlerts.length ? `${openAlerts.length} alert${openAlerts.length > 1 ? 's' : ''} open` : 'All lines up'
  const summaryLamp = !data ? 'idle' : down || critical ? 'critical' : openAlerts.length ? 'warn' : 'up'

  return (
    <div class="shell">
      <a class="skip" href="#main">Skip to content</a>
      <header class="top">
        <div class="brand">
          <span class="wordmark">Switchboard</span>
          <span class="brand-tag">AMITTAL.DEV · OPERATIONS</span>
        </div>
        <div class="summary" aria-live="polite">
          <Lamp state={summaryLamp} label={summary} />
          <span>{summary}</span>
        </div>
        <div class="top-tools">
          {data && <span class="fine top-time">Updated {clock(data.now)}</span>}
          <button type="button" class="icon-btn" onClick={() => void load().then(() => toast('Refreshed.'))} title="Refresh (R)" aria-label="Refresh">↻</button>
          <button type="button" class="icon-btn" onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'light' : matchMedia('(prefers-color-scheme: light)').matches ? 'dark' : 'light')} title="Switch light or dark" aria-label="Switch light or dark">◐</button>
          <button type="button" class="link-btn" onClick={() => void api.logout().finally(signedOut)}>Sign out</button>
        </div>
        <nav class="tabs" aria-label="Screens">
          {ROUTES.map(r => (
            <a key={r.id} href={`#/${r.id}`} class={route === r.id ? 'is-on' : ''} aria-current={route === r.id ? 'page' : undefined}>
              {r.label}
              {r.id === 'board' && openAlerts.length > 0 && <span class={`badge ${critical ? 'is-hot' : ''}`}>{openAlerts.length}</span>}
              <kbd>{r.key}</kbd>
            </a>
          ))}
        </nav>
      </header>

      <main id="main" class="main" tabIndex={-1}>
        {error && <p class="notice is-err" role="alert">{error} <button type="button" class="link-btn" onClick={() => void load()}>Try again</button></p>}
        {!data && !error && <div class="loading" aria-busy="true">Patching you through…</div>}
        {data && route === 'board' && <Board data={data} go={go} />}
        {data && route === 'traffic' && <Traffic lines={data.services} onSignedOut={signedOut} />}
        {data && route === 'resources' && <Resources data={data.resources} now={data.now} busy={busy === 'refresh-resources'} onRefresh={() => void run('refresh-resources')} />}
        {data && route === 'controls' && <Controls data={data} run={run} busy={busy} onSignedOut={signedOut} />}
      </main>

      <div class="toasts" role="status" aria-live="polite">
        {toasts.map(t => <div key={t.id} class={`toast toast-${t.tone}`}>{t.text}</div>)}
      </div>
    </div>
  )
}
