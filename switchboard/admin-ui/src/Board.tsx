import type { Line, Overview } from './api'
import { ago, compact, num, ratio, weekday } from './format'
import type { Route } from './App'
import { lineState, uptimePct } from './lines'
import { Gauge, Lamp, Panel, Spark, UptimeStrip } from './ui'

function LineRow({ line, now }: { line: Line; now: number }) {
  const state = lineState(line)
  const last = line.recent[0]
  const pct = uptimePct(line.days)
  const host = line.origin.replace('https://', '')
  return (
    <li class={`line line-${state}`}>
      <Lamp state={state} />
      <div class="line-name">
        <span class="line-title">{line.name}</span>
        <span class="line-hosts">{line.hosts.join(' · ')}</span>
      </div>
      {state === 'planned' ? (
        <div class="line-planned">Not deployed. Watch it from Controls once it ships.</div>
      ) : (
        <>
          <div class="line-rt">
            <span class="line-ms">{last?.ms != null ? `${last.ms} ms` : last ? (last.code ? `HTTP ${last.code}` : 'no answer') : '—'}</span>
            <Spark values={line.recent.slice(0, 16).reverse().map(c => (c.ok ? c.ms : null))} />
            <span class="line-sub">{last ? ago(last.at, now) : 'first check soon'}</span>
          </div>
          <div class="line-uptime">
            <UptimeStrip days={line.days} now={now} />
            <span class="line-sub">{pct === null ? 'no history yet' : `${pct >= 99.995 ? '100' : pct.toFixed(2)}% · 30 days`}</span>
          </div>
          <div class="line-traffic">
            <span class="line-views">{compact(line.today.views)} <small>{line.today.views === 1 ? 'view' : 'views'} today</small></span>
            <span class="line-sub">{num(line.today.visitors)} {line.today.visitors === 1 ? 'visitor' : 'visitors'}</span>
          </div>
        </>
      )}
      <a class="line-open" href={line.origin} target="_blank" rel="noreferrer" aria-label={`Open ${host} in a new tab`}>
        {host} <span aria-hidden="true">↗</span>
      </a>
    </li>
  )
}

export function Board({ data, go }: { data: Overview; go: (r: Route) => void }) {
  const open = data.alerts.filter(a => a.resolvedAt === null)
  const live = data.services.filter(s => s.live)
  const down = live.filter(s => lineState(s) === 'down')
  const meters = [...(data.resources?.meters ?? [])].sort((a, b) => ratio(b) - ratio(a)).slice(0, 4)
  const week = data.week.series
  const peak = Math.max(1, ...week.map(d => d.views))

  return (
    <div class="board">
      <div class="board-main">
        {open.length > 0 && (
          <Panel title={`${open.length} open alert${open.length > 1 ? 's' : ''}`} kicker="NEEDS A LOOK" class="panel-alerts" id="alerts-title">
            <ul class="alerts">
              {open.map(a => (
                <li key={a.key} class={`alert alert-${a.level}`}>
                  <Lamp state={a.level} />
                  <span class="alert-msg">{a.message}</span>
                  <span class="alert-time">since {ago(a.openedAt, data.now)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel
          title="Lines"
          kicker={down.length ? `${down.length} DOWN · ${live.length - down.length} UP` : `${live.length} LIVE · ${data.services.length - live.length} PLANNED`}
          id="lines-title"
        >
          <ul class="lines">
            {data.services.map(l => <LineRow key={l.id} line={l} now={data.now} />)}
          </ul>
        </Panel>
      </div>

      <aside class="board-side">
        <Panel title="This week" kicker="TRAFFIC · ALL SITES" id="week-title" actions={<button type="button" class="link-btn" onClick={() => go('traffic')}>Details</button>}>
          <div class="week-totals">
            <div><span class="big">{compact(data.week.totals.views)}</span><span class="kicker">VIEWS</span></div>
            <div><span class="big">{compact(data.week.totals.visitors)}</span><span class="kicker">VISITORS</span></div>
          </div>
          <div class="week-bars" role="img" aria-label={week.map(d => `${weekday(d.day)} ${d.views} views`).join(', ')}>
            {week.map(d => (
              <div key={d.day} class="week-col">
                <span class="week-bar" style={{ height: `${Math.max(3, (d.views / peak) * 100)}%` }} title={`${d.views} views, ${d.visitors} visitors`} />
                <span class="week-day">{weekday(d.day).slice(0, 2)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Headroom" kicker="FREE TIERS" id="headroom-title" actions={<button type="button" class="link-btn" onClick={() => go('resources')}>All meters</button>}>
          {meters.length ? (
            <div class="gauges-compact">{meters.map(m => <Gauge key={m.id} meter={m} compact />)}</div>
          ) : (
            <p class="empty">No usage read yet. It is collected every 6 hours, or press Refresh usage in Resources.</p>
          )}
          {data.resources && <p class="fine">Read {ago(data.resources.at, data.now)}</p>}
        </Panel>

        {data.resources?.deployments.length ? (
          <Panel title="Deploys" kicker="VERCEL · PRODUCTION" id="deploys-title">
            <ul class="deploys">
              {data.resources.deployments.map(d => (
                <li key={d.project}>
                  <Lamp state={d.state === 'READY' ? 'ok' : d.state === 'ERROR' ? 'critical' : 'warn'} label={d.state} />
                  <span class="deploy-name">{d.project}</span>
                  <span class="deploy-commit" title={d.commit ?? ''}>{d.sha ?? '—'} · {d.at ? ago(d.at, data.now) : 'never'}</span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </aside>
    </div>
  )
}
