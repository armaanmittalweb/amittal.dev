import { useEffect, useState } from 'preact/hooks'
import { api, SignedOut, type Line, type Traffic as Report } from './api'
import { compact, countryName, num, shortDay, weekday } from './format'
import { Panel, Ranked, Segmented, Stat } from './ui'

function Chart({ series }: { series: Report['series'] }) {
  const [pick, setPick] = useState<number | null>(null)
  const n = series.length
  const max = Math.max(1, ...series.map(d => d.views))
  const at = pick ?? n - 1
  const d = series[at]
  const points = series.map((s, i) => `${i * 10 + 5},${100 - (s.visitors / max) * 92}`).join(' ')

  const move = (e: PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPick(Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n))))
  }
  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setPick(Math.max(0, at - 1))
    else if (e.key === 'ArrowRight') setPick(Math.min(n - 1, at + 1))
    else return
    e.preventDefault()
  }

  return (
    <div class="chart">
      <div class="chart-readout" aria-live="polite">
        <span class="chart-day">{weekday(d.day)} {shortDay(d.day)}</span>
        <span><b>{num(d.views)}</b> views</span>
        <span><b>{num(d.visitors)}</b> visitors</span>
      </div>
      <div
        class="chart-plot"
        tabIndex={0}
        role="group"
        aria-label="Views per day. Use the left and right arrow keys to read each day."
        onPointerMove={move}
        onPointerLeave={() => setPick(null)}
        onKeyDown={key}
      >
        <svg viewBox={`0 0 ${n * 10} 100`} preserveAspectRatio="none" aria-hidden="true">
          {[25, 50, 75].map(y => <line key={y} class="chart-grid" x1="0" x2={n * 10} y1={y} y2={y} vector-effect="non-scaling-stroke" />)}
          {series.map((s, i) => (
            <rect key={s.day} class={`chart-bar ${i === at ? 'is-on' : ''}`} x={i * 10 + 1.5} width="7" y={100 - (s.views / max) * 92} height={(s.views / max) * 92 + 0.01} />
          ))}
          <polyline class="chart-line" points={points} vector-effect="non-scaling-stroke" />
        </svg>
        <div class="chart-max">{compact(max)}</div>
      </div>
      <div class="chart-axis" aria-hidden="true">
        <span>{shortDay(series[0].day)}</span>
        <span>{shortDay(series[Math.floor((n - 1) / 2)].day)}</span>
        <span>{shortDay(series[n - 1].day)}</span>
      </div>
      <div class="chart-legend" aria-hidden="true"><span class="lg-bar" /> views <span class="lg-line" /> visitors</div>
      <table class="sr-only">
        <caption>Views and visitors per day</caption>
        <thead><tr><th>Day</th><th>Views</th><th>Visitors</th></tr></thead>
        <tbody>{series.map(s => <tr key={s.day}><td>{s.day}</td><td>{s.views}</td><td>{s.visitors}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

export function Traffic({ lines, onSignedOut }: { lines: Line[]; onSignedOut: () => void }) {
  const [site, setSite] = useState<string>('')
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const names = Object.fromEntries(lines.map(l => [l.id, l.name]))

  useEffect(() => {
    let stale = false
    setError(null)
    api.traffic(site || null, days).then(r => { if (!stale) setData(r) }).catch(e => {
      if (e instanceof SignedOut) onSignedOut()
      else if (!stale) setError(e.message)
    })
    return () => { stale = true }
  }, [site, days, onSignedOut])

  const siteOptions = [{ value: '', label: 'All sites' }, ...lines.filter(l => l.live).map(l => ({ value: l.id, label: l.name }))]
  const busiest = data ? data.series.reduce((a, b) => (b.views > a.views ? b : a), data.series[0]) : null
  const deviceTotal = data ? data.devices.reduce((a, d) => a + d.n, 0) : 0

  return (
    <div class="traffic stack">
      <div class="toolbar">
        <Segmented label="Site" value={site} options={siteOptions} onChange={setSite} />
        <Segmented label="Range" value={days} options={[{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' }]} onChange={setDays} />
      </div>

      {error && <p class="notice is-err" role="alert">{error}</p>}
      {!data && !error && <div class="loading" aria-busy="true">Reading the counters…</div>}

      {data && (
        <>
          <div class="stats">
            <Stat label="VIEWS" value={compact(data.totals.views)} sub={`${data.days} days`} />
            <Stat label="VISITORS" value={compact(data.totals.visitors)} sub="unique per site per day" />
            <Stat label="VIEWS PER VISITOR" value={data.totals.visitors ? (data.totals.views / data.totals.visitors).toFixed(1) : '—'} />
            <Stat label="BUSIEST DAY" value={busiest && busiest.views ? shortDay(busiest.day) : '—'} sub={busiest && busiest.views ? `${num(busiest.views)} views` : 'no views yet'} />
          </div>

          <Panel title={site ? `${names[site]} · views per day` : 'Every site · views per day'} kicker={`${data.from} → ${data.to} · UTC`} id="chart-title">
            {data.totals.views ? <Chart series={data.series} /> : <p class="empty">No views in this range yet. Counting started when the beacons shipped.</p>}
          </Panel>

          <div class="grid-2">
            {!site && (
              <Panel title="By site" kicker="VIEWS · VISITORS" id="sites-title">
                <Ranked empty="No views yet." rows={data.sites.map(s => ({ key: s.site, n: s.views, label: <><button type="button" class="link-btn" onClick={() => setSite(s.site)}>{names[s.site] ?? s.site}</button> <span class="muted">{num(s.visitors)} visitors</span></> }))} />
              </Panel>
            )}
            <Panel title="Top pages" kicker="PATHS" id="pages-title">
              <Ranked empty="No pages yet." rows={data.pages.map(p => ({ key: p.site + p.path, n: p.n, label: <>{!site && <span class="chip">{names[p.site] ?? p.site}</span>} <code>{p.path}</code></> }))} />
            </Panel>
            <Panel title="Where they came from" kicker="REFERRING SITES" id="refs-title">
              <Ranked empty="No referrers yet." rows={data.refs.map(r => ({ key: r.label, n: r.n, label: r.label === '(direct)' ? <span class="muted">Direct or unknown</span> : r.label }))} />
            </Panel>
            <Panel title="Countries" kicker="FROM CLOUDFLARE" id="countries-title">
              <Ranked empty="No countries yet." rows={data.countries.map(c => ({ key: c.label, n: c.n, label: <><span class="cc">{c.label === '??' ? '··' : c.label}</span> {countryName(c.label)}</> }))} />
            </Panel>
            <Panel title="Devices" kicker="FROM THE USER AGENT" id="devices-title">
              {deviceTotal ? (
                <>
                  <div class="split" role="img" aria-label={data.devices.map(d => `${d.label} ${Math.round((d.n / deviceTotal) * 100)}%`).join(', ')}>
                    {data.devices.map(d => <span key={d.label} class={`split-${d.label}`} style={{ flexGrow: d.n }} />)}
                  </div>
                  <ul class="split-legend">
                    {data.devices.map(d => <li key={d.label}><span class={`sw split-${d.label}`} /> {d.label} <b>{Math.round((d.n / deviceTotal) * 100)}%</b></li>)}
                  </ul>
                </>
              ) : <p class="empty">No devices yet.</p>}
            </Panel>
          </div>
          <p class="fine">Counted without cookies or ids. A visitor is a hash of the day's salt, IP address and browser, and the salt is deleted after two days.</p>
        </>
      )}
    </div>
  )
}
