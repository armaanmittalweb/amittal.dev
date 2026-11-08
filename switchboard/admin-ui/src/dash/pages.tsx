import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import type { GameRow, GamesReport, Ratio, Retention } from '../api'
import { ago, amount, compact, countryName, num, shortDay } from '../format'
import { DayLines, Funnel, HourColumns, Meter, Ranked, Tile } from './charts'
import type { Shared } from './Dash'

// The console's read-only pages. Every figure comes from the games Worker's own counters (src/analytics.ts there),
// for the range picked at the top; each says what it counts in plain words.

export const pc = (r: Ratio | undefined, d = 0) => (r === null || r === undefined ? '—' : `${(r * 100).toFixed(d)}%`)
const val = (x: number | null | undefined, d = 1) => (x === null || x === undefined ? '—' : Number.isInteger(x) ? num(x) : x.toFixed(d))
const mins = (m: number | null | undefined) => (!m ? '—' : m < 90 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} h`)

export function Card({ title, sub, children, wide, actions, id }: { title: string; sub?: string; children: ComponentChildren; wide?: boolean; actions?: ComponentChildren; id?: string }) {
  return (
    <section class={`d-card ${wide ? 'is-wide' : ''}`} id={id} aria-labelledby={id ? `${id}-h` : undefined}>
      <header class="d-card-head"><div><h2 id={id ? `${id}-h` : undefined}>{title}</h2>{sub && <p>{sub}</p>}</div>{actions}</header>
      {children}
    </section>
  )
}

/** A list of measured numbers: name, what it counts, value. */
export function Facts({ rows }: { rows: [string, string, string][] }) {
  return (
    <dl class="d-facts">
      {rows.map(([label, def, value]) => (
        <div key={label}><dt>{label}<small>{def}</small></dt><dd>{value}</dd></div>
      ))}
    </dl>
  )
}

/** Until the numbers arrive (or when they cannot). */
function Wait({ s }: { s: Shared }) {
  if (s.gamesErr) return <div class="d-card is-wide"><p class="d-note is-err">{s.gamesErr}</p><button type="button" class="d-btn" onClick={s.reload}>Try again</button></div>
  return <div class="d-grid" aria-busy="true">{[0, 1, 2, 3].map(i => <div key={i} class="d-card d-ghost" />)}</div>
}

const nameOf = (g: GamesReport, id: string) => g.names[id] ?? id
const series = (g: GamesReport, k: 'visitors' | 'players' | 'rooms' | 'games' | 'newVisitors') => g.series.map(d => d[k])

// ---------- Overview ----------

export function OverviewPage(s: Shared) {
  const g = s.games
  if (!g) return <Wait s={s} />
  const a = g.acquisition, line = s.overview?.services.find(x => x.id === 'games')
  const up = line?.recent[0]
  const today = g.series[g.series.length - 1]
  const prev = g.series.slice(0, -1)
  const avg = (k: 'visitors' | 'players') => (prev.length ? prev.reduce((t, d) => t + d[k], 0) / prev.length : 0)
  const delta = (now: number, base: number) => (base > 0 ? { text: `${now >= base ? '▲' : '▼'} ${Math.abs(Math.round(((now - base) / base) * 100))}% vs average · `, good: now >= base } : undefined)
  const site = s.site
  const chips: { label: string; value: string; tone: 'ok' | 'warn' | 'bad' | 'idle'; href: string }[] = [
    { label: 'Site', value: up ? (up.ok ? `Up · ${up.ms ?? '—'} ms` : `Down (${up.code ?? 'no answer'})`) : 'Checking', tone: up ? (up.ok ? 'ok' : 'bad') : 'idle', href: '#/health' },
    { label: 'Ads', value: s.ads ? (s.ads.mode === 'off' ? 'Off' : s.ads.mode === 'test' ? 'Test' : 'Live') : '…', tone: s.ads ? (s.ads.mode === 'live' ? 'ok' : 'idle') : 'idle', href: '#/ads' },
    { label: 'New rooms', value: site ? (site.paused.on ? 'Paused' : 'Open') : '…', tone: site?.paused.on ? 'warn' : 'ok', href: '#/controls' },
    { label: 'Notice', value: site?.notice.text ? 'Showing' : 'None', tone: site?.notice.text ? 'warn' : 'idle', href: '#/controls' },
    { label: 'Games out', value: site ? String(site.gamesOff.length) : '…', tone: site?.gamesOff.length ? 'warn' : 'ok', href: '#/controls' },
  ]
  const top = g.engagement.byGame.slice(0, 8)
  return (
    <div class="d-grid">
      <section class="d-now is-wide" aria-label="Right now">
        <div class="d-now-main"><span class="d-kicker"><i class="d-pulse" aria-hidden="true" /> Right now</span>
          <div class="d-now-nums">
            <span><b>{num(g.live.online ?? g.live.players)}</b>online</span>
            <span><b>{num(g.live.playing ?? g.live.players)}</b>playing</span>
            <span><b>{num(g.live.games)}</b>games running</span>
            <span><b>{num(g.live.rooms ?? 0)}</b>rooms open</span>
          </div>
        </div>
        <ul class="d-chips">{chips.map(c => <li key={c.label}><a href={c.href} class={`d-chip is-${c.tone}`}><span>{c.label}</span><b>{c.value}</b></a></li>)}</ul>
      </section>
      <div class="d-tiles is-wide is-3">
        <Tile label="Visitors today" value={num(a.dau)} trend={series(g, 'visitors')} delta={delta(today?.visitors ?? 0, avg('visitors'))} sub={`${num(a.wau)} this week`} href="#/audience" />
        <Tile label="Players today" value={num(a.dauPlayers)} trend={series(g, 'players')} delta={delta(today?.players ?? 0, avg('players'))} sub={`${num(a.wauPlayers)} this week`} href="#/audience" />
        <Tile label={`Rooms · ${s.days} days`} value={num(g.activation.created)} trend={series(g, 'rooms')} sub={`${pc(g.activation.rate)} started a game`} href="#/games" />
        <Tile label={`Games played · ${s.days} days`} value={num(g.engagement.games)} trend={series(g, 'games')} sub={`${pc(g.engagement.completed)} finished`} href="#/games" />
        <Tile label="New people" value={num(a.newVisitors)} trend={series(g, 'newVisitors')} sub={`${num(g.funnel.played)} of them played`} href="#/growth" />
        <Tile label="Rating" value={g.feedback.avgRating === null ? '—' : `${g.feedback.avgRating.toFixed(2)} ★`} sub={`${num(g.feedback.ratings)} ratings · ${pc(g.feedback.again)} would play again`} href="#/feedback" />
      </div>
      <Card title="Visitors and players" sub="Each day: everyone who opened the site, and everyone who played a game" wide>
        <DayLines rows={g.series} keys={[{ key: 'visitors', label: 'Visitors', color: 's1' }, { key: 'players', label: 'Players', color: 's2' }]} />
      </Card>
      <Card title="Most played" sub={`Games started in the last ${s.days} days`} actions={<a class="d-more" href="#/games">All games</a>}>
        <Ranked rows={top.map(r => ({ key: r.id, label: nameOf(g, r.id), n: r.started, sub: r.rating ? `${r.rating.toFixed(1)} ★` : undefined }))} empty="No games yet in this range." />
      </Card>
      <Card title="Where new people come from" sub="First visit, by source" actions={<a class="d-more" href="#/audience">Audience</a>}>
        <Ranked rows={a.sources.slice(0, 8).map(r => ({ key: r.label, label: r.label, n: r.n, sub: `${num(r.played)} played` }))} empty="No new visitors in this range." />
      </Card>
      {s.overview && s.overview.alerts.filter(x => !x.resolvedAt).length > 0 && (
        <Card title="Open alerts" wide>
          <ul class="d-list">{s.overview.alerts.filter(x => !x.resolvedAt).map(x => <li key={x.key} class={`is-${x.level}`}><b>{x.level === 'critical' ? 'Critical' : 'Warning'}</b> {x.message} <small>since {ago(x.openedAt)}</small></li>)}</ul>
        </Card>
      )}
    </div>
  )
}

// ---------- Audience ----------

const retRow = (label: string, r: Retention, def: string): [string, string, string] => [label, `${def} (${num(r.n)} people)`, pc(r.pct)]

export function AudiencePage(s: Shared) {
  const g = s.games
  if (!g) return <Wait s={s} />
  const a = g.acquisition, f = g.funnel, r = g.retention
  return (
    <div class="d-grid">
      <div class="d-tiles is-wide">
        <Tile label="Today" value={num(a.dau)} sub={`visitors · ${num(a.dauPlayers)} played`} />
        <Tile label="Last 7 days" value={num(a.wau)} sub={`visitors · ${num(a.wauPlayers)} played`} />
        <Tile label="Last 30 days" value={num(a.mau)} sub={`visitors · ${num(a.mauPlayers)} played`} />
        <Tile label="Sessions" value={num(a.sessions)} sub={`${val(a.viewsPerSession)} pages each`} />
      </div>
      <Card title="New visitors, day by day" sub="People who opened the site for the first time" wide>
        <DayLines rows={g.series} keys={[{ key: 'newVisitors', label: 'New visitors', color: 's1' }]} height={180} />
      </Card>
      <Card title="From first visit to regular" sub={`New visitors in the last ${s.days} days`}>
        <Funnel steps={[{ label: 'Came for the first time', n: f.newVisitors }, { label: 'Played a game', n: f.played }, { label: 'Played in two rooms', n: f.twoRooms }, { label: 'Came back another day', n: f.returned }]} />
      </Card>
      <Card title="Coming back" sub="Of people who played, the share who played again">
        <Facts rows={[retRow('Next day', r.d1, 'played again within a day'), retRow('Within a week', r.d7, 'played again within 7 days'), retRow('Within 2 weeks', r.d14, 'within 14 days'), retRow('Within a month', r.d30, 'within 30 days')]} />
      </Card>
      <Card title="Sources" sub="Where new visitors came from, and how many of them played">
        <Ranked rows={a.sources.map(x => ({ key: x.label, label: x.label, n: x.n, sub: `${num(x.played)} played · ${x.n ? Math.round((x.played / x.n) * 100) : 0}%` }))} empty="Nobody new yet." />
      </Card>
      <Card title="Websites that sent people" sub="Referrers, apart from room links and direct visits">
        <Ranked rows={a.referrers.map(x => ({ key: x.label, label: x.label, n: x.n }))} empty="No other site has sent anyone yet." />
      </Card>
      <Card title="First page seen" sub="Where new visitors landed">
        <Ranked rows={a.landings.map(x => ({ key: x.label, label: <code>{x.label}</code>, n: x.n }))} empty="Nothing yet." />
      </Card>
      <Card title="Countries" sub="New visitors">
        <Ranked rows={a.countries.map(x => ({ key: x.label, label: countryName(x.label), n: x.n }))} empty="Nothing yet." />
      </Card>
      <Card title="Devices" sub="New visitors">
        <Ranked rows={a.devices.map(x => ({ key: x.label, label: x.label, n: x.n }))} empty="Nothing yet." />
      </Card>
    </div>
  )
}

// ---------- Games ----------

type SortKey = 'started' | 'done' | 'completion' | 'avgPlayers' | 'medianMin' | 'replay' | 'rating'
const COLS: { key: SortKey; label: string; fmt: (r: GameRow) => string; title: string }[] = [
  { key: 'started', label: 'Started', fmt: r => num(r.started), title: 'Games started' },
  { key: 'done', label: 'Finished', fmt: r => num(r.done), title: 'Games played to the end' },
  { key: 'completion', label: 'Finish rate', fmt: r => pc(r.completion), title: 'Share of started games that finished' },
  { key: 'avgPlayers', label: 'Players', fmt: r => val(r.avgPlayers), title: 'Average players per game' },
  { key: 'medianMin', label: 'Length', fmt: r => mins(r.medianMin), title: 'Median length of a finished game' },
  { key: 'replay', label: 'Played again', fmt: r => pc(r.replay), title: 'Share of rooms whose next game was the same one' },
  { key: 'rating', label: 'Rating', fmt: r => (r.rating === null ? '—' : `${r.rating.toFixed(1)} ★ (${r.ratings})`), title: 'Average rating from players' },
]

export function GamesPage(s: Shared) {
  const g = s.games
  const [sort, setSort] = useState<SortKey>('started')
  if (!g) return <Wait s={s} />
  const e = g.engagement, act = g.activation
  const rows = [...e.byGame].sort((x, y) => (Number(y[sort] ?? -1) - Number(x[sort] ?? -1)))
  const off = new Set(s.site?.gamesOff ?? [])
  return (
    <div class="d-grid">
      <div class="d-tiles is-wide">
        <Tile label="Games played" value={num(e.games)} sub={`${pc(e.completed)} finished`} />
        <Tile label="Player-hours" value={compact(e.playerHours)} sub="time spent playing, all players" />
        <Tile label="Typical game" value={mins(e.medianGameMin)} sub={`a night: ${mins(e.medianNightMin)}`} />
        <Tile label="Most at once" value={num(e.peakPlayers)} sub={e.peakAt ? `players · ${new Date(e.peakAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : 'players'} />
      </div>
      <Card title="Every game" sub="Tap a column to sort. A game marked out is switched off in Controls." wide>
        <div class="d-table-wrap">
          <table class="d-table">
            <thead><tr><th scope="col">Game</th>{COLS.map(c => (
              <th key={c.key} scope="col" title={c.title} aria-sort={sort === c.key ? 'descending' : 'none'}>
                <button type="button" class={sort === c.key ? 'is-on' : ''} onClick={() => setSort(c.key)}>{c.label}</button>
              </th>
            ))}</tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.id}><th scope="row">{nameOf(g, r.id)}{off.has(r.id) && <span class="d-tag is-warn">out</span>}</th>{COLS.map(c => <td key={c.key}>{c.fmt(r)}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
        {!rows.length && <p class="d-empty">No games yet in this range.</p>}
      </Card>
      <Card title="When people play" sub="Games started by hour of the day (IST)">
        <HourColumns hours={e.hours} />
      </Card>
      <Card title="How big rooms are" sub="Players in rooms that started a game">
        <Ranked rows={act.sizes.map(x => ({ key: x.label, label: x.label, n: x.n }))} empty="No rooms yet." />
      </Card>
      <Card title="A night in numbers">
        <Facts rows={[
          ['Rooms made', 'in this range', num(act.created)],
          ['Started a game', 'rooms that played at least once', pc(act.rate)],
          ['Played a second game', 'of rooms that played one', pc(e.second)],
          ['Played a third', 'of rooms that played two', pc(e.third)],
          ['Games per room', 'average, rooms that played', val(e.gamesPerRoom)],
          ['Used the night planner', 'rooms that started a planned night', pc(e.nightPlanner)],
          ['Skipped the rules', 'games where everyone tapped “Got it” before the timer', pc(e.rulesSkipped)],
          ['Time on the rules', 'median seconds before a game starts', `${val(e.medianRulesSec, 0)} s`],
        ]} />
      </Card>
    </div>
  )
}

// ---------- Growth ----------

export function GrowthPage(s: Shared) {
  const g = s.games
  if (!g) return <Wait s={s} />
  const v = g.virality, gr = g.growth
  return (
    <div class="d-grid">
      <div class="d-tiles is-wide">
        <Tile label="Shares" value={num(v.shares)} sub={`${num(v.sharesNative)} through the phone's share sheet`} />
        <Tile label="Invite links opened" value={num(v.inviteOpens)} sub={`${num(v.newFromInvites)} were new people`} />
        <Tile label="New people from invites" value={pc(v.shareOfNew)} sub={`${num(v.newFromInvitesPlayed)} of them played`} />
        <Tile label="Players per room" value={val(v.playersPerRoom)} sub={`${val(v.perHost)} rooms per host`} />
      </div>
      {gr && <>
        <Card title="Hosts who come back" sub="Of people who ran a room, how many ran another">
          <Facts rows={[
            ['Within a week', `${num(gr.rehost7.n)} hosts whose week has passed`, pc(gr.rehost7.pct)],
            ['Within 2 weeks', `${num(gr.rehost14.n)} hosts`, pc(gr.rehost14.pct)],
            ['Hosts in range', 'people who ran a room that played', num(gr.hosts)],
            ['Daily players back next day', `${num(gr.dailyD1.n)} people`, pc(gr.dailyD1.pct)],
            ['Daily players back in a week', `${num(gr.dailyD7.n)} people`, pc(gr.dailyD7.pct)],
          ]} />
        </Card>
        <Card title="Host cohorts" sub="Hosts by the week they first hosted, and the share hosting again in each later week">
          {gr.cohorts.length ? (
            <div class="d-table-wrap"><table class="d-table d-cohort">
              <thead><tr><th scope="col">First week</th><th scope="col">Hosts</th>{[1, 2, 3, 4].map(k => <th key={k} scope="col">Week {k}</th>)}</tr></thead>
              <tbody>{gr.cohorts.map(c => (
                <tr key={c.week}><th scope="row">{shortDay(c.week)}</th><td>{num(c.hosts)}</td>
                  {c.back.map((b, i) => <td key={i} class="d-heat" style={{ '--h': b === null ? 0 : b }}>{pc(b)}</td>)}</tr>
              ))}</tbody>
            </table></div>
          ) : <p class="d-empty">No cohorts yet.</p>}
        </Card>
        <Card title="What gets shared" sub="Share taps, by what was shared">
          <Ranked rows={[['Room invites', gr.shared.invite], ['Game cards', gr.shared.game], ['Night cards', gr.shared.night], ['Daily results', gr.shared.daily]].map(([l, n]) => ({ key: String(l), label: String(l), n: Number(n) }))} empty="Nothing shared yet." />
        </Card>
        <Card title="Joins that failed" sub="Someone opened a room link and could not get in">
          <Ranked rows={[['Room closed or wrong code', gr.joinFails.missing], ['Room full', gr.joinFails.full], ['Room locked', gr.joinFails.locked], ['Removed by the host', gr.joinFails.banned], ['Bad link', gr.joinFails.badid]].map(([l, n]) => ({ key: String(l), label: String(l), n: Number(n) }))} empty="No failed joins." />
        </Card>
        <Card title="Safety" sub="How often hosts had to act, per 100 rooms">
          <Facts rows={[
            ['Players banned', `${num(gr.safety.bans)} in range`, val(gr.safety.per100.bans)],
            ['Players removed', `${num(gr.safety.removals)} in range`, val(gr.safety.per100.removals)],
            ['Names refused', `${num(gr.safety.namesRefused)} in range`, val(gr.safety.per100.namesRefused)],
            ['TV screens', 'rooms shown on a big screen', `${num(gr.tvScreens)} · ${val(gr.tvPer100)} per 100`],
          ]} />
        </Card>
      </>}
    </div>
  )
}

// ---------- Feedback ----------

export function FeedbackPage(s: Shared) {
  const g = s.games
  if (!g) return <Wait s={s} />
  const fb = g.feedback
  const Texts = ({ list, empty }: { list: GamesReport['feedback']['complaints'] | undefined; empty: string }) => (
    list?.length ? <ul class="d-quotes">{list.map((t, i) => <li key={i}><q>{t.text}</q><small>{t.game && `${nameOf(g, t.game)} · `}{t.n > 1 ? `${t.n} times · ` : ''}{ago(t.last)}</small></li>)}</ul> : <p class="d-empty">{empty}</p>
  )
  return (
    <div class="d-grid">
      <div class="d-tiles is-wide">
        <Tile label="Average rating" value={fb.avgRating === null ? '—' : `${fb.avgRating.toFixed(2)} ★`} sub={`${num(fb.ratings)} ratings`} />
        <Tile label="Would play again" value={pc(fb.again)} sub={`${num(fb.againVotes)} answers`} />
        <Tile label="Answered" value={num(fb.responses)} sub={fb.responseRate !== undefined ? `${pc(fb.responseRate)} of finished games` : 'feedback cards'} />
      </div>
      <Card title="Stars" sub="How players rated their games">
        <Ranked rows={[5, 4, 3, 2, 1].map(st => ({ key: String(st), label: `${'★'.repeat(st)}`, n: fb.stars[st - 1] ?? 0 }))} empty="No ratings yet." />
      </Card>
      <Card title="Reports from the contact page" sub="Read every one" wide>
        <Texts list={fb.reports} empty="No reports. Good." />
      </Card>
      <Card title="What went wrong" sub="Players' complaints, the most repeated first">
        <Texts list={fb.complaints} empty="No complaints in this range." />
      </Card>
      <Card title="Ideas" sub="What players asked for">
        <Texts list={fb.ideas} empty="No ideas in this range." />
      </Card>
    </div>
  )
}

// ---------- Health ----------

export function HealthPage(s: Shared) {
  const g = s.games, o = s.overview
  const line = o?.services.find(x => x.id === 'games')
  const days = line?.days ?? []
  const up = days.reduce((t, d) => t + d.up, 0), total = days.reduce((t, d) => t + d.total, 0)
  const meters = o?.resources?.meters.filter(m => /worker|durable|request|games/i.test(`${m.group} ${m.label} ${m.id}`)) ?? []
  const worker = o?.resources?.workers.find(w => w.script === 'games')
  const q = g?.quality
  return (
    <div class="d-grid">
      <div class="d-tiles is-wide">
        <Tile label="Uptime · 30 days" value={total ? `${((up / total) * 100).toFixed(2)}%` : '—'} sub={`${num(total)} checks, every 5 minutes`} />
        <Tile label="Last check" value={line?.recent[0] ? (line.recent[0].ok ? 'Up' : 'Down') : '—'} sub={line?.recent[0] ? `${line.recent[0].ms ?? '—'} ms · ${ago(line.recent[0].at)}` : ''} />
        <Tile label="Worker errors" value={worker ? num(worker.errors) : '—'} sub={worker ? `of ${compact(worker.requests)} requests (Cloudflare)` : 'Cloudflare numbers not read yet'} />
        <Tile label="Server errors" value={q ? num(q.serverErrors) : '—'} sub="in rooms, this range" />
      </div>
      <Card title="Uptime, day by day" sub="Share of checks that found the site up" wide>
        {days.length ? (
          <div class="d-uptime" role="list">{days.slice(-30).map(d => {
            const p = d.total ? d.up / d.total : null
            const lvl = p === null ? 'idle' : p >= 0.999 ? 'ok' : p >= 0.98 ? 'warn' : 'bad'
            return <span role="listitem" key={d.day} class={`is-${lvl}`} title={`${shortDay(d.day)}: ${p === null ? 'no checks' : `${(p * 100).toFixed(1)}% up`}${d.avgMs ? ` · ${d.avgMs} ms` : ''}`} />
          })}</div>
        ) : <p class="d-empty">No checks yet.</p>}
        <p class="d-fine">Green: up all day. Amber: down for part of it. Red: down for more than half an hour. Hover a day for the numbers.</p>
      </Card>
      {q && <Card title="How games hold up" sub="From the rooms themselves">
        <Facts rows={[
          ['Finished', 'games played to the end', pc(q.completion)],
          ['Stopped by the host', 'games ended early', pc(q.aborted)],
          ['Left unfinished', 'everyone went away', pc(q.unfinished)],
          ['Players who dropped', `${num(q.dropped)} of ${num(q.seats)} seats`, pc(q.dropRate)],
          ['Came back after dropping', `${num(q.rejoined)} rejoined`, pc(q.reconnect)],
          ['Visits with a script error', 'sessions', pc(q.errorSessions)],
          ['Games with a script error', 'games', pc(q.errorGames)],
        ]} />
      </Card>}
      {q && <Card title="Script errors" sub="The most common, from players' browsers">
        <Ranked rows={q.topErrors.map(x => ({ key: x.label, label: <code>{x.label}</code>, n: x.n }))} empty="No script errors. Good." />
      </Card>}
      {meters.length > 0 && <Card title="Cloudflare limits" sub={o?.resources ? `Read ${ago(o.resources.at)}` : ''} wide>
        <div class="d-meters">{meters.map(m => <Meter key={m.id} label={m.label} used={m.used} limit={m.limit} text={`${amount(m.used, m.unit)} of ${amount(m.limit, m.unit)}${m.period === 'today' ? ' today' : m.period === 'month' ? ' this month' : ''}`} />)}</div>
      </Card>}
    </div>
  )
}
