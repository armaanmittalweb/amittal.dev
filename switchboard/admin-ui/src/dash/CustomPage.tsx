import { useEffect, useMemo, useState } from 'preact/hooks'
import { api, SignedOut, type CustomRow, type CustomSettings, type RoomSwitches } from '../api'
import { ago } from '../format'
import { Toggle } from './AdsPage'
import type { Shared } from './Dash'
import { GAME_NAMES, gameName } from './Panels'
import { Card } from './pages'

// Custom rooms (games repo src/custom.ts): a room made for someone (a friend's office, a college fest, a family
// wedding) with its own code, name, note, player limit, games and switches, and a private host link. Any room that is
// open can be given the same powers, and every setting can be changed while it is open.

type Form = {
  code: string; title: string; note: string; label: string; max: number; days: number; all: boolean; games: string[]
  clean: boolean; adFree: boolean; locked: boolean; ask: boolean; relaxed: boolean; quick: boolean; watch: boolean
}
const BLANK: Form = { code: '', title: '', note: '', label: '', max: 30, days: 7, all: true, games: [], clean: false, adFree: true, locked: false, ask: false, relaxed: false, quick: false, watch: true }
const DAYS = [1, 3, 7, 14, 30, 60]
const SWITCHES: { k: keyof Form; title: string; sub: string }[] = [
  { k: 'clean', title: 'Clean only', sub: 'No 18+ nights or settings. For offices, schools and families.' },
  { k: 'adFree', title: 'No ads', sub: 'No box ads in this room, whatever the site’s ad settings.' },
  { k: 'locked', title: 'Locked', sub: 'Nobody can join except with the host link. Unlock it once the host is in.' },
  { k: 'ask', title: 'Ask at the door', sub: 'The host lets each new person in. The host link skips the door.' },
  { k: 'relaxed', title: 'More time', sub: 'Every clock runs half as long again. Good for people new to the games.' },
  { k: 'quick', title: 'Skip the rules', sub: 'Games start straight away, without the rules screen.' },
  { k: 'watch', title: 'Let people watch', sub: 'Someone who comes in mid-game can follow it live.' },
]
const codeOk = (c: string) => /^[A-Z0-9]{5}$/.test(c)
const links = (site: string, code: string, key?: string) => ({ room: `${site}/r/${code}`, host: key ? `${site}/r/${code}?host=${key}` : '', tv: `${site}/tv/${code}` })

export function CustomPage(s: Shared) {
  const [list, setList] = useState<CustomRow[] | null>(null)
  const [site, setSite] = useState('https://chaotictails.com')
  const [err, setErr] = useState<string | null>(null)
  const [f, setF] = useState<Form>(BLANK)
  // Editing an open room (its code), or making a new one (null).
  const [editing, setEditing] = useState<string | null>(null)
  const [made, setMade] = useState<{ code: string; key: string; title: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [lookup, setLookup] = useState('')
  const [catalog, setCatalog] = useState<Record<string, string>>({})
  const names = useMemo(() => ({ ...GAME_NAMES, ...(s.games?.names ?? {}), ...catalog }), [s.games, catalog])
  const nameOf = (id: string | null | undefined) => (id ? names[id] ?? gameName(id) : '')
  const ids = Object.keys(names).filter(id => id !== 'cocktail').sort((a, b) => names[a].localeCompare(names[b]))
  const set = (patch: Partial<Form>) => setF(x => ({ ...x, ...patch }))

  const load = async () => {
    try { const r = await api.customs(); setList(r.rooms); setSite(r.site); if (r.games) setCatalog(Object.fromEntries(r.games.map(g => [g.id, g.name]))); setErr(null) } catch (e) { if (e instanceof SignedOut) s.signedOut(); else setErr(e instanceof Error ? e.message : 'Could not read the list') }
  }
  useEffect(() => { void load() }, [])
  // #/custom?code=ABCDE (from a room's panel): open that room's settings.
  useEffect(() => {
    const code = new URLSearchParams(location.hash.split('?')[1] ?? '').get('code')
    if (code) void edit(code.toUpperCase())
  }, [])

  /** Loads an open room's settings (or its switches, for a room that has none yet) into the form. */
  const edit = async (code: string) => {
    if (!codeOk(code)) return s.toast('A room code is 5 letters or numbers', 'err')
    setBusy('load')
    try {
      const { room } = await api.room(code)
      const c = room.custom
      setF({
        code, title: c?.title ?? '', note: c?.note ?? '', label: c?.label ?? '', max: c?.max ?? 30, days: c?.days ?? 7,
        all: !c?.games.length, games: c?.games ?? [], clean: c?.clean ?? false, adFree: c?.adFree ?? room.adFree,
        locked: room.locked, ask: room.ask, relaxed: room.relaxed, quick: room.quick, watch: room.watch,
      })
      setEditing(code)
      setMade(c ? { code, key: c.key, title: c.title } : null)
      document.getElementById('cr-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (e) { s.toast(e instanceof Error ? e.message : `Could not open room ${code}`, 'err') } finally { setBusy(null) }
  }

  const settings = (): Partial<CustomSettings> => ({ title: f.title, note: f.note, label: f.label, max: f.max, days: f.days, games: f.all ? [] : f.games, clean: f.clean, adFree: f.adFree })
  const switches = (): RoomSwitches => ({ locked: f.locked, ask: f.ask, relaxed: f.relaxed, quick: f.quick, watch: f.watch })
  const submit = async (e: Event) => {
    e.preventDefault()
    if (!f.all && !f.games.length) return s.toast('Pick at least one game, or turn on Every game', 'err')
    const code = f.code.trim().toUpperCase()
    if (code && !codeOk(code)) return s.toast('A room code is 5 letters or numbers, like ACME1', 'err')
    setBusy('save')
    try {
      if (editing) {
        const r = await api.roomAct(editing, { a: 'custom', custom: settings(), switches: switches() })
        const c = r.room?.custom
        setMade(c ? { code: editing, key: c.key, title: c.title } : null)
        s.toast(`Room ${editing} updated. Everyone in it sees the change now.`)
      } else {
        const r = await api.customMake({ code: code || undefined, custom: settings(), switches: switches() })
        setMade({ code: r.code, key: r.key, title: r.custom.title })
        setSite(r.site)
        setEditing(r.code)
        set({ code: r.code })
        s.toast(`Room ${r.code} is ready. Send the host link to whoever runs it.`)
      }
      await load()
    } catch (err) { s.toast(err instanceof Error ? err.message : 'Could not save', 'err') } finally { setBusy(null) }
  }
  const fresh = () => { setF(BLANK); setEditing(null); setMade(null) }
  const copy = (text: string, what: string) => { navigator.clipboard?.writeText(text).then(() => s.toast(`${what} copied`), () => s.toast(text)) }
  const message = (code: string, key: string, title: string) => {
    const l = links(site, code, key)
    return `${title || 'Your game room'} is ready on Chaotic Tails.\n\nYou run it: open this host link first (keep it to yourself):\n${l.host}\n\nThen send everyone this link to join:\n${l.room}\n\nOn a TV or projector, open:\n${l.tv}`
  }
  const newKey = async (code: string) => {
    if (!confirm(`Make a new host link for ${code}? The old one stops working. Whoever is host now stays host.`)) return
    setBusy('key')
    try {
      const r = await api.roomAct(code, { a: 'custom', custom: { newKey: true } })
      const c = r.room?.custom
      if (c && editing === code) setMade({ code, key: c.key, title: c.title })
      s.toast('New host link made. Copy it from the list.')
      await load()
    } catch (e) { s.toast(e instanceof Error ? e.message : 'Could not do that', 'err') } finally { setBusy(null) }
  }
  const takeOff = async (code: string) => {
    if (!confirm(`Take the custom settings off room ${code}? It becomes a normal room: every game, 30 players, closes a day after its last use. The host link stops working.`)) return
    setBusy('off')
    try { await api.roomAct(code, { a: 'custom', custom: null }); s.toast(`Room ${code} is a normal room again`); if (editing === code) fresh(); await load() } catch (e) { s.toast(e instanceof Error ? e.message : 'Could not do that', 'err') } finally { setBusy(null) }
  }
  const close = async (code: string) => {
    if (!confirm(`Close room ${code}? Everyone in it is sent out and the room is deleted. This cannot be undone.`)) return
    setBusy('close')
    try { await api.roomAct(code, { a: 'close' }); s.toast(`Room ${code} is closed`); if (editing === code) fresh(); await load() } catch (e) { s.toast(e instanceof Error ? e.message : 'Could not close it', 'err') } finally { setBusy(null) }
  }
  const drop = async (code: string) => {
    setBusy('drop')
    try { await api.customDrop(code); await load() } catch (e) { s.toast(e instanceof Error ? e.message : 'Could not do that', 'err') } finally { setBusy(null) }
  }

  const code = f.code.trim().toUpperCase()
  return (
    <div class="d-grid">
      <Card wide id="cr-form" title={editing ? `Room ${editing}` : 'Make a custom room'}
        sub={editing ? 'Change anything below. Players in the room see it at once.' : 'For a friend’s office, a college fest or a family function: its own code, name, limits and games, and a host link for whoever runs it.'}
        actions={editing ? <button type="button" class="d-btn is-ghost is-sm" onClick={fresh}>Make a new one instead</button> : undefined}>
        <form class="d-form cr-form" onSubmit={submit}>
          <div class="cr-cols">
            <label class="d-field"><span>Room code <small>{editing ? 'fixed' : 'optional'}</small></span>
              <input value={f.code} maxLength={5} disabled={!!editing} placeholder="e.g. ACME1 (empty: picked for you)" autoCapitalize="characters" spellcheck={false}
                aria-invalid={code !== '' && !codeOk(code)} onInput={e => set({ code: (e.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
              {code !== '' && !codeOk(code) && !editing && <small class="cr-bad">5 letters or numbers</small>}
            </label>
            <label class="d-field"><span>Who it is for <small>only you see this</small></span>
              <input value={f.label} maxLength={60} placeholder="e.g. Rohan’s office, Infosys Pune" onInput={e => set({ label: (e.target as HTMLInputElement).value })} />
            </label>
            <label class="d-field"><span>Name in the room <small>{f.title.length}/40</small></span>
              <input value={f.title} maxLength={40} placeholder="e.g. Acme team game night" onInput={e => set({ title: (e.target as HTMLInputElement).value })} />
            </label>
            <label class="d-field"><span>Note in the lobby <small>{f.note.length}/200</small></span>
              <input value={f.note} maxLength={200} placeholder="e.g. Lunch break games, 1 to 2 pm" onInput={e => set({ note: (e.target as HTMLInputElement).value })} />
            </label>
            <label class="d-field"><span>Most players <small>2 to 50</small></span>
              <input type="number" min={2} max={50} value={f.max} onInput={e => set({ max: Math.max(2, Math.min(50, Number((e.target as HTMLInputElement).value) || 2)) })} />
            </label>
            <label class="d-field"><span>Stays open without use</span>
              <select value={f.days} onChange={e => set({ days: Number((e.target as HTMLSelectElement).value) })}>{DAYS.map(d => <option key={d} value={d}>{d === 1 ? '1 day (like any room)' : `${d} days`}</option>)}</select>
            </label>
          </div>

          <fieldset class="cr-games">
            <legend>Games</legend>
            <div class="d-toggle-row"><div><b>Every game</b><p class="d-fine">{f.all ? 'The room plays everything on the site.' : `Only the ${f.games.length} picked below. Game nights use only these too.`}</p></div>
              <Toggle on={f.all} label="Every game" onChange={v => set({ all: v })} /></div>
            {!f.all && (
              <>
                <div class="d-row"><button type="button" class="d-btn is-ghost is-sm" onClick={() => set({ games: ids })}>All</button><button type="button" class="d-btn is-ghost is-sm" onClick={() => set({ games: [] })}>None</button></div>
                <ul class="cr-picks">{ids.map(id => {
                  const on = f.games.includes(id)
                  return <li key={id}><button type="button" aria-pressed={on} class={on ? 'is-on' : ''} onClick={() => set({ games: on ? f.games.filter(x => x !== id) : [...f.games, id] })}>{names[id]}</button></li>
                })}</ul>
              </>
            )}
          </fieldset>

          <ul class="d-toggles cr-switches">{SWITCHES.map(w => (
            <li key={w.k}><span><b>{w.title}</b><small>{w.sub}</small></span><Toggle on={!!f[w.k]} label={w.title} onChange={v => set({ [w.k]: v } as Partial<Form>)} /></li>
          ))}</ul>

          <div class="d-row">
            <button type="submit" class="d-btn d-btn-big" disabled={!!busy}>{busy === 'save' ? 'Saving…' : editing ? 'Save changes' : 'Make the room'}</button>
            {editing && <button type="button" class="d-btn is-ghost" disabled={!!busy} onClick={() => s.open({ kind: 'room', code: editing })}>Open its panel</button>}
          </div>
        </form>

        {made && (
          <div class="cr-made" role="status">
            <h3>{made.title || `Room ${made.code}`} <span class="cr-code">{made.code}</span></h3>
            <ul class="cr-links">
              {([['Host link', links(site, made.code, made.key).host, 'Only for whoever runs the room. Opening it makes them host, even if the room is locked or full.'],
                ['Room link', links(site, made.code).room, 'For everyone else. They type a name and they are in.'],
                ['TV link', links(site, made.code).tv, 'Open on a TV, laptop or projector everyone can see.']] as const).map(([what, url, how]) => (
                <li key={what}><div><b>{what}</b><code>{url}</code><small>{how}</small></div><button type="button" class="d-btn is-ghost is-sm" onClick={() => copy(url, what)}>Copy</button></li>
              ))}
            </ul>
            <div class="d-row"><button type="button" class="d-btn" onClick={() => copy(message(made.code, made.key, made.title), 'Message with all three links')}>Copy a message for WhatsApp</button></div>
          </div>
        )}
      </Card>

      <Card title="Give powers to a room that is open" sub="Any room: raise its player limit, keep it open longer, name it, pick its games." id="cr-lookup">
        <form class="d-form" onSubmit={e => { e.preventDefault(); void edit(lookup.trim().toUpperCase()) }}>
          <label class="d-field"><span>Room code</span><input value={lookup} maxLength={5} placeholder="ABCDE" autoCapitalize="characters" onInput={e => setLookup((e.target as HTMLInputElement).value.toUpperCase())} /></label>
          <button type="submit" class="d-btn" disabled={!!busy || !codeOk(lookup.trim().toUpperCase())}>{busy === 'load' ? 'Opening…' : 'Open its settings'}</button>
        </form>
      </Card>

      <Card wide title="Custom rooms" sub="Every room made or changed here, newest first" id="cr-list" actions={<button type="button" class="d-btn is-ghost is-sm" onClick={() => void load()}>Refresh</button>}>
        {err && <p class="d-note is-err" role="alert">{err}</p>}
        {!list ? <p class="d-empty">Loading…</p> : !list.length ? <p class="d-empty">None yet. Make one above.</p> : (
          <ul class="cr-list">{list.map(r => (
            <li key={r.code} class={r.open ? '' : 'is-closed'}>
              <div class="cr-main">
                <b>{r.title || 'No name'} <span class="cr-code">{r.code}</span></b>
                <small>{[r.label, r.open ? (r.room?.here ? `${r.room.here} here now${r.room.host ? `, ${r.room.host} hosting` : ''}${r.room.phase === 'game' && r.room.game ? `, playing ${nameOf(r.room.game)}` : ''}` : 'open, nobody in') : 'closed',
                  r.open ? `up to ${r.max} players` : null, r.open ? (r.games?.length ? `${r.games.length} games` : 'every game') : null, r.clean ? 'clean' : null, r.open && r.days ? `stays ${r.days} days` : null, `made ${ago(r.made)}`].filter(Boolean).join(' · ')}</small>
              </div>
              <div class="cr-act">
                {r.open ? <>
                  {r.key && <button type="button" class="d-btn is-ghost is-sm" onClick={() => copy(message(r.code, r.key!, r.title ?? ''), 'Message with the links')}>Copy links</button>}
                  <button type="button" class="d-btn is-ghost is-sm" disabled={!!busy} onClick={() => void edit(r.code)}>Edit</button>
                  <button type="button" class="d-btn is-ghost is-sm" onClick={() => s.open({ kind: 'room', code: r.code })}>Panel</button>
                  <button type="button" class="d-btn is-ghost is-sm" disabled={!!busy} onClick={() => void newKey(r.code)}>New host link</button>
                  <button type="button" class="d-btn is-ghost is-sm" disabled={!!busy} onClick={() => void takeOff(r.code)}>Make it normal</button>
                  <button type="button" class="d-btn is-danger is-sm" disabled={!!busy} onClick={() => void close(r.code)}>Close</button>
                </> : <button type="button" class="d-btn is-ghost is-sm" disabled={!!busy} onClick={() => void drop(r.code)}>Remove from the list</button>}
              </div>
            </li>
          ))}</ul>
        )}
        <p class="d-fine">A custom room closes by itself once nobody has used it for as long as it stays open. Its code is free again after that.</p>
      </Card>
    </div>
  )
}
