import type { ComponentChildren } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { api, SignedOut, type Browser, type LogLine, type Person, type RoomAction, type RoomDetail, type RoomMember } from '../api'
import { countryName } from '../format'
import type { Shared } from './Dash'

// The side panel the Live and Logs pages open: one room (read live from the room, every few seconds, with the
// console's actions on it) or one browser (where it came from, the names it played under, its rooms and lines).

export type Panel = { kind: 'room'; code: string } | { kind: 'person'; vid: string }

/** Game names, filled by whichever page read them first (the Live page's rooms, or the games report). */
export const GAME_NAMES: Record<string, string> = {}
export const gameName = (id: string | null | undefined) => (id ? GAME_NAMES[id] ?? id : '')
/** Where each browser in a room now came from (the Live page keeps this fresh), for the room panel. */
export const BROWSERS: Record<string, Browser> = {}

const IST = 'Asia/Kolkata'
export const hms = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: IST })
export const when = (ms: number) => new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: IST })
/** A short length of time: 40 s, 12 min, 3 h 5 min, 2 d. */
export function span(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s} s`
  if (s < 3600) return `${Math.round(s / 60)} min`
  if (s < 86400) { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return m ? `${h} h ${m} min` : `${h} h` }
  return `${Math.round(s / 86400)} d`
}
export const PHASE: Record<string, string> = { lobby: 'In the lobby', game: 'Playing', results: 'On the results' }
export const DEVICE: Record<string, string> = { mobile: 'Phone', tablet: 'Tablet', desktop: 'Computer' }
export const KIND_LABEL: Record<string, string> = {
  room: 'Room', join: 'Joins', line: 'Connections', game: 'Games', mod: 'Moderation', visit: 'Visits', feedback: 'Feedback',
  error: 'Errors', share: 'Shares', daily: 'Daily', admin: 'Console',
}
export const LEVEL_LABEL: Record<string, string> = { info: 'Info', good: 'Good', warn: 'Warning', error: 'Error' }

/** A person's initial on their colour, or a TV for a screen. */
export function Avatar({ name, on = true }: { name: string; on?: boolean }) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return <span class={`d-av ${on ? '' : 'is-off'}`} style={{ '--h': h } as Record<string, number>} aria-hidden="true">{(name.trim()[0] ?? '?').toUpperCase()}</span>
}

/** A level as a dot and, for warnings and errors, its word too (never colour alone). */
export function LevelMark({ level }: { level: string }) {
  return <span class={`d-lv is-${level}`}><i aria-hidden="true" />{level === 'warn' || level === 'error' ? LEVEL_LABEL[level] : <span class="d-vh">{LEVEL_LABEL[level] ?? level}</span>}</span>
}

const parse = (s: string | null) => { if (!s) return null; try { return JSON.parse(s) as Record<string, unknown> } catch { return null } }

/** One log line: time, level, kind, room, who and what. Opens to show everything kept on it, with ways on. */
export function LogRow({ l, s, open, onToggle, fresh, focus, filter }: {
  l: LogLine; s: Shared; open: boolean; onToggle: () => void; fresh?: boolean; focus?: boolean
  filter?: (k: 'code' | 'vid' | 'game', v: string) => void
}) {
  const data = open ? parse(l.data) : null
  return (
    <li class={`d-lr is-${l.level} ${open ? 'is-open' : ''} ${fresh ? 'is-fresh' : ''} ${focus ? 'is-focus' : ''}`} data-id={l.id}>
      <button type="button" class="d-lr-main" aria-expanded={open} onClick={onToggle}>
        <time dateTime={new Date(l.at).toISOString()} title={when(l.at)}>{hms(l.at)}</time>
        <LevelMark level={l.level} />
        <span class={`d-kind is-${l.kind}`}>{KIND_LABEL[l.kind] ?? l.kind}</span>
        <span class="d-lr-text">{l.text}{l.x && <span class="d-tag">test</span>}</span>
        <span class="d-lr-meta">{l.code && <code>{l.code}</code>}{l.who && <b>{l.who}</b>}</span>
      </button>
      {open && (
        <div class="d-lr-more">
          <dl class="d-kv">
            <div><dt>When</dt><dd>{when(l.at)} <small>({hms(l.at)} IST)</small></dd></div>
            {l.code && <div><dt>Room</dt><dd><code>{l.code}</code>{l.rid && <small> · id {l.rid}</small>}</dd></div>}
            {l.who && <div><dt>Name</dt><dd>{l.who}</dd></div>}
            {l.vid && <div><dt>Browser</dt><dd><code>{l.vid}</code></dd></div>}
            {l.game && <div><dt>Game</dt><dd>{gameName(l.game)}</dd></div>}
            {data && Object.entries(data).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{Array.isArray(v) ? v.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd></div>)}
          </dl>
          <div class="d-row">
            {l.code && <button type="button" class="d-btn is-ghost is-sm" onClick={() => s.open({ kind: 'room', code: l.code! })}>Open room {l.code}</button>}
            {l.vid && <button type="button" class="d-btn is-ghost is-sm" onClick={() => s.open({ kind: 'person', vid: l.vid! })}>Open this browser</button>}
            {filter && l.code && <button type="button" class="d-btn is-ghost is-sm" onClick={() => filter('code', l.code!)}>Only this room</button>}
            {filter && l.vid && <button type="button" class="d-btn is-ghost is-sm" onClick={() => filter('vid', l.vid!)}>Only this browser</button>}
            {filter && l.game && <button type="button" class="d-btn is-ghost is-sm" onClick={() => filter('game', l.game!)}>Only {gameName(l.game)}</button>}
            <button type="button" class="d-btn is-ghost is-sm" onClick={() => copy(`${when(l.at)} ${l.level} ${l.kind}${l.code ? ` ${l.code}` : ''}${l.who ? ` ${l.who}` : ''}: ${l.text}`, s)}>Copy</button>
          </div>
        </div>
      )}
    </li>
  )
}

export function copy(text: string, s: Pick<Shared, 'toast'>) {
  navigator.clipboard?.writeText(text).then(() => s.toast('Copied'), () => s.toast('Could not copy', 'err'))
}

/** The panel at the side: a room or a browser, with Back when one was opened from the other. */
export function Drawer({ stack, s, close, back }: { stack: Panel[]; s: Shared; close: () => void; back: () => void }) {
  const top = stack[stack.length - 1]
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close() } }
    addEventListener('keydown', key)
    ref.current?.focus()
    return () => removeEventListener('keydown', key)
  }, [close])
  if (!top) return null
  return (
    <>
      <button type="button" class="d-drawer-scrim" aria-label="Close the panel" onClick={close} />
      <div class="d-drawer" role="dialog" aria-modal="true" aria-label={top.kind === 'room' ? `Room ${top.code}` : 'A browser'} ref={ref} tabIndex={-1}>
        <div class="d-drawer-bar">
          {stack.length > 1 ? <button type="button" class="d-btn is-ghost is-sm" onClick={back}>‹ Back</button> : <span />}
          <button type="button" class="d-icon-btn" aria-label="Close" onClick={close}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z" /></svg></button>
        </div>
        {top.kind === 'room' ? <RoomPanel key={top.code} code={top.code} s={s} /> : <PersonPanel key={top.vid} vid={top.vid} s={s} />}
      </div>
    </>
  )
}

/** Asks every few seconds while the tab is in view; stops when the panel closes. */
function usePoll<T>(load: () => Promise<T>, every: number, s: Shared): [T | null, string | null, () => Promise<void>] {
  const [data, setData] = useState<T | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const pull = useCallback(async () => {
    try { setData(await load()); setErr(null) } catch (e) { if (e instanceof SignedOut) s.signedOut(); else setErr(e instanceof Error ? e.message : 'Could not read it') }
  }, [load])
  useEffect(() => {
    let stop = false, t = 0
    const loop = async () => { if (stop) return; if (document.visibilityState === 'visible') await pull(); if (!stop) t = window.setTimeout(loop, every) }
    void loop()
    return () => { stop = true; clearTimeout(t) }
  }, [pull, every])
  return [data, err, pull]
}

function Section({ title, children, note }: { title: string; children: ComponentChildren; note?: string }) {
  return <section class="d-ps"><h3>{title}{note && <small>{note}</small>}</h3>{children}</section>
}

function RoomPanel({ code, s }: { code: string; s: Shared }) {
  const load = useCallback(() => api.room(code), [code])
  const [data, err, pull] = usePoll(load, 3000, s)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [openLine, setOpenLine] = useState<number | null>(null)
  const [gone, setGone] = useState(false)

  const act = async (a: RoomAction, done: string, ask?: string) => {
    if (ask && !confirm(ask)) return
    setBusy(a.a + ('id' in a ? a.id : ''))
    try {
      const r = await api.roomAct(code, a)
      s.toast(done)
      if (r.closed) setGone(true)
      else await pull()
    } catch (e) { if (e instanceof SignedOut) s.signedOut(); else s.toast(e instanceof Error ? e.message : 'That did not work', 'err') } finally { setBusy(null) }
  }
  const member = (m: RoomMember, a: 'kick' | 'ban' | 'block' | 'host') => {
    if (a === 'block') {
      const note = prompt(`Block ${m.name}'s browser from every room on the site? They are taken out of this room now.\n\nA note for yourself (why):`, '')
      if (note === null) return
      return act({ a, id: m.id, note }, `${m.name} is blocked from every room`)
    }
    const say = { kick: [`Remove ${m.name} from room ${code}? They can join again.`, `${m.name} was removed`], ban: [`Ban ${m.name} from room ${code}? They cannot come back to this room.`, `${m.name} is banned from this room`], host: [`Make ${m.name} the host of room ${code}?`, `${m.name} is the host now`] }[a]
    return act({ a, id: m.id }, say[1], say[0])
  }

  if (gone) return <div class="d-panel"><h2 class="d-panel-title">Room <code>{code}</code></h2><p class="d-note">The room is closed. Everyone in it was told, and it is gone.</p></div>
  if (!data) return <div class="d-panel">{err ? <p class="d-note is-err" role="alert">{err}</p> : <div class="d-ghost d-panel-ghost" aria-busy="true" />}</div>
  const r = data.room
  const here = r.members.filter(m => m.online)
  return (
    <div class="d-panel">
      <header class="d-panel-head">
        <span class="d-kicker">Room</span>
        <h2 class="d-panel-title"><code>{code}</code> <span class={`d-phase is-${r.phase}`}>{r.phase === 'game' ? `Playing ${gameName(r.game)}` : PHASE[r.phase]}</span></h2>
        <p class="d-panel-sub">{here.length} here of {r.members.length}{r.host && <> · host <b>{r.host}</b></>}{r.night && <> · game {r.night.at} of {r.night.of} of a {r.night.kind} night</>} · last move {span(Date.now() - r.touched)} ago</p>
        <div class="d-flags">
          {r.ask && <span class="d-tag">Asks before letting people in</span>}
          {r.locked && <span class="d-tag is-warn">Locked</span>}
          {r.screens > 0 && <span class="d-tag">On {r.screens} TV{r.screens > 1 ? 's' : ''}</span>}
          {r.quick && <span class="d-tag">Quick rules</span>}
          {r.relaxed && <span class="d-tag">More time</span>}
          {!r.watch && <span class="d-tag">No watching</span>}
          {r.adFree && <span class="d-tag">First room (no ads)</span>}
        </div>
        {err && <p class="d-fine" role="status">Not updating: {err}</p>}
      </header>

      <Section title="Do something">
        <form class="d-msg" onSubmit={e => { e.preventDefault(); if (msg.trim()) void act({ a: 'notice', text: msg.trim() }, 'Sent to everyone in the room').then(() => setMsg('')) }}>
          <label class="d-field"><span>Message to everyone in the room <small>{msg.length}/300</small></span>
            <input value={msg} maxLength={300} placeholder="Shows at the top of their screens, from Chaotic Tails" onInput={e => setMsg((e.target as HTMLInputElement).value)} />
          </label>
          <button type="submit" class="d-btn" disabled={!msg.trim() || busy === 'notice'}>Send</button>
        </form>
        <div class="d-row">
          {r.phase === 'game' && <button type="button" class="d-btn is-ghost" disabled={!!busy} onClick={() => act({ a: 'end' }, 'The game was stopped', `Stop ${gameName(r.game)} for everyone in room ${code}?`)}>Stop the game</button>}
          <button type="button" class="d-btn is-ghost" disabled={!!busy} onClick={() => act({ a: 'lock', on: !r.locked }, r.locked ? 'Unlocked' : 'Locked: nobody new can join')}>{r.locked ? 'Unlock' : 'Lock the room'}</button>
          <button type="button" class="d-btn is-ghost" disabled={!!busy} onClick={() => act({ a: 'ask', on: !r.ask }, r.ask ? 'Anyone with the link can join again' : 'New people now wait at the door')}>{r.ask ? 'Stop asking at the door' : 'Ask at the door'}</button>
          <button type="button" class="d-btn is-danger" disabled={!!busy} onClick={() => act({ a: 'close' }, `Room ${code} is closed`, `Close room ${code}? Everyone in it is sent out and the room is deleted. This cannot be undone.`)}>Close the room</button>
        </div>
      </Section>

      {r.waiting.length > 0 && (
        <Section title="Waiting at the door">
          <ul class="d-plist">{r.waiting.map(w => <li key={w.name + w.at}><Avatar name={w.name} /><span><b>{w.name}</b><small>waiting {span(Date.now() - w.at)}</small></span></li>)}</ul>
        </Section>
      )}

      <Section title="People" note={`${here.length} here`}>
        <ul class="d-plist">
          {r.members.map(m => {
            const b = m.vid ? BROWSERS[m.vid] : undefined
            const bits = [m.online ? (m.playing ? 'playing' : r.phase === 'game' ? 'watching' : 'here') : 'away', b?.country && countryName(b.country), b?.device && DEVICE[b.device], m.games ? `${m.pts} pts in ${m.games} game${m.games > 1 ? 's' : ''}` : null].filter(Boolean)
            return (
              <li key={m.id} class={m.online ? '' : 'is-away'}>
                <Avatar name={m.name} on={m.online} />
                <span><b>{m.name}</b>{m.host && <span class="d-tag">host</span>}{(m.x || b?.x) && <span class="d-tag">test</span>}<small>{bits.join(' · ')}</small></span>
                <span class="d-plist-act">
                  {m.vid && <button type="button" class="d-btn is-ghost is-sm" onClick={() => s.open({ kind: 'person', vid: m.vid! })}>Browser</button>}
                  <details class="d-more-menu">
                    <summary class="d-btn is-ghost is-sm" aria-label={`Actions for ${m.name}`}>•••</summary>
                    <div role="menu">
                      {!m.host && m.online && <button type="button" role="menuitem" onClick={() => member(m, 'host')}>Make host</button>}
                      <button type="button" role="menuitem" onClick={() => member(m, 'kick')}>Remove from the room</button>
                      <button type="button" role="menuitem" onClick={() => member(m, 'ban')}>Ban from this room</button>
                      {m.vid && <button type="button" role="menuitem" class="is-danger" onClick={() => member(m, 'block')}>Block from every room</button>}
                    </div>
                  </details>
                </span>
              </li>
            )
          })}
        </ul>
      </Section>

      {r.inst && (
        <Section title={r.phase === 'game' ? 'The game now' : 'The last game'}>
          <dl class="d-kv">
            <div><dt>Game</dt><dd>{gameName(r.inst.id)} <small>(game {r.inst.n} in this room)</small></dd></div>
            <div><dt>State</dt><dd>{r.inst.intro ? 'Reading the rules' : r.inst.paused ? 'Paused by the host' : r.phase === 'game' ? 'Being played' : 'Finished'}</dd></div>
            {r.inst.startedAt && <div><dt>Started</dt><dd>{span(Date.now() - r.inst.startedAt)} ago</dd></div>}
            <div><dt>Players</dt><dd>{r.inst.players.join(', ')}</dd></div>
            <div><dt>Moves</dt><dd>{r.inst.moves}</dd></div>
          </dl>
        </Section>
      )}

      {r.plan && (
        <Section title="Game night" note={`${r.plan.kind}${r.plan.done ? ', finished' : ''}`}>
          <ol class="d-plan">{r.plan.games.map((g, i) => <li key={i} class={i === r.plan!.at ? 'is-now' : i < r.plan!.at ? 'is-done' : ''}>{gameName(g)}</li>)}</ol>
          {r.plan.table.length > 0 && <p class="d-fine">Table: {r.plan.table.slice(0, 6).map(t => `${t.name} ${t.pts}`).join(' · ')}</p>}
        </Section>
      )}

      {r.history.length > 0 && (
        <Section title="Played here">
          <ul class="d-hist">{r.history.map((h, i) => <li key={i}><span>{gameName(h.id)}</span><small>{h.winners.length ? `${h.winners.join(' & ')} won` : 'no winner'} · {when(h.at)}</small></li>)}</ul>
        </Section>
      )}

      {r.bans.length > 0 && <Section title="Banned by the host"><p>{r.bans.map(b => b.name).join(', ')}</p></Section>}

      <Section title="What happened" note={`${data.lines.length} lines, newest first`}>
        {data.lines.length ? <ul class="d-log is-compact">{data.lines.map(l => <LogRow key={l.id} l={l} s={s} open={openLine === l.id} onToggle={() => setOpenLine(openLine === l.id ? null : l.id)} />)}</ul>
          : <p class="d-empty">Nothing logged for this room yet (rooms made before the log started have no lines).</p>}
      </Section>
      <p class="d-fine">The room holds {r.chatLines} chat line{r.chatLines === 1 ? '' : 's'}. Chat is not shown or logged here. Updates every 3 seconds.</p>
    </div>
  )
}

function PersonPanel({ vid, s }: { vid: string; s: Shared }) {
  const load = useCallback(() => api.person(vid), [vid])
  const [p, err, pull] = usePoll<Person>(load, 10_000, s)
  const [busy, setBusy] = useState(false)
  const [openLine, setOpenLine] = useState<number | null>(null)
  const act = async (a: 'test' | 'untest' | 'block' | 'unblock', done: string, extra: { name?: string; note?: string } = {}) => {
    setBusy(true)
    try { await api.personAct(vid, a, extra); s.toast(done); await pull() } catch (e) { if (e instanceof SignedOut) s.signedOut(); else s.toast(e instanceof Error ? e.message : 'That did not work', 'err') } finally { setBusy(false) }
  }
  const forget = async () => {
    if (!confirm(`Delete everything the site keeps under browser ${vid} (visits, rooms, feedback and log lines)? This cannot be undone.`)) return
    setBusy(true)
    try { const r = await api.forgetBrowser(vid); s.toast(`Deleted ${r.deleted} record${r.deleted === 1 ? '' : 's'}`); await pull() } catch (e) { s.toast(e instanceof Error ? e.message : 'Could not delete', 'err') } finally { setBusy(false) }
  }
  if (!p) return <div class="d-panel">{err ? <p class="d-note is-err" role="alert">{err}</p> : <div class="d-ghost d-panel-ghost" aria-busy="true" />}</div>
  const name = p.names[0]
  return (
    <div class="d-panel">
      <header class="d-panel-head">
        <span class="d-kicker">Browser</span>
        <h2 class="d-panel-title">{name ?? 'No name in the last 7 days'}</h2>
        <p class="d-panel-sub"><code>{vid}</code> <button type="button" class="d-link" onClick={() => copy(vid, s)}>copy</button></p>
        <div class="d-flags">
          {p.x && <span class="d-tag">Test browser: left out of the counts</span>}
          {p.blocked && <span class="d-tag is-bad">Blocked from every room{p.blocked.note ? `: ${p.blocked.note}` : ''}</span>}
        </div>
      </header>
      <Section title="Last 7 days">
        <dl class="d-kv">
          <div><dt>Names used</dt><dd>{p.names.length ? p.names.join(', ') : '—'}</dd></div>
          <div><dt>Rooms</dt><dd>{p.rooms.length}{p.rooms.length >= 30 ? '+' : ''}</dd></div>
        </dl>
        <p class="d-fine">Only what acting on a report needs. Visits, where they came from and anything older are not shown here.</p>
      </Section>
      <Section title="Do something">
        <div class="d-row">
          {p.blocked
            ? <button type="button" class="d-btn is-ghost" disabled={busy} onClick={() => act('unblock', 'Unblocked: they can join rooms again')}>Unblock</button>
            : <button type="button" class="d-btn is-danger" disabled={busy} onClick={() => { const note = prompt('Block this browser from every room? A note for yourself (why):', ''); if (note !== null) void act('block', 'Blocked from every room', { name: name ?? '', note }) }}>Block from every room</button>}
          {p.x
            ? <button type="button" class="d-btn is-ghost" disabled={busy} onClick={() => act('untest', 'This browser counts again')}>Count it again</button>
            : <button type="button" class="d-btn is-ghost" disabled={busy} onClick={() => act('test', 'Marked as a test browser: left out of every count')}>Mark as a test browser</button>}
          <a class="d-btn is-ghost" href={`#/logs?vid=${vid}&tests=1`}>All its lines</a>
          <button type="button" class="d-btn is-ghost" disabled={busy} onClick={forget}>Delete its data</button>
        </div>
        <p class="d-fine">Blocking keeps out this browser only: someone can come back from another browser or a private tab. Pair it with a room ban when it matters.</p>
      </Section>
      {p.rooms.length > 0 && (
        <Section title="Rooms">
          <ul class="d-hist">{p.rooms.map(r => <li key={r.rid}><span>{r.code ? <button type="button" class="d-link" onClick={() => s.open({ kind: 'room', code: r.code! })}><code>{r.code}</code></button> : '—'}{r.made ? <span class="d-tag">made it</span> : null}</span><small>{r.games} game{r.games === 1 ? '' : 's'} · joined {when(r.joined)}</small></li>)}</ul>
          <p class="d-fine">Room codes are used again once a room closes; a closed room says so when opened.</p>
        </Section>
      )}
      <Section title="Latest lines" note={`${p.lines.length} shown`}>
        {p.lines.length ? <ul class="d-log is-compact">{p.lines.map(l => <LogRow key={l.id} l={l} s={s} open={openLine === l.id} onToggle={() => setOpenLine(openLine === l.id ? null : l.id)} />)}</ul> : <p class="d-empty">No lines in the last 7 days.</p>}
      </Section>
    </div>
  )
}
