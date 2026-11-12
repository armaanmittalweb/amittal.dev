import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { api, SignedOut, type LiveRoom, type LiveRooms } from '../api'
import { countryName } from '../format'
import { Bump, type Shared } from './Dash'
import { Avatar, BROWSERS, DEVICE, GAME_NAMES, gameName, PHASE, span } from './Panels'

// Live: every room someone is in right now, who is in it under which name, and what they are playing; or the same
// as a list of people. Read every 3 seconds while the tab is in view. Click a room or a person for its panel.

const EVERY = 3000
type View = 'rooms' | 'people'
type PhaseFilter = 'all' | 'game' | 'lobby' | 'results' | 'door'

function readPref<T extends string>(key: string, ok: readonly T[], fallback: T): T {
  try { const v = localStorage.getItem(key) as T | null; return v && ok.includes(v) ? v : fallback } catch { return fallback }
}
function savePref(key: string, v: string) { try { localStorage.setItem(key, v) } catch { /* private mode */ } }

interface PersonRow {
  key: string; name: string; vid: string | null; code: string; phase: string; game: string | null; host: boolean; playing: boolean; online: boolean
  joined: number; x: boolean; room: LiveRoom; waiting?: boolean
}

export function LivePage(s: Shared) {
  const [data, setData] = useState<LiveRooms | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [at, setAt] = useState(0)
  const [view, setView] = useState<View>(() => readPref('ct-live-view', ['rooms', 'people'] as const, 'rooms'))
  const [phase, setPhase] = useState<PhaseFilter>('all')
  const [q, setQ] = useState('')
  const [tests, setTests] = useState(false)
  const [, tick] = useState(0)
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let stop = false, t = 0
    const loop = async () => {
      if (stop) return
      if (document.visibilityState === 'visible') {
        try {
          const r = await api.rooms()
          Object.assign(GAME_NAMES, r.names)
          Object.assign(BROWSERS, r.browsers)
          setData(r); setAt(Date.now()); setErr(null)
        } catch (e) { if (e instanceof SignedOut) { s.signedOut(); return } setErr(e instanceof Error ? e.message : 'Could not read the rooms') }
      }
      if (!stop) t = window.setTimeout(loop, EVERY)
    }
    void loop()
    const clock = window.setInterval(() => tick(n => n + 1), 1000)
    const key = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); search.current?.focus() }
    }
    addEventListener('keydown', key)
    return () => { stop = true; clearTimeout(t); clearInterval(clock); removeEventListener('keydown', key) }
  }, [])

  const rooms = useMemo(() => (data?.rooms ?? []).filter(r => r.info && (tests || !r.x)), [data, tests])
  const needle = q.trim().toLowerCase()
  const match = (r: LiveRoom) => !needle || r.info!.code.toLowerCase().includes(needle) || gameName(r.info!.game).toLowerCase().includes(needle) || r.info!.members.some(m => m.name.toLowerCase().includes(needle))
  const phaseOk = (r: LiveRoom) => phase === 'all' || (phase === 'door' ? r.info!.waiting.length > 0 : r.info!.phase === phase)
  const shown = rooms.filter(r => match(r) && phaseOk(r))

  const people: PersonRow[] = useMemo(() => {
    const out: PersonRow[] = []
    for (const r of rooms) {
      const i = r.info!
      for (const m of i.members) if (m.online) out.push({ key: r.rid + m.id, name: m.name, vid: m.vid, code: i.code, phase: i.phase, game: i.game, host: m.host, playing: m.playing, online: m.online, joined: m.joined, x: m.x || !!(m.vid && data?.browsers[m.vid]?.x), room: r })
      for (const w of i.waiting) out.push({ key: r.rid + 'w' + w.name + w.at, name: w.name, vid: null, code: i.code, phase: i.phase, game: i.game, host: false, playing: false, online: true, joined: w.at, x: r.x, room: r, waiting: true })
    }
    return out.sort((a, b) => a.code.localeCompare(b.code) || Number(b.host) - Number(a.host) || a.joined - b.joined)
  }, [rooms, data])
  const peopleShown = people.filter(p => (tests || !p.x) && (!needle || p.name.toLowerCase().includes(needle) || p.code.toLowerCase().includes(needle) || gameName(p.game).toLowerCase().includes(needle))
    && (phase === 'all' || (phase === 'door' ? p.waiting : p.phase === phase && !p.waiting)))

  const real = rooms
  const online = real.reduce((a, r) => a + r.info!.members.filter(m => m.online).length, 0)
  const count = (f: (r: LiveRoom) => number) => real.reduce((a, r) => a + f(r), 0)
  const playing = count(r => r.info!.phase === 'game' ? r.info!.members.filter(m => m.online && m.playing).length : 0)
  const lobby = count(r => r.info!.phase === 'lobby' ? r.info!.members.filter(m => m.online).length : 0)
  const results = count(r => r.info!.phase === 'results' ? r.info!.members.filter(m => m.online).length : 0)
  const door = count(r => r.info!.waiting.length)
  const screens = count(r => r.info!.screens)
  const hidden = (data?.rooms ?? []).filter(r => r.x).length

  const broadcast = async () => {
    const text = prompt(`A message to everyone in all ${real.length} open room${real.length === 1 ? '' : 's'}. It shows at the top of their screens, from Chaotic Tails:`, '')
    if (!text?.trim()) return
    try { const r = await api.broadcast(text.trim()); s.toast(`Sent to ${r.sent} of ${r.rooms} rooms`) } catch (e) { if (e instanceof SignedOut) s.signedOut(); else s.toast(e instanceof Error ? e.message : 'Could not send', 'err') }
  }
  const pickView = (v: View) => { setView(v); savePref('ct-live-view', v) }
  const fresh = at && Date.now() - at < EVERY * 3

  return (
    <div class="d-live-page">
      <section class="d-now" aria-label="Right now">
        <div>
          <span class="d-kicker"><i class={`d-pulse ${fresh ? '' : 'is-stale'}`} aria-hidden="true" /> In rooms right now{at ? ` · ${fresh ? 'live' : `last read ${span(Date.now() - at)} ago`}` : ''}</span>
          <div class="d-now-nums">
            <span><b><Bump v={online} /></b> people</span>
            <span><b><Bump v={real.length} /></b> room{real.length === 1 ? '' : 's'}</span>
            <span><b><Bump v={playing} /></b> playing</span>
          </div>
        </div>
        <ul class="d-chips">
          <li><button type="button" class={`d-chip ${phase === 'lobby' ? 'is-ok' : ''}`} onClick={() => setPhase(phase === 'lobby' ? 'all' : 'lobby')}><span>In a lobby</span><b>{lobby}</b></button></li>
          <li><button type="button" class={`d-chip ${phase === 'results' ? 'is-ok' : ''}`} onClick={() => setPhase(phase === 'results' ? 'all' : 'results')}><span>On results</span><b>{results}</b></button></li>
          <li><button type="button" class={`d-chip ${door ? 'is-warn' : ''}`} onClick={() => setPhase(phase === 'door' ? 'all' : 'door')}><span>At a door</span><b>{door}</b></button></li>
          <li><div class="d-chip"><span>TV screens</span><b>{screens}</b></div></li>
        </ul>
      </section>

      <div class="d-toolbar" role="toolbar" aria-label="Live filters">
        <div class="d-seg" role="group" aria-label="Show">
          {(['rooms', 'people'] as const).map(v => <button key={v} type="button" class={view === v ? 'is-on' : ''} aria-pressed={view === v} onClick={() => pickView(v)}>{v === 'rooms' ? `Rooms ${real.length}` : `People ${people.filter(p => tests || !p.x).length}`}</button>)}
        </div>
        <label class="d-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4a6 6 0 1 0 3.6 10.8l4.8 4.8 1.4-1.4-4.8-4.8A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" /></svg>
          <input ref={search} type="search" value={q} placeholder="Name, room code or game   ( / )" aria-label="Search rooms and people" onInput={e => setQ((e.target as HTMLInputElement).value)} />
        </label>
        <select class="d-select" value={phase} aria-label="Where" onChange={e => setPhase((e.target as HTMLSelectElement).value as PhaseFilter)}>
          <option value="all">Everywhere</option><option value="game">Playing</option><option value="lobby">In a lobby</option><option value="results">On results</option><option value="door">At a door</option>
        </select>
        <label class="d-check"><input type="checkbox" checked={tests} onChange={e => setTests((e.target as HTMLInputElement).checked)} /> Test rooms{hidden ? ` (${hidden})` : ''}</label>
        <span class="d-top-gap" />
        <button type="button" class="d-btn is-ghost" onClick={broadcast} disabled={!real.length}>Message every room</button>
      </div>

      {err && <p class="d-note is-err" role="alert">{err}. Trying again every few seconds.</p>}
      {!data && !err && <div class="d-room-grid" aria-busy="true">{[0, 1, 2].map(i => <div key={i} class="d-card d-ghost" />)}</div>}

      {data && view === 'rooms' && (shown.length ? (
        <ul class="d-room-grid">
          {shown.map(r => <RoomCard key={r.rid} r={r} s={s} />)}
        </ul>
      ) : <Empty any={real.length > 0} />)}

      {data && view === 'people' && (peopleShown.length ? (
        <div class="d-card d-table-card">
          <div class="d-table-wrap">
            <table class="d-table d-people">
              <thead><tr><th scope="col">Name</th><th scope="col">Room</th><th scope="col">Doing</th><th scope="col">Country</th><th scope="col">Device</th><th scope="col">In for</th></tr></thead>
              <tbody>
                {peopleShown.map(p => {
                  const b = p.vid ? data.browsers[p.vid] : undefined
                  return (
                    <tr key={p.key} class={p.vid ? 'is-click' : ''} onClick={() => p.vid && s.open({ kind: 'person', vid: p.vid })}>
                      <th scope="row"><span class="d-who"><Avatar name={p.name} />{p.vid ? <button type="button" class="d-link" onClick={e => { e.stopPropagation(); s.open({ kind: 'person', vid: p.vid! }) }}>{p.name}</button> : p.name}{p.host && <span class="d-tag">host</span>}{p.x && <span class="d-tag">test</span>}</span></th>
                      <td><button type="button" class="d-link" onClick={e => { e.stopPropagation(); s.open({ kind: 'room', code: p.code }) }}><code>{p.code}</code></button></td>
                      <td>{p.waiting ? <span class="d-tag is-warn">At the door</span> : p.phase === 'game' ? (p.playing ? `Playing ${gameName(p.game)}` : `Watching ${gameName(p.game)}`) : PHASE[p.phase]}</td>
                      <td>{b?.country ? countryName(b.country) : '—'}</td>
                      <td>{b?.device ? DEVICE[b.device] ?? b.device : '—'}</td>
                      <td>{span(Date.now() - p.joined)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : <Empty any={people.length > 0} />)}
      <p class="d-fine">Names are what people typed in the room. Rooms report a change as it happens; this page reads them every 3 seconds. Press / to search.</p>
    </div>
  )
}

function Empty({ any }: { any: boolean }) {
  return <div class="d-card"><p class="d-empty">{any ? 'Nothing matches that. Clear the search or the filter.' : 'Nobody is in a room right now. Rooms show up here the moment someone joins one.'}</p></div>
}

function RoomCard({ r, s }: { r: LiveRoom; s: Shared }) {
  const i = r.info!
  const here = i.members.filter(m => m.online)
  const away = i.members.length - here.length
  const label = i.phase === 'game' ? `Playing ${gameName(i.game)}` : PHASE[i.phase]
  return (
    <li>
      <button type="button" class={`d-room is-${i.phase} ${r.x ? 'is-test' : ''}`} onClick={() => s.open({ kind: 'room', code: i.code })} aria-label={`Room ${i.code}: ${label}, ${here.length} here`}>
        <span class="d-room-top">
          <code class="d-room-code">{i.code}</code>
          <span class={`d-phase is-${i.phase}`}>{label}</span>
        </span>
        <span class="d-room-sub">
          {i.night ? `Game ${Math.max(1, i.night.at)} of ${i.night.of} · ${i.night.kind} night` : r.games ? `${r.games} game${r.games === 1 ? '' : 's'} so far` : 'No game yet'}
          {i.began && i.phase === 'game' ? ` · ${span(Date.now() - i.began)} in` : ''}
          {r.created ? ` · open ${span(Date.now() - r.created)}` : ''}
        </span>
        <span class="d-room-people">
          {here.slice(0, 10).map(m => <span key={m.id} class={`d-pchip ${m.playing ? 'is-playing' : ''}`}><Avatar name={m.name} />{m.name}{m.host && <i class="d-crown" title="Host" aria-label="host">★</i>}</span>)}
          {here.length > 10 && <span class="d-pchip">+{here.length - 10}</span>}
        </span>
        <span class="d-flags">
          <span class="d-tag">{here.length} here{away ? ` · ${away} away` : ''}</span>
          {i.waiting.length > 0 && <span class="d-tag is-warn">{i.waiting.length} at the door</span>}
          {i.ask && <span class="d-tag">Asks first</span>}
          {i.locked && <span class="d-tag is-warn">Locked</span>}
          {i.screens > 0 && <span class="d-tag">TV ×{i.screens}</span>}
          {r.x && <span class="d-tag">test</span>}
        </span>
      </button>
    </li>
  )
}
