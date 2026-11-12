import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { api, SignedOut, type LogKind, type LogLevel, type LogLine, type LogPage } from '../api'
import { num } from '../format'
import type { Shared } from './Dash'
import { GAME_NAMES, gameName, hms, KIND_LABEL, LEVEL_LABEL, LogRow, when } from './Panels'

// Logs: everything the site logs (src/logs.ts in the games repo), newest first, following along live. Filters live in
// the address (#/logs?q=…), so a view can be kept as a bookmark or sent. Kept 7 days.

const KINDS: LogKind[] = ['room', 'join', 'game', 'mod', 'visit', 'feedback', 'error', 'share', 'daily', 'admin', 'line']
const LEVELS: LogLevel[] = ['info', 'good', 'warn', 'error']
/** Off unless picked: connections dropping and coming back are many and rarely worth reading. */
const QUIET: LogKind[] = ['line']
const RANGES = [{ id: '15m', ms: 15 * 60_000 }, { id: '1h', ms: 3_600_000 }, { id: '6h', ms: 6 * 3_600_000 }, { id: '24h', ms: 86_400_000 }, { id: '7d', ms: 7 * 86_400_000 }] as const
type RangeId = (typeof RANGES)[number]['id']
const TAIL_MS = 2000
const PAGE = 200
/** The most lines kept on the page; older ones drop off the bottom while following along. */
const KEEP = 2000

interface Filters { q: string; kinds: LogKind[]; levels: LogLevel[]; range: RangeId; tests: boolean; code: string; vid: string; game: string; from: number | null; to: number | null }
const DEFAULTS: Filters = { q: '', kinds: KINDS.filter(k => !QUIET.includes(k)), levels: [], range: '24h', tests: false, code: '', vid: '', game: '', from: null, to: null }

function fromHash(): Filters {
  const p = new URLSearchParams(location.hash.split('?')[1] ?? '')
  const list = <T extends string>(k: string, all: T[], d: T[]) => (p.has(k) ? (p.get(k)!.split(',').filter(x => all.includes(x as T)) as T[]) : d)
  return {
    q: p.get('q') ?? '', kinds: list('kinds', KINDS, DEFAULTS.kinds), levels: list('levels', LEVELS, []),
    range: (RANGES.some(r => r.id === p.get('range')) ? p.get('range') : '24h') as RangeId, tests: p.get('tests') === '1',
    code: (p.get('code') ?? '').toUpperCase(), vid: p.get('vid') ?? '', game: p.get('game') ?? '',
    from: Number(p.get('from')) || null, to: Number(p.get('to')) || null,
  }
}
function toHash(f: Filters) {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.kinds.join() !== DEFAULTS.kinds.join()) p.set('kinds', f.kinds.join(','))
  if (f.levels.length) p.set('levels', f.levels.join(','))
  if (f.range !== '24h') p.set('range', f.range)
  if (f.tests) p.set('tests', '1')
  for (const k of ['code', 'vid', 'game'] as const) if (f[k]) p.set(k, f[k])
  if (f.from && f.to) { p.set('from', String(f.from)); p.set('to', String(f.to)) }
  const s = p.toString()
  return '#/logs' + (s ? '?' + s : '')
}

/** "room:ABCDE name:riya game:imposter level:error kind:mod vid:…" in the search box become filters; the rest is text. */
function parseSearch(raw: string) {
  const out: { q: string; code?: string; who?: string; game?: string; vid?: string; levels?: string; kinds?: string } = { q: '' }
  const rest: string[] = []
  for (const tok of raw.match(/(\w+:"[^"]*"|\S+)/g) ?? []) {
    const m = tok.match(/^(room|code|name|who|game|vid|browser|level|kind):"?([^"]*)"?$/i)
    if (!m) { rest.push(tok); continue }
    const k = m[1].toLowerCase(), v = m[2]
    if (k === 'room' || k === 'code') out.code = v.toUpperCase()
    else if (k === 'name' || k === 'who') out.who = v
    else if (k === 'game') out.game = Object.entries(GAME_NAMES).find(([id, n]) => id === v.toLowerCase() || n.toLowerCase() === v.toLowerCase())?.[0] ?? v.toLowerCase()
    else if (k === 'vid' || k === 'browser') out.vid = v
    else if (k === 'level') out.levels = v
    else out.kinds = v
  }
  out.q = rest.join(' ')
  return out
}

/** What the browser should tell you about while the tab is open (in the background too). */
const ALERTS = [
  { id: 'error', label: 'Errors', test: (l: LogLine) => l.level === 'error' },
  { id: 'feedback', label: 'Contact messages and low ratings', test: (l: LogLine) => l.kind === 'feedback' && l.level === 'warn' },
  { id: 'mod', label: 'Bans, removals and refused names', test: (l: LogLine) => l.kind === 'mod' && l.level === 'warn' },
  { id: 'room', label: 'Every new room', test: (l: LogLine) => l.kind === 'room' && / made room /.test(l.text) },
] as const
const readAlerts = (): string[] => { try { return JSON.parse(localStorage.getItem('ct-log-alerts') ?? '[]') } catch { return [] } }

export function LogsPage(s: Shared) {
  const [f, setF] = useState<Filters>(fromHash)
  const [text, setText] = useState(f.q)
  const [lines, setLines] = useState<LogLine[]>([])
  const [page, setPage] = useState<LogPage | null>(null)
  const [more, setMore] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [held, setHeld] = useState<LogLine[]>([])
  const [fresh, setFresh] = useState<Set<number>>(new Set())
  const [open, setOpen] = useState<number | null>(null)
  const [focus, setFocus] = useState(-1)
  const [alerts, setAlerts] = useState<string[]>(readAlerts)
  const [bell, setBell] = useState(false)
  const latest = useRef(0)
  const search = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const gen = useRef(0)

  // The filters as the API takes them. The search box's own words (room:, name:…) are added to the rest.
  const query = useMemo(() => {
    const p = parseSearch(f.q)
    const zoomed = f.from && f.to
    const range = RANGES.find(r => r.id === f.range)!
    return {
      q: p.q || undefined, code: p.code || f.code || undefined, vid: p.vid || f.vid || undefined, who: p.who, game: p.game || f.game || undefined,
      kinds: p.kinds ?? (f.kinds.length === KINDS.length ? undefined : f.kinds.join(',') || 'none'), levels: p.levels ?? (f.levels.join(',') || undefined),
      tests: f.tests ? 1 : undefined, from: zoomed ? f.from! : Date.now() - range.ms, to: zoomed ? f.to! : undefined,
    }
  }, [f])
  const following = !f.to && !paused

  // Filters into the address, so Back works and a view can be kept.
  useEffect(() => { const h = toHash(f); if (location.hash !== h) history.replaceState(null, '', h) }, [f])
  // The search box waits for a pause in typing.
  useEffect(() => { const t = setTimeout(() => setF(x => (x.q === text ? x : { ...x, q: text })), 300); return () => clearTimeout(t) }, [text])

  const load = useCallback(async () => {
    const my = ++gen.current
    setLoading(true)
    try {
      const r = await api.logs({ ...query, limit: PAGE })
      if (my !== gen.current) return
      setPage(r); setLines(r.lines); setMore(r.more); setHeld([]); setErr(null); setFocus(-1)
      latest.current = r.lines[0]?.id ?? r.latest
    } catch (e) { if (e instanceof SignedOut) s.signedOut(); else setErr(e instanceof Error ? e.message : 'Could not read the log') } finally { if (my === gen.current) setLoading(false) }
  }, [query])
  useEffect(() => { void load() }, [load])

  // Following along: what came since the newest line shown, every 2 s while the tab is in view.
  useEffect(() => {
    if (!following) return
    let stop = false, t = 0
    const loop = async () => {
      if (stop) return
      if (document.visibilityState === 'visible' || alerts.length) {
        try {
          const my = gen.current
          const r = await api.logs({ ...query, from: undefined, after: latest.current, limit: 500 })
          if (!stop && my === gen.current && r.lines.length) {
            latest.current = r.lines[r.lines.length - 1].id
            const got = r.lines.slice().reverse()
            notify(got, alerts)
            // Reading further down: new lines wait above, so the page does not jump.
            if (window.scrollY > 240) setHeld(h => [...got, ...h].slice(0, KEEP))
            else add(got)
          }
        } catch (e) { if (e instanceof SignedOut) { s.signedOut(); return } }
      }
      if (!stop) t = window.setTimeout(loop, TAIL_MS)
    }
    t = window.setTimeout(loop, TAIL_MS)
    return () => { stop = true; clearTimeout(t) }
  }, [following, query, alerts])

  const add = (got: LogLine[]) => {
    setLines(l => [...got, ...l].slice(0, KEEP))
    setFresh(new Set(got.map(x => x.id)))
    setTimeout(() => setFresh(new Set()), 2500)
  }
  const showHeld = () => { add(held); setHeld([]); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const older = async () => {
    const last = lines[lines.length - 1]
    if (!last) return
    try { const r = await api.logs({ ...query, before: last.id, limit: PAGE }); setLines(l => [...l, ...r.lines]); setMore(r.more) } catch (e) { if (e instanceof SignedOut) s.signedOut(); else s.toast(e instanceof Error ? e.message : 'Could not read more', 'err') }
  }

  // Keys: / search, j and k move, Enter opens, p pauses, Esc closes or clears.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement
      if (document.querySelector('.d-drawer')) return
      if (e.key === 'Escape' && typing) { (e.target as HTMLElement).blur(); return }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '/') { e.preventDefault(); search.current?.focus() }
      else if (e.key === 'j' || e.key === 'k') {
        e.preventDefault()
        setFocus(i => { const n = Math.max(0, Math.min(lines.length - 1, i + (e.key === 'j' ? 1 : -1))); list.current?.querySelectorAll('li.d-lr')[n]?.scrollIntoView({ block: 'nearest' }); return n })
      } else if (e.key === 'Enter' && focus >= 0) { e.preventDefault(); const id = lines[focus]?.id; setOpen(o => (o === id ? null : id ?? null)) }
      else if (e.key === 'p') setPaused(x => !x)
      else if (e.key === 'Escape') { setOpen(null); setFocus(-1) }
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [lines, focus])

  const set = (next: Partial<Filters>) => setF(x => ({ ...x, ...next }))
  const toggle = <T extends string>(all: T[], on: T[], v: T, only: boolean): T[] => (only ? [v] : on.includes(v) ? on.filter(x => x !== v) : all.filter(x => on.includes(x) || x === v))
  const filterBy = (k: 'code' | 'vid' | 'game', v: string) => { set({ [k]: v } as Partial<Filters>); window.scrollTo(0, 0) }
  const reset = () => { setText(''); setF({ ...DEFAULTS }) }
  const pickAlerts = async (id: string) => {
    const next = alerts.includes(id) ? alerts.filter(x => x !== id) : [...alerts, id]
    if (next.length > alerts.length && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
    setAlerts(next)
    try { localStorage.setItem('ct-log-alerts', JSON.stringify(next)) } catch { /* private mode */ }
  }

  const exportAs = (kind: 'csv' | 'json') => {
    const rows = lines
    const body = kind === 'json' ? JSON.stringify(rows.map(l => ({ ...l, data: l.data ? JSON.parse(l.data) : null, time: new Date(l.at).toISOString() })), null, 2)
      : ['time,level,kind,room,name,browser,game,text', ...rows.map(l => [new Date(l.at).toISOString(), l.level, l.kind, l.code ?? '', l.who ?? '', l.vid ?? '', l.game ?? '', l.text].map(csv).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([body], { type: kind === 'json' ? 'application/json' : 'text/csv' }))
    a.download = `chaotic-tails-log-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${kind}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const chips = [
    f.code && { k: 'code', label: `Room ${f.code}` }, f.vid && { k: 'vid', label: `Browser ${f.vid.slice(0, 8)}…` }, f.game && { k: 'game', label: gameName(f.game) },
    f.from && f.to && { k: 'zoom', label: `${hms(f.from)}–${hms(f.to)}` },
  ].filter(Boolean) as { k: string; label: string }[]
  const notDefault = toHash(f) !== '#/logs'

  return (
    <div class="d-logs">
      <div class="d-toolbar is-sticky" role="toolbar" aria-label="Log filters">
        <label class="d-search is-wide">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4a6 6 0 1 0 3.6 10.8l4.8 4.8 1.4-1.4-4.8-4.8A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" /></svg>
          <input ref={search} type="search" value={text} aria-label="Search the log" placeholder='Search, or room:ABCDE name:riya game:imposter level:error   ( / )' onInput={e => setText((e.target as HTMLInputElement).value)} />
        </label>
        <div class="d-seg" role="group" aria-label="Time">
          {RANGES.map(r => <button key={r.id} type="button" class={f.range === r.id && !f.to ? 'is-on' : ''} aria-pressed={f.range === r.id && !f.to} onClick={() => set({ range: r.id, from: null, to: null })}>{r.id}</button>)}
        </div>
        <button type="button" class={`d-btn ${following ? 'is-live' : 'is-ghost'}`} onClick={() => (f.to ? set({ from: null, to: null }) : setPaused(!paused))} aria-pressed={following} title="p">
          {following ? <><i class="d-pulse" aria-hidden="true" /> Live</> : f.to ? 'Back to live' : '▶ Resume'}
        </button>
        <details class="d-more-menu is-right">
          <summary class="d-btn is-ghost">More</summary>
          <div role="menu">
            <button type="button" role="menuitem" onClick={() => exportAs('csv')}>Download these {lines.length} lines (CSV)</button>
            <button type="button" role="menuitem" onClick={() => exportAs('json')}>Download as JSON</button>
            <button type="button" role="menuitem" onClick={() => { navigator.clipboard?.writeText(location.href).then(() => s.toast('Link to this view copied')) }}>Copy a link to this view</button>
            <label class="d-check"><input type="checkbox" checked={f.tests} onChange={e => set({ tests: (e.target as HTMLInputElement).checked })} /> Include test browsers</label>
          </div>
        </details>
        <details class="d-more-menu is-right" open={bell} onToggle={e => setBell((e.target as HTMLDetailsElement).open)}>
          <summary class="d-icon-btn" aria-label={`Alerts${alerts.length ? ` (${alerts.length} on)` : ''}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.4-2h-4.8a2.5 2.5 0 0 0 2.4 2zm7-6V11a7 7 0 0 0-5.5-6.8V3h-3v1.2A7 7 0 0 0 5 11v5l-2 2v1h18v-1z" /></svg>{alerts.length > 0 && <i class="d-badge">{alerts.length}</i>}</summary>
          <div role="menu" class="d-alerts">
            <p class="d-fine">Tell me on this computer, while this page is open (even in the background):</p>
            {ALERTS.map(a => <label key={a.id} class="d-check"><input type="checkbox" checked={alerts.includes(a.id)} onChange={() => pickAlerts(a.id)} /> {a.label}</label>)}
            {'Notification' in window && Notification.permission === 'denied' && <p class="d-note is-err">Notifications are blocked for this site in the browser's settings.</p>}
          </div>
        </details>
      </div>

      <div class="d-filters">
        <div class="d-chipset" role="group" aria-label="Kinds of lines">
          {KINDS.map(k => {
            const on = f.kinds.includes(k), n = page?.kinds?.[k] ?? 0
            return <button key={k} type="button" class={`d-fchip is-${k} ${on ? 'is-on' : ''}`} aria-pressed={on} title="Click to switch; Alt-click for this kind only"
              onClick={e => set({ kinds: toggle(KINDS, f.kinds, k, e.altKey) })}>{KIND_LABEL[k]}<small>{num(n)}</small></button>
          })}
        </div>
        <div class="d-chipset" role="group" aria-label="Levels">
          {LEVELS.map(l => {
            // None picked means every level: all show as on, and a click picks just that one.
            const on = !f.levels.length || f.levels.includes(l)
            return <button key={l} type="button" class={`d-fchip is-lv-${l} ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => set({ levels: toggle(LEVELS, f.levels, l, false) })}><i aria-hidden="true" />{LEVEL_LABEL[l]}<small>{num(page?.levels?.[l] ?? 0)}</small></button>
          })}
          {chips.map(c => <button key={c.k} type="button" class="d-fchip is-on is-filter" onClick={() => set(c.k === 'zoom' ? { from: null, to: null } : { [c.k]: '' } as Partial<Filters>)} aria-label={`Remove filter ${c.label}`}>{c.label} ×</button>)}
          {notDefault && <button type="button" class="d-link" onClick={reset}>Clear all</button>}
        </div>
      </div>

      {page?.hist && <Histogram h={page.hist} zoom={(from, to) => set({ from, to })} />}

      {err && <p class="d-note is-err" role="alert">{err}</p>}
      {held.length > 0 && <button type="button" class="d-held" onClick={showHeld}>↑ {held.length} new line{held.length === 1 ? '' : 's'}</button>}
      <div class="d-card d-log-card" aria-busy={loading}>
        <div class="d-log-head">
          <span>{loading ? 'Reading…' : `${num(lines.length)} line${lines.length === 1 ? '' : 's'}${more ? ' (more below)' : ''}`}{!following && !f.to && <b> · paused</b>}</span>
          <span class="d-fine">Times in IST · j/k to move, Enter to open, p to pause</span>
        </div>
        {lines.length ? (
          <ul class="d-log" ref={list}>
            {lines.map((l, i) => <LogRow key={l.id} l={l} s={s} open={open === l.id} fresh={fresh.has(l.id)} focus={i === focus} onToggle={() => { setOpen(open === l.id ? null : l.id); setFocus(i) }} filter={filterBy} />)}
          </ul>
        ) : !loading && <p class="d-empty">{notDefault ? 'No lines match. Try a longer time, or clear the filters.' : 'Nothing logged yet. Lines appear here as people visit and play.'}</p>}
        {more && <div class="d-log-more"><button type="button" class="d-btn is-ghost" onClick={older}>Older lines</button></div>}
      </div>
      <p class="d-fine">Kept 7 days. Names are what people typed; chat is never logged. Test browsers are hidden unless you include them (More).</p>
    </div>
  )
}

const csv = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/** Browser notifications for lines that match the alerts picked, at most three at a time. */
function notify(lines: LogLine[], on: string[]) {
  if (!on.length || !('Notification' in window) || Notification.permission !== 'granted') return
  const hits = lines.filter(l => !l.x && ALERTS.some(a => on.includes(a.id) && a.test(l))).slice(0, 3)
  for (const l of hits) {
    try { new Notification(`Chaotic Tails · ${LEVEL_LABEL[l.level]}${l.code ? ` · ${l.code}` : ''}`, { body: l.text, tag: `ct-${l.id}` }) } catch { /* some browsers need a service worker */ }
  }
}

/** Lines over the time picked, as columns split by level. Hover reads a column; click one to look at just that time. */
function Histogram({ h, zoom }: { h: NonNullable<LogPage['hist']>; zoom: (from: number, to: number) => void }) {
  const [pick, setPick] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  const total = (b: (typeof h.buckets)[number]) => b.info + b.good + b.warn + b.error
  const top = Math.max(1, ...h.buckets.map(total))
  const height = 96, base = height - 18, ih = base - 6
  const band = w / h.buckets.length, bw = Math.max(2, band - 2)
  const fmt = (ms: number) => (h.to - h.from >= 20 * 3_600_000 ? when(ms) : hms(ms).slice(0, 5))
  const at = pick === null ? null : h.buckets[pick]
  const sum = h.buckets.reduce((a, b) => a + total(b), 0)
  return (
    <div class="d-card d-hist-card">
      {/* One line that never changes height: hovering changes its words, and a taller line would move the chart out
          from under the pointer, back and forth. */}
      <p class="d-hist-read" aria-live="polite">
        {at ? <><b>{fmt(at.at)}–{fmt(at.at + h.size)}</b> · {num(total(at))} line{total(at) === 1 ? '' : 's'}{at.error ? ` · ${at.error} errors` : ''}{at.warn ? ` · ${at.warn} warnings` : ''}</>
          : <><b>{fmt(h.from)} to {h.to >= Date.now() - 60_000 ? 'now' : fmt(h.to)}</b> · {num(sum)} line{sum === 1 ? '' : 's'}{sum ? ' · click a column to look closer' : ''}</>}
      </p>
      <div ref={ref} class="d-plot">
        {w > 0 && (
          <svg width={w} height={height} role="img" aria-label={`Log lines over time: ${sum} in all`} onPointerLeave={() => setPick(null)}>
            <line class="d-base" x1={0} x2={w} y1={base} y2={base} />
            {h.buckets.map((b, i) => {
              let y = base
              const segs = (['info', 'good', 'warn', 'error'] as const).map(k => {
                const hh = (b[k] / top) * ih
                if (!b[k]) return null
                const seg = <rect key={k} class={`d-hseg is-${k}`} x={i * band + (band - bw) / 2} y={y - hh} width={bw} height={Math.max(1, hh - (y < base ? 1 : 0))} rx={1} />
                y -= hh
                return seg
              })
              return <g key={i} onPointerEnter={() => setPick(i)} onClick={() => zoom(b.at, b.at + h.size)} class={pick === i ? 'is-on' : ''}>
                <rect x={i * band} y={0} width={band} height={height} fill="transparent" style={{ cursor: total(b) ? 'zoom-in' : 'default' }} />
                {segs}
              </g>
            })}
            <text class="d-tick" x={0} y={height - 3}>{fmt(h.from)}</text>
            <text class="d-tick" x={w} y={height - 3} text-anchor="end">{h.to >= Date.now() - 60_000 ? 'now' : fmt(h.to)}</text>
          </svg>
        )}
      </div>
      <span class="d-hkey"><span><i class="is-info" />Info</span><span><i class="is-good" />Good</span><span><i class="is-warn" />Warning</span><span><i class="is-error" />Error</span></span>
    </div>
  )
}
