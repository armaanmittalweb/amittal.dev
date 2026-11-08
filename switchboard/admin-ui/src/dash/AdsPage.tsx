import { useEffect, useState } from 'preact/hooks'
import { api, SignedOut, type AdsConfig, type AdsReport, type AdTot } from '../api'
import { num } from '../format'
import { DayLines, Tile } from './charts'
import type { Shared } from './Dash'
import { Card } from './pages'

// The box ads: the master switch first (off until AdSense approves chaotictails.com), each place, the room split, the
// AdSense ids, then what the boxes did. Saved straight to the site; pages pick a change up within a minute.

const usd = (x: number) => (x >= 100 ? `$${num(x)}` : `$${x.toFixed(2)}`)
const rate = (n: number, d: number, dp = 0) => (d ? `${((n / d) * 100).toFixed(dp)}%` : '—')

export function Toggle({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} class={`d-switch ${on ? 'is-on' : ''}`} disabled={disabled} onClick={() => onChange(!on)}>
      <span class="d-switch-knob" /><span class="d-switch-text">{on ? 'On' : 'Off'}</span>
    </button>
  )
}

const MODES: { value: AdsConfig['mode']; label: string; help: string }[] = [
  { value: 'off', label: 'Off', help: 'No ad boxes anywhere. The page layout has no gaps where they would go.' },
  { value: 'test', label: 'Test', help: 'Real AdSense boxes marked as tests: no earnings, nothing counted against the site. Use after approval to check them.' },
  { value: 'live', label: 'Live', help: 'Real ads, for everyone, where the places below allow.' },
]

export function AdsPage(s: Shared) {
  const [data, setData] = useState<AdsReport | null>(null)
  const [c, setC] = useState<AdsConfig | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const days = s.days

  useEffect(() => {
    let stale = false
    api.ads(days).then(r => { if (!stale) { setData(r); setC(r.ads.config) } }).catch(e => { if (e instanceof SignedOut) s.signedOut(); else if (!stale) setErr(e.message) })
    return () => { stale = true }
  }, [days])

  const save = async (next: Partial<AdsConfig>, ask?: string) => {
    if (!c || (ask && !confirm(ask))) return
    setBusy(true)
    try {
      const r = await api.adsConfig({ ...c, ...next })
      setC(r)
      s.reload()
      s.toast(r.mode === next.mode || next.mode === undefined ? 'Saved. Pages pick it up within a minute.' : `Saved, but ads stay ${r.mode}: a publisher id is needed first.`)
    } catch (e) { s.toast(e instanceof Error ? e.message : 'Could not save', 'err') } finally { setBusy(false) }
  }

  if (err) return <div class="d-card is-wide"><p class="d-note is-err">{err}</p></div>
  if (!data || !c) return <div class="d-grid" aria-busy="true"><div class="d-card is-wide d-ghost" /></div>
  const t: AdTot = data.ads.total
  const places = Object.entries(data.ads.places)
  const mode = MODES.find(m => m.value === c.mode)!

  return (
    <div class="d-grid">
      <section class={`d-card is-wide d-hero-switch is-${c.mode}`} aria-labelledby="ads-mode-h">
        <div>
          <span class="d-kicker">Ads on chaotictails.com</span>
          <h2 id="ads-mode-h">{c.mode === 'off' ? 'Ads are off' : c.mode === 'test' ? 'Test ads are on' : 'Ads are live'}</h2>
          <p>{mode.help}</p>
        </div>
        <div class="d-bigseg" role="radiogroup" aria-label="Ads">
          {MODES.map(m => (
            <button key={m.value} type="button" role="radio" aria-checked={c.mode === m.value} class={c.mode === m.value ? 'is-on' : ''} disabled={busy}
              onClick={() => c.mode !== m.value && void save({ mode: m.value }, m.value === 'live' ? 'Turn live ads on for everyone? Only do this after AdSense has approved chaotictails.com.' : undefined)}>{m.label}</button>
          ))}
        </div>
      </section>

      <Card title="Where boxes may show" sub="Each place on its own. Boxes never show during a round someone is playing.">
        <ul class="d-toggles">{places.map(([k, p]) => (
          <li key={k}><span>{p.label}<small>{p.phase === 1 ? 'Nobody is playing here' : 'Waiting or watching'}</small></span>
            <Toggle on={!c.off.includes(k)} label={`Ads: ${p.label}`} disabled={busy} onChange={v => void save({ off: v ? c.off.filter(x => x !== k) : [...c.off, k] })} /></li>
        ))}</ul>
      </Card>

      <Card title="Rules">
        <ul class="d-toggles">
          <li><span>No ads in a host's first room<small>A new host's first night stays clean</small></span><Toggle on={c.firstNightFree} label="No ads in a host's first room" disabled={busy} onChange={v => void save({ firstNightFree: v })} /></li>
        </ul>
        <form class="d-form" onSubmit={e => { e.preventDefault(); void save({ split: c.split, ecpm: c.ecpm }) }}>
          <label class="d-field"><span>Rooms with ads (%)</span><input type="number" min={0} max={100} value={c.split} onInput={e => setC({ ...c, split: Number((e.target as HTMLInputElement).value) })} /></label>
          <label class="d-field"><span>Estimate, $ per 1,000 · India</span><input type="number" step="0.05" min={0} value={c.ecpm.in} onInput={e => setC({ ...c, ecpm: { ...c.ecpm, in: Number((e.target as HTMLInputElement).value) } })} /></label>
          <label class="d-field"><span>Estimate, $ per 1,000 · elsewhere</span><input type="number" step="0.1" min={0} value={c.ecpm.other} onInput={e => setC({ ...c, ecpm: { ...c.ecpm, other: Number((e.target as HTMLInputElement).value) } })} /></label>
          <button type="submit" class="d-btn" disabled={busy}>Save</button>
        </form>
        <p class="d-fine">Under 100%, the other rooms (picked by room code) get no boxes, so you can compare how long rooms with and without ads keep playing.</p>
      </Card>

      <Card title="AdSense ids" sub="From AdSense › Ads › By ad unit">
        <form class="d-form" onSubmit={e => { e.preventDefault(); void save({ client: c.client, units: c.units }) }}>
          <label class="d-field"><span>Publisher id</span><input value={c.client} placeholder="ca-pub-1234567890123456" onInput={e => setC({ ...c, client: (e.target as HTMLInputElement).value.trim() })} /></label>
          {([['box', 'Box, 300×250'], ['large', 'Large box, 336×280'], ['tall', 'Side box, 300×600']] as const).map(([k, l]) => (
            <label key={k} class="d-field"><span>{l}</span><input value={c.units[k]} inputMode="numeric" placeholder="digits" onInput={e => setC({ ...c, units: { ...c.units, [k]: (e.target as HTMLInputElement).value.trim() } })} /></label>
          ))}
          <button type="submit" class="d-btn" disabled={busy}>Save ids</button>
        </form>
      </Card>

      <div class="d-tiles is-wide">
        <Tile label="Boxes asked for" value={num(t.req)} sub={`${rate(t.fill, t.req)} filled`} />
        <Tile label="Seen" value={num(t.view)} sub={`${rate(t.view, t.fill)} of filled boxes`} />
        <Tile label="Clicks" value={num(t.click)} sub={`${rate(t.click, t.view, 2)} of seen`} />
        <Tile label="Estimate" value={usd(t.usd)} sub={data.adsense.connected && 'total' in data.adsense ? `AdSense says ${data.adsense.total.earnings.toFixed(2)} ${data.adsense.currency}` : 'AdSense not connected'} />
      </div>
      <Card title="Boxes per day" wide>
        <DayLines rows={data.ads.series as unknown as ({ day: string } & Record<string, number>)[]} keys={[{ key: 'fill', label: 'Filled', color: 's1' }, { key: 'view', label: 'Seen', color: 's2' }]} height={180} />
      </Card>
      <Card title="By place" wide>
        {data.ads.byPlace.length ? (
          <div class="d-table-wrap"><table class="d-table">
            <thead><tr><th scope="col">Place</th><th scope="col">Asked</th><th scope="col">Filled</th><th scope="col">Seen</th><th scope="col">Clicks</th><th scope="col">Estimate</th></tr></thead>
            <tbody>{data.ads.byPlace.map(r => <tr key={r.key}><th scope="row">{r.label}</th><td>{num(r.req)}</td><td>{num(r.fill)} · {rate(r.fill, r.req)}</td><td>{num(r.view)}</td><td>{num(r.click)}</td><td>{usd(r.usd)}</td></tr>)}</tbody>
          </table></div>
        ) : <p class="d-empty">No boxes yet: ads are {c.mode}.</p>}
      </Card>
    </div>
  )
}
