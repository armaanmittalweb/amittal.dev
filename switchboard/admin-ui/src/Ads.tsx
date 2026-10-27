import { useEffect, useState } from 'preact/hooks'
import { api, SignedOut, type AdsConfig, type AdsReport, type AdTot } from './api'
import { compact, num, shortDay, weekday } from './format'
import { Panel, Segmented, Stat } from './ui'

// Game Night's box ads: what the site asked for, got and showed, what that is likely worth, and AdSense's own figure
// once it is connected. The settings at the foot turn the ads, or any one place, on and off without a deploy.

const INR = 88 // rupees to the dollar, for the estimate only
const pc = (n: number, d: number, dp = 0) => (d ? `${((n / d) * 100).toFixed(dp)}%` : '—')
const usd = (x: number) => (x >= 100 ? `$${num(x)}` : `$${x.toFixed(2)}`)
const inr = (x: number) => { const r = x * INR; return r >= 1e5 ? `₹${(r / 1e5).toFixed(2)} lakh` : `₹${num(r)}` }
const money = (x: number, cur: string) => (cur === 'INR' ? `₹${num(x)}` : cur ? `${x.toFixed(2)} ${cur}` : x.toFixed(2))

type Metric = 'fill' | 'view' | 'click' | 'usd'
const METRICS: { value: Metric; label: string }[] = [{ value: 'fill', label: 'Filled' }, { value: 'view', label: 'Seen' }, { value: 'click', label: 'Clicks' }, { value: 'usd', label: 'Est. revenue' }]

function Trend({ series }: { series: AdsReport['ads']['series'] }) {
  const [metric, setMetric] = useState<Metric>('fill')
  const [pick, setPick] = useState<number | null>(null)
  const n = series.length
  if (!n) return <p class="empty">No days in range.</p>
  const max = Math.max(metric === 'usd' ? 0.01 : 1, ...series.map(d => d[metric]))
  const at = pick ?? n - 1
  const d = series[at]
  const move = (e: PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPick(Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n))))
  }
  return (
    <div class="chart">
      <div class="toolbar"><Segmented label="Measure" value={metric} options={METRICS} onChange={setMetric} /></div>
      <div class="chart-readout" aria-live="polite">
        <span class="chart-day">{weekday(d.day)} {shortDay(d.day)}</span>
        <span><b>{num(d.req)}</b> asked</span><span><b>{num(d.fill)}</b> filled</span><span><b>{num(d.view)}</b> seen</span>
        <span><b>{num(d.click)}</b> clicks</span><span><b>{usd(d.usd)}</b> · {inr(d.usd)} est.</span>
      </div>
      <div class="chart-plot" tabIndex={0} role="group" aria-label="Per day" onPointerMove={move} onPointerLeave={() => setPick(null)}>
        <svg viewBox={`0 0 ${n * 10} 100`} preserveAspectRatio="none" aria-hidden="true">
          {[25, 50, 75].map(y => <line key={y} class="chart-grid" x1="0" x2={n * 10} y1={y} y2={y} vector-effect="non-scaling-stroke" />)}
          {series.map((s, i) => <rect key={s.day} class={`chart-bar ${i === at ? 'is-on' : ''}`} x={i * 10 + 1.5} width="7" y={100 - (s[metric] / max) * 92} height={(s[metric] / max) * 92 + 0.01} />)}
        </svg>
        <div class="chart-max">{metric === 'usd' ? usd(max) : compact(max)}</div>
      </div>
      <div class="chart-axis" aria-hidden="true"><span>{shortDay(series[0].day)}</span><span>{shortDay(series[Math.floor((n - 1) / 2)].day)}</span><span>{shortDay(series[n - 1].day)}</span></div>
    </div>
  )
}

/** A breakdown: asked, filled, fill rate, seen, clicks, CTR and the estimate, per row. */
function Breakdown({ rows, first, extra }: { rows: (AdTot & { key: string; label: string })[]; first: string; extra?: (key: string) => preact.ComponentChildren }) {
  if (!rows.length) return <p class="empty">Nothing counted yet.</p>
  return (
    <div class="table-wrap"><table class="gn-table">
      <thead><tr><th>{first}</th><th>Asked</th><th>Filled</th><th>Fill</th><th>Seen</th><th>Clicks</th><th>CTR</th><th>Est.</th>{extra && <th />}</tr></thead>
      <tbody>{rows.map(r => (
        <tr key={r.key}><td>{r.label}</td><td>{num(r.req)}</td><td>{num(r.fill)}</td><td>{pc(r.fill, r.req)}</td><td>{pc(r.view, r.fill)}</td>
          <td>{num(r.click)}</td><td>{pc(r.click, r.view, 2)}</td><td>{usd(r.usd)}</td>{extra && <td>{extra(r.key)}</td>}</tr>
      ))}</tbody>
    </table></div>
  )
}

function Switch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} class={`switch ${on ? 'is-on' : ''}`} disabled={disabled} onClick={() => onChange(!on)}><span class="switch-knob" /></button>
}

/** The settings: saved to Game Night at once, so they take effect within a minute (the pages cache them for 60 s). */
function Settings({ cfg, places, onSaved }: { cfg: AdsConfig; places: AdsReport['ads']['places']; onSaved: (c: AdsConfig) => void }) {
  const [c, setC] = useState(cfg)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => setC(cfg), [cfg])
  const save = async (next: Partial<AdsConfig>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return
    setBusy(true)
    try { const r = await api.adsConfig({ ...c, ...next }); setC(r); onSaved(r); setMsg('Saved. Pages pick it up within a minute.') } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not save') } finally { setBusy(false) }
  }
  const field = (k: keyof AdsConfig['units'], label: string) => (
    <label>{label}<input value={c.units[k]} inputMode="numeric" placeholder="ad unit id, digits" onInput={e => setC({ ...c, units: { ...c.units, [k]: (e.target as HTMLInputElement).value.trim() } })} /></label>
  )
  const modes: { value: AdsConfig['mode']; label: string }[] = [{ value: 'off', label: 'Off' }, { value: 'test', label: 'Test ads' }, { value: 'live', label: 'Live' }]
  return (
    <Panel title="Settings" kicker={cfg.updated ? `SAVED ${new Date(cfg.updated).toLocaleString('en-IN')}` : 'NOT SAVED YET'} id="ads-settings">
      <div class="ads-set">
        <div class="ads-row"><span>Ads on the site</span>
          <Segmented label="Ads on the site" value={c.mode} options={modes} onChange={m => void save({ mode: m }, m === 'live' ? 'Turn live ads on for everyone?' : undefined)} /></div>
        <p class="fine">Test ads: real AdSense boxes marked as tests (no earnings, no invalid-click risk), to check the site after approval. Off until a publisher id is saved.</p>
        <form class="ads-ids" onSubmit={e => { e.preventDefault(); void save({ client: c.client, units: c.units }) }}>
          <label>Publisher id<input value={c.client} placeholder="ca-pub-1234567890123456" onInput={e => setC({ ...c, client: (e.target as HTMLInputElement).value.trim() })} /></label>
          {field('box', 'Box unit (300×250)')}{field('large', 'Large box unit (336×280)')}{field('tall', 'Side box unit (300×600)')}
          <button type="submit" disabled={busy}>Save ids</button>
        </form>
        <div class="ads-row"><span>No ads in a host's first room</span><Switch on={c.firstNightFree} label="No ads in a host's first room" disabled={busy} onChange={v => void save({ firstNightFree: v })} /></div>
        <form class="ads-ids" onSubmit={e => { e.preventDefault(); void save({ split: c.split, ecpm: c.ecpm }) }}>
          <label>Rooms with ads (%)<input type="number" min={0} max={100} value={c.split} onInput={e => setC({ ...c, split: Number((e.target as HTMLInputElement).value) })} /></label>
          <label>Est. $ per 1,000 · India<input type="number" step="0.05" min={0} value={c.ecpm.in} onInput={e => setC({ ...c, ecpm: { ...c.ecpm, in: Number((e.target as HTMLInputElement).value) } })} /></label>
          <label>Est. $ per 1,000 · elsewhere<input type="number" step="0.1" min={0} value={c.ecpm.other} onInput={e => setC({ ...c, ecpm: { ...c.ecpm, other: Number((e.target as HTMLInputElement).value) } })} /></label>
          <button type="submit" disabled={busy}>Save</button>
        </form>
        <p class="fine">Rooms with ads below 100% leaves the rest of the rooms (picked by room code) without them, so the panel above can compare the two. Pages outside rooms always show their boxes while ads are on. Put your real AdSense page RPM into the rates once a month of data is in.</p>
        <h3 class="ads-h">Places</h3>
        <ul class="ads-places">{Object.entries(places).map(([k, p]) => {
          const on = !c.off.includes(k)
          return <li key={k}><span>{p.label}<small> · phase {p.phase}</small></span><Switch on={on} label={`Ads: ${p.label}`} disabled={busy} onChange={v => void save({ off: v ? c.off.filter(x => x !== k) : [...c.off, k] })} /></li>
        })}</ul>
      </div>
      {msg && <p class="fine" role="status">{msg}</p>}
    </Panel>
  )
}

export function Ads({ onSignedOut }: { onSignedOut: () => void }) {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<AdsReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let stale = false
    setError(null)
    api.ads(days).then(r => { if (!stale) setData(r) }).catch(e => {
      if (e instanceof SignedOut) onSignedOut()
      else if (!stale) setError(e.message)
    })
    return () => { stale = true }
  }, [days, tick, onSignedOut])

  const range = [{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' }]
  if (!data) {
    return (
      <div class="gn stack">
        <div class="toolbar"><Segmented label="Range" value={days} options={range} onChange={setDays} /></div>
        {error ? <p class="notice is-err" role="alert">{error} <button type="button" class="link-btn" onClick={() => setTick(t => t + 1)}>Try again</button></p> : <div class="loading" aria-busy="true">Counting the boxes…</div>}
      </div>
    )
  }

  const { ads, adsense: g } = data
  const t = ads.total
  const visitors = data.series.reduce((a, s) => a + s.visitors, 0)
  const nDays = Math.max(1, data.series.length)
  const cfg = ads.config
  const status = cfg.mode === 'off' ? 'OFF' : cfg.mode === 'test' ? 'TEST ADS' : 'LIVE'

  return (
    <div class="gn stack">
      <div class="toolbar">
        <Segmented label="Range" value={days} options={range} onChange={setDays} />
        <span class="gn-live"><span class={`lamp ${cfg.mode === 'live' ? 'lamp-up' : cfg.mode === 'test' ? 'lamp-warn' : 'lamp-idle'}`} />Ads are {status.toLowerCase()}{cfg.split < 100 ? ` · in ${cfg.split}% of rooms` : ''}</span>
        <button type="button" class="link-btn" onClick={() => setTick(n => n + 1)}>Refresh</button>
      </div>

      <div class="stats">
        <Stat label="EST. REVENUE" value={inr(t.usd)} sub={`${usd(t.usd)} · ${inr(t.usd / nDays)} a day`} />
        <Stat label="ADSENSE SAYS" value={'currency' in g ? money(g.total.earnings, g.currency) : '—'} sub={'currency' in g ? `${num(g.total.impressions)} impressions · ${num(g.total.clicks)} clicks` : 'error' in g ? g.error : 'not connected'} />
        <Stat label="BOXES FILLED" value={num(t.fill)} sub={`${pc(t.fill, t.req)} of ${num(t.req)} asked for`} />
        <Stat label="SEEN" value={pc(t.view, t.fill)} sub="half a box on screen for 1 s" />
        <Stat label="CLICK RATE" value={pc(t.click, t.view, 2)} sub={`${num(t.click)} clicks`} />
        <Stat label="PER 1,000 VISITORS" value={visitors ? inr((t.usd / visitors) * 1000) : '—'} sub={`${visitors ? (t.fill / visitors).toFixed(1) : '—'} boxes a visitor · ${num(visitors)} visitor-days`} />
      </div>

      <Panel title="Every day" kicker={`${data.from} → ${data.today} · IST`} id="ads-trend"><Trend series={ads.series} /></Panel>

      <Panel title="By place" kicker="WHERE THE BOXES ARE" id="ads-places">
        <Breakdown rows={ads.byPlace} first="Place" />
        <p class="fine">Asked: a box came near the screen and asked for an ad. Filled: an ad came. Seen: of the filled, the share that was half on screen for a second. CTR: clicks per box seen. Est.: filled × the rates in Settings.</p>
      </Panel>

      <div class="grid-2">
        <Panel title="By device" kicker="PHONE, TABLET, LAPTOP" id="ads-device"><Breakdown rows={ads.byDevice} first="Device" /></Panel>
        <Panel title="India and elsewhere" kicker="WHERE VISITORS ARE" id="ads-geo"><Breakdown rows={ads.byGeo} first="Where" /></Panel>
      </div>

      <div class="grid-2">
        <Panel title="AdSense" kicker={'currency' in g ? `${g.currency} · ACCOUNT TIME ZONE` : 'GOOGLE\'S OWN FIGURES'} id="ads-adsense">
          {'currency' in g ? (
            <>
              <div class="table-wrap"><table class="gn-table">
                <thead><tr><th>Ad unit</th><th>Earnings</th><th>Impressions</th><th>Clicks</th></tr></thead>
                <tbody>{g.units.map(u => <tr key={u.unit}><td>{u.unit}</td><td>{money(u.earnings, g.currency)}</td><td>{num(u.impressions)}</td><td>{num(u.clicks)}</td></tr>)}</tbody>
              </table></div>
              <p class="fine">Page RPM over the range: {g.total.pageViews ? money((g.total.earnings / g.total.pageViews) * 1000, g.currency) : '—'}. AdSense counts differ a little from the site's own (ad blockers, and its own rules for what counts).</p>
            </>
          ) : 'error' in g ? <p class="notice is-err">{g.error}</p> : (
            <>
              <p>Not connected. Set these secrets on the Switchboard Worker to see AdSense's own earnings here:</p>
              <ul class="plain">{g.missing.map(m => <li key={m}><code>{m}</code></li>)}</ul>
              <p class="fine">How: make an OAuth client in Google Cloud (Desktop app) with the AdSense Management API turned on, sign in once with the <code>adsense.readonly</code> scope to get a refresh token, then <code>wrangler secret put</code> each one. The account is your publisher id without <code>ca-</code>.</p>
            </>
          )}
        </Panel>

        <Panel title="Rooms with and without ads" kicker={ads.split.without ? `${ads.split.pct}% OF ROOMS HAVE ADS` : 'EVERY ROOM HAS ADS'} id="ads-split">
          <div class="table-wrap"><table class="gn-table">
            <thead><tr><th /><th>Rooms</th><th>Played</th><th>Games / room</th><th>Reached 2nd game</th></tr></thead>
            <tbody>
              {[['With ads', ads.split.withAds], ['Without', ads.split.without]].filter(([, s]) => s).map(([label, s]) => {
                const x = s as NonNullable<AdsReport['ads']['split']['without']>
                return <tr key={label as string}><td>{label as string}</td><td>{num(x.rooms)}</td><td>{num(x.started)}</td><td>{x.gamesPerRoom ?? '—'}</td><td>{x.second === null ? '—' : `${(x.second * 100).toFixed(0)}%`}</td></tr>
              })}
            </tbody>
          </table></div>
          <p class="fine">Set rooms with ads below 100% in Settings to compare. If the side with ads plays clearly fewer games, turn off the place that costs most. A difference smaller than about 5% on fewer than a few hundred rooms is noise.</p>
        </Panel>
      </div>

      <Settings cfg={cfg} places={ads.places} onSaved={c => setData(d => (d ? { ...d, ads: { ...d.ads, config: c } } : d))} />
    </div>
  )
}
