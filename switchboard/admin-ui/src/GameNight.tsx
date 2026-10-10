import type { ComponentChildren } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { api, SignedOut, type GamesReport, type Ratio, type Retention, type Text } from './api'
import { ago, compact, countryName, num, shortDay, weekday } from './format'
import { Panel, Ranked, Segmented, Stat } from './ui'

// Game Night (games.amittal.dev): the product's numbers, read live from its own counters each time the page opens.
// Every figure leaves out test browsers and the maker's own; each row says exactly what it counts.

const pc = (r: Ratio, d = 0) => (r === null ? '—' : `${(r * 100).toFixed(d)}%`)
const val = (x: number | null | undefined, d = 1) => (x === null || x === undefined ? '—' : Number.isInteger(x) ? num(x) : x.toFixed(d))
const mins = (m: number | null) => (m === null || !m ? '—' : m < 90 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} h`)

/** One measured number: the name, what exactly it counts, and the value (with its base, so a small sample shows). */
function Row({ label, def, value, base }: { label: string; def: string; value: string; base?: string }) {
  return (
    <div class="m-row">
      <dt><span class="m-label">{label}</span><span class="m-def">{def}</span></dt>
      <dd><span class="m-val">{value}</span>{base && <span class="m-base">{base}</span>}</dd>
    </div>
  )
}
const Rows = ({ children }: { children: ComponentChildren }) => <dl class="m-rows">{children}</dl>

type Metric = 'visitors' | 'players' | 'newVisitors' | 'rooms' | 'games'
const METRICS: { value: Metric; label: string }[] = [
  { value: 'visitors', label: 'Visitors' }, { value: 'players', label: 'Players' }, { value: 'newVisitors', label: 'New' },
  { value: 'rooms', label: 'Rooms' }, { value: 'games', label: 'Games' },
]

function Trend({ series }: { series: GamesReport['series'] }) {
  const [metric, setMetric] = useState<Metric>('players')
  const [pick, setPick] = useState<number | null>(null)
  const n = series.length
  const max = Math.max(1, ...series.map(d => d[metric]))
  const at = pick ?? n - 1
  const d = series[at]
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
      <div class="toolbar"><Segmented label="Measure" value={metric} options={METRICS} onChange={setMetric} /></div>
      <div class="chart-readout" aria-live="polite">
        <span class="chart-day">{weekday(d.day)} {shortDay(d.day)}</span>
        <span><b>{num(d.visitors)}</b> visitors</span><span><b>{num(d.players)}</b> players</span>
        <span><b>{num(d.rooms)}</b> rooms</span><span><b>{num(d.games)}</b> games</span>
      </div>
      <div class="chart-plot" tabIndex={0} role="group" aria-label="Per day. Use the left and right arrow keys to read each day." onPointerMove={move} onPointerLeave={() => setPick(null)} onKeyDown={key}>
        <svg viewBox={`0 0 ${n * 10} 100`} preserveAspectRatio="none" aria-hidden="true">
          {[25, 50, 75].map(y => <line key={y} class="chart-grid" x1="0" x2={n * 10} y1={y} y2={y} vector-effect="non-scaling-stroke" />)}
          {series.map((s, i) => <rect key={s.day} class={`chart-bar ${i === at ? 'is-on' : ''}`} x={i * 10 + 1.5} width="7" y={100 - (s[metric] / max) * 92} height={(s[metric] / max) * 92 + 0.01} />)}
        </svg>
        <div class="chart-max">{compact(max)}</div>
      </div>
      <div class="chart-axis" aria-hidden="true">
        <span>{shortDay(series[0].day)}</span><span>{shortDay(series[Math.floor((n - 1) / 2)].day)}</span><span>{shortDay(series[n - 1].day)}</span>
      </div>
      <div class="sr-only"><table>
        <caption>Per day</caption>
        <thead><tr><th>Day</th><th>Visitors</th><th>Players</th><th>New visitors</th><th>Rooms</th><th>Games</th></tr></thead>
        <tbody>{series.map(s => <tr key={s.day}><td>{s.day}</td><td>{s.visitors}</td><td>{s.players}</td><td>{s.newVisitors}</td><td>{s.rooms}</td><td>{s.games}</td></tr>)}</tbody>
      </table></div>
    </div>
  )
}

/** Each step as a share of the first. */
function Funnel({ steps }: { steps: { label: string; n: number }[] }) {
  const top = steps[0].n || 1
  return (
    <ol class="funnel">
      {steps.map((s, i) => (
        <li key={s.label}>
          <span class="funnel-bar" style={{ width: `${Math.max(s.n ? 2 : 0, (s.n / top) * 100)}%` }} aria-hidden="true" />
          <span class="funnel-label">{s.label}</span>
          <span class="funnel-n">{num(s.n)}{i > 0 && <small>{steps[0].n ? pc(s.n / steps[0].n) : '—'}</small>}</span>
        </li>
      ))}
    </ol>
  )
}

function RetentionTile({ label, r, days }: { label: string; r: Retention; days: number }) {
  return (
    <div class="ret">
      <div class="kicker">{label}</div>
      <div class="ret-val">{pc(r.pct)}</div>
      <div class="stat-sub">{r.n ? `${num(r.back)} of ${num(r.n)} back on day ${days}` : 'nobody old enough yet'}</div>
      <div class="stat-sub">{r.n ? `${pc(r.within)} back within ${days} day${days > 1 ? 's' : ''}` : ''}</div>
    </div>
  )
}

function Hours({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours)
  return (
    <div class="hours" role="img" aria-label={`Games by hour of the day, Indian time. Busiest: ${hours.indexOf(Math.max(...hours))}:00.`}>
      {hours.map((h, i) => <span key={i} title={`${String(i).padStart(2, '0')}:00 · ${h} games`}><i style={{ height: `${Math.max(h ? 4 : 0, (h / max) * 100)}%` }} /></span>)}
      <div class="hours-axis" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
    </div>
  )
}

function Stars({ stars }: { stars: number[] }) {
  const max = Math.max(1, ...stars)
  return (
    <ol class="stars-dist">
      {[5, 4, 3, 2, 1].map(s => (
        <li key={s}><span>{s} ★</span><span class="sd-track"><i style={{ width: `${(stars[s - 1] / max) * 100}%` }} /></span><b>{num(stars[s - 1])}</b></li>
      ))}
    </ol>
  )
}

function Texts({ rows, names, empty }: { rows: Text[]; names: Record<string, string>; empty: string }) {
  if (!rows.length) return <p class="empty">{empty}</p>
  return (
    <ul class="texts">
      {rows.map(t => (
        <li key={t.text + t.last}>
          <span class="texts-n">{t.n}×</span>
          <span class="texts-body">“{t.text}”<span class="m-def">{names[t.game] ?? t.game} · {ago(t.last)}</span></span>
        </li>
      ))}
    </ul>
  )
}

export function GameNight({ onSignedOut }: { onSignedOut: () => void }) {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<GamesReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let stale = false
    setError(null)
    api.games(days).then(r => { if (!stale) setData(r) }).catch(e => {
      if (e instanceof SignedOut) onSignedOut()
      else if (!stale) setError(e.message)
    })
    return () => { stale = true }
  }, [days, tick, onSignedOut])
  // The live numbers stay current while the page is open and in view.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') setTick(n => n + 1) }, 30_000)
    return () => clearInterval(t)
  }, [])

  const range = [{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' }, { value: 0, label: 'All time' }]
  if (!data) {
    return (
      <div class="gn stack">
        <div class="toolbar"><Segmented label="Range" value={days} options={range} onChange={setDays} /></div>
        {error ? <p class="notice is-err" role="alert">{error} <button type="button" class="link-btn" onClick={() => setTick(t => t + 1)}>Try again</button></p> : <div class="loading" aria-busy="true">Counting the room…</div>}
      </div>
    )
  }

  const { acquisition: a, activation: act, engagement: e, retention: r, virality: v, quality: q, feedback: f, funnel } = data
  const period = data.days ? `last ${data.days} days` : 'since tracking began'
  const name = (id: string) => data.names[id] ?? id
  const live = { online: 0, rooms: 0, playing: 0, waiting: 0, ...data.live }
  const plural = (n: number, one: string) => `${num(n)} ${one}${n === 1 ? '' : 's'}`

  return (
    <div class="gn stack">
      <div class="toolbar">
        <Segmented label="Range" value={days} options={range} onChange={setDays} />
        <span class="gn-live"><span class={`lamp ${live.online ? 'lamp-up' : 'lamp-idle'}`} />Live numbers update every 30 s</span>
        <button type="button" class="link-btn" onClick={() => setTick(t => t + 1)}>Refresh</button>
      </div>
      {error && <p class="notice is-err" role="alert">{error}</p>}

      <div class="stats">
        <Stat label="IN A ROOM · LIVE" value={num(live.online)}
          sub={live.online ? `${plural(live.rooms, 'room')} open · ${num(live.playing)} playing ${plural(live.games, 'game')} · ${num(live.waiting)} in a lobby` : 'nobody in a room right now'} />
        <Stat label="PLAYERS · 30 DAYS" value={num(a.mauPlayers)} sub={`${num(a.wauPlayers)} this week · ${num(a.dauPlayers)} today`} />
        <Stat label="VISITORS · 30 DAYS" value={num(a.mau)} sub={`${num(a.wau)} this week · ${num(a.dau)} today`} />
        <Stat label="GAMES PLAYED" value={num(e.games)} sub={`${num(act.started)} room${act.started === 1 ? "" : "s"} · ${period}`} />
        <Stat label="GAMES PER NIGHT" value={val(e.gamesPerRoom)} sub={`${val(act.avgPlayers)} players a room`} />
        <Stat label="DAY-7 RETURN" value={pc(r.d7.pct)} sub={r.d7.n ? `of ${num(r.d7.n)} players` : 'not enough days yet'} />
        <Stat label="RATING" value={f.avgRating === null ? '—' : `${f.avgRating.toFixed(1)} ★`} sub={f.ratings ? `${num(f.ratings)} ratings · ${pc(f.again)} would replay` : 'no ratings yet'} />
      </div>

      <Panel title="Every day" kicker={`${data.from} → ${data.today} · ${data.tz}`} id="gn-trend">
        <Trend series={data.series} />
      </Panel>

      <div class="grid-2">
        <Panel title="Acquisition" kicker="WHO SHOWS UP" id="gn-acq">
          <Rows>
            <Row label="DAU" def="Browsers that opened any page today" value={num(a.dau)} base={`${num(a.dauPlayers)} played`} />
            <Row label="WAU" def="Browsers that opened a page in the last 7 days" value={num(a.wau)} base={`${num(a.wauPlayers)} played`} />
            <Row label="MAU" def="Browsers that opened a page in the last 30 days" value={num(a.mau)} base={`${num(a.mauPlayers)} played`} />
            <Row label="Stickiness" def="Players today ÷ players in the last 30 days" value={pc(a.mauPlayers ? a.dauPlayers / a.mauPlayers : null)} />
            <Row label="Average DAU" def={`Mean visitors a day, ${period}`} value={val(a.avgDau)} base={`${val(a.avgDauPlayers)} players`} />
            <Row label="New visitors" def={`Browsers seen for the first time, ${period}`} value={num(a.newVisitors)} />
            <Row label="Visits" def="A visit ends after 30 minutes with nothing done" value={num(a.sessions)} base={a.viewsPerSession ? `${val(a.viewsPerSession)} pages each` : undefined} />
          </Rows>
        </Panel>

        <Panel title="Traffic sources" kicker="FIRST VISIT · NEW VISITORS" id="gn-src">
          <Ranked empty="No new visitors in this range." rows={a.sources.map(s => ({ key: s.label, n: s.n, label: <>{s.label} <span class="muted">{num(s.played)} played</span></> }))} />
          <p class="fine">Room link: the first page was a shared room. Direct: no referrer (typed, bookmarked, or an app that hides it, which WhatsApp often does).</p>
        </Panel>

        <Panel title="Funnel" kicker={`NEW VISITORS · ${period.toUpperCase()}`} id="gn-funnel">
          <Funnel steps={[
            { label: 'Opened the site', n: funnel.newVisitors },
            { label: 'Joined a room', n: funnel.played },
            { label: 'Played on 2+ nights', n: funnel.twoRooms },
            { label: 'Came back another day', n: funnel.returned },
          ]} />
        </Panel>

        <Panel title="Activation" kicker="ROOMS" id="gn-act">
          <Rows>
            <Row label="Rooms created" def="Rooms someone sat in (bots that only call the API are not counted)" value={num(act.created)} />
            <Row label="Rooms started" def="Rooms where at least one game was started" value={num(act.started)} />
            <Row label="Room activation" def="Rooms started ÷ rooms created" value={pc(act.rate)} />
            <Row label="Players per room" def="Different people who sat in a started room (mean)" value={val(act.avgPlayers)} base={`median ${val(act.medianPlayers)}`} />
            <Row label="Players per game" def="Seats in each game started (mean)" value={val(act.avgSeats)} />
          </Rows>
          <div class="kicker gn-sub">GROUP SIZE · STARTED ROOMS</div>
          <Ranked empty="No rooms started yet." rows={act.sizes.filter(s => s.n).map(s => ({ key: s.label, n: s.n, label: `${s.label} players` }))} />
        </Panel>

        <Panel title="Engagement" kicker="NIGHTS AND GAMES" id="gn-eng">
          <Rows>
            <Row label="Games per room" def="Games started in each started room (mean)" value={val(e.gamesPerRoom)} />
            <Row label="Median games a night" def="Games finished in each started room" value={val(e.medianGamesPerNight)} />
            <Row label="Game-night length" def="First game started to last game finished (median)" value={mins(e.medianNightMin)} base={e.avgNightMin ? `mean ${mins(e.avgNightMin)}` : undefined} />
            <Row label="Games completed" def="Finished ÷ (finished + ended by the host + abandoned)" value={pc(e.completed)} base={`${num(e.done)} of ${num(e.games)}`} />
            <Row label="2nd game" def="Started rooms that started a second game" value={pc(e.second)} />
            <Row label="3rd game" def="Rooms with a second game that started a third" value={pc(e.third)} />
            <Row label="Game length" def="Median, from the end of the rules to the result" value={mins(e.medianGameMin)} />
            <Row label="Player-hours" def="Hours each player spent in finished games, added up" value={val(e.playerHours)} />
            <Row label="Game-night planner" def="Started rooms that used a planned game night" value={pc(e.nightPlanner)} />
            <Row label="Back for more nights" def="Players who sat in two or more started rooms" value={pc(e.multiRoom)} />
            <Row label="Rules read by all" def="Games that started early because every player closed the rules" value={pc(e.rulesSkipped)} base={e.medianRulesSec ? `${val(e.medianRulesSec)} s median wait` : undefined} />
            <Row label="Most at once" def="Most players in games at the same moment" value={num(e.peakPlayers)} base={e.peakAt ? new Date(e.peakAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : undefined} />
          </Rows>
          <div class="kicker gn-sub">GAMES STARTED BY HOUR · IST</div>
          <Hours hours={e.hours} />
        </Panel>

        <Panel title="Retention" kicker={`PLAYERS · ${num(r.cohort)} SO FAR`} id="gn-ret">
          <div class="rets">
            <RetentionTile label="D1" r={r.d1} days={1} />
            <RetentionTile label="D7" r={r.d7} days={7} />
            <RetentionTile label="D14" r={r.d14} days={14} />
            <RetentionTile label="D30" r={r.d30} days={30} />
          </div>
          <p class="fine">Of the people who first played on a given day, the share who opened the site again exactly N days later. Only players whose day N has fully passed are counted, so the base grows each day.</p>
        </Panel>

        <Panel title="Virality" kicker="INVITES" id="gn-vir">
          <Rows>
            <Row label="Invite taps" def="Taps on the room code to share the room link" value={num(v.shares)} base={`${num(v.sharesNative)} via the share sheet`} />
            <Row label="Invite opens" def="Visits that began on a room link" value={num(v.inviteOpens)} />
            <Row label="New players from invites" def="New visitors whose first page was a room link" value={num(v.newFromInvites)} base={`${num(v.newFromInvitesPlayed)} played · ${pc(v.shareOfNew)} of new`} />
            <Row label="Players per room" def="Different people who sat in a started room (mean)" value={val(v.playersPerRoom)} />
            <Row label="Rooms by referred users" def="Started rooms made by someone who first came through an invite" value={num(v.roomsByReferred)} base={`of ${num(v.roomsStarted)}`} />
            <Row label="New players per host" def="Invited newcomers who played ÷ people who started a room" value={val(v.perHost, 2)} />
          </Rows>
        </Panel>

        <Panel title="Product quality" kicker="DOES IT WORK" id="gn-q">
          <Rows>
            <Row label="Game completion" def="Games that reached a result" value={pc(q.completion)} />
            <Row label="Ended by the host" def="Games the host stopped early" value={pc(q.aborted)} />
            <Row label="Abandoned" def="Games with no result 6 hours after they began" value={pc(q.unfinished)} />
            <Row label="Disconnects" def="Seated players whose connection dropped mid-game ÷ seats" value={pc(q.dropRate, 1)} base={`${num(q.dropped)} of ${num(q.seats)}`} />
            <Row label="Reconnects" def="Of those, back in the same game within 2 minutes" value={pc(q.reconnect)} base={`${num(q.rejoined)} of ${num(q.dropped)}`} />
            <Row label="Visits with an error" def="Visits where the page hit a script error" value={pc(q.errorSessions, 1)} />
            <Row label="Games with a server error" def="Games where a move failed on the server" value={pc(q.errorGames, 1)} base={`${num(q.serverErrors)} in ${compact(q.actions)} moves`} />
          </Rows>
          {q.topErrors.length > 0 && <>
            <div class="kicker gn-sub">SCRIPT ERRORS</div>
            <Ranked empty="" rows={q.topErrors.map(x => ({ key: x.label, n: x.n, label: <code>{x.label}</code> }))} />
          </>}
        </Panel>

        <Panel title="Feedback" kicker="AFTER EACH GAME" id="gn-fb">
          <Rows>
            <Row label="Average rating" def="Stars given on the results screen (1 to 5)" value={f.avgRating === null ? '—' : `${f.avgRating.toFixed(2)} ★`} base={`${num(f.ratings)} ratings`} />
            <Row label="Would play again" def="Yes ÷ (yes + no)" value={pc(f.again)} base={`${num(f.againVotes)} answers`} />
          </Rows>
          {f.ratings > 0 && <Stars stars={f.stars} />}
          <div class="kicker gn-sub">TOP COMPLAINTS</div>
          <Texts rows={f.complaints} names={data.names} empty="Nothing to fix yet." />
          <div class="kicker gn-sub">TOP REQUESTED GAMES</div>
          <Texts rows={f.ideas} names={data.names} empty="No requests yet." />
          <div class="kicker gn-sub">REPORTED ON THE CONTACT PAGE</div>
          <Texts rows={f.reports ?? []} names={data.names} empty="No reports yet." />
        </Panel>
      </div>

      <Panel title="By game" kicker={period.toUpperCase()} id="gn-games">
        {e.byGame.length ? (
          <div class="table-wrap">
            <table class="gn-table">
              <thead><tr><th>Game</th><th>Started</th><th>Completed</th><th>Players</th><th>Length</th><th title="The room's next game was the same one">Played again</th><th>Rating</th><th>Would replay</th></tr></thead>
              <tbody>{e.byGame.map(g => (
                <tr key={g.id}>
                  <td>{name(g.id)}</td><td>{num(g.started)}</td><td>{pc(g.completion)}</td><td>{val(g.avgPlayers)}</td><td>{mins(g.medianMin)}</td>
                  <td>{pc(g.replay)}</td><td>{g.rating === null ? '—' : `${g.rating.toFixed(1)} (${g.ratings})`}</td><td>{pc(g.again)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p class="empty">No games in this range.</p>}
      </Panel>

      <div class="grid-2">
        <Panel title="First pages" kicker="NEW VISITORS" id="gn-land">
          <Ranked empty="None yet." rows={a.landings.map(l => ({ key: l.label, n: l.n, label: <code>{l.label}</code> }))} />
        </Panel>
        <Panel title="Countries and devices" kicker="NEW VISITORS" id="gn-geo">
          <Ranked empty="None yet." rows={a.countries.map(c => ({ key: c.label, n: c.n, label: <><span class="cc">{c.label}</span> {countryName(c.label)}</> }))} />
          <div class="kicker gn-sub">DEVICES</div>
          <Ranked empty="None yet." rows={a.devices.map(d => ({ key: d.label, n: d.n, label: d.label }))} />
        </Panel>
      </div>

      <p class="fine">
        Counted since {shortDay(data.since)} on games.amittal.dev itself, so ad blockers do not hide anyone. Nobody is identified: a visitor is a random id in one
        browser, a player is a random id inside one room. Test browsers and any browser opened once with games.amittal.dev/?me=1 are left out.
        Days are Indian days. A person on two devices counts twice; one on a cleared browser counts as new.
      </p>
    </div>
  )
}
