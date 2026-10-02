import { useEffect, useState } from 'preact/hooks'
import { api, SignedOut, type Alert, type Overview } from './api'
import { ago } from './format'
import { Lamp, Panel } from './ui'

interface Lever {
  name: string
  title: string
  body: string
  button: string
  confirm?: string
}

const LEVERS: Lever[] = [
  { name: 'check-now', title: 'Check every line', body: 'Runs a round of health checks now instead of waiting for the 5-minute cron, and re-evaluates alerts.', button: 'Check now' },
  { name: 'refresh-resources', title: 'Read usage', body: 'Reads every meter now. This wakes both Neon databases for a few minutes, which costs a little compute.', button: 'Refresh usage' },
  { name: 'cleanup-edusched', title: 'EduSched: clean up', body: 'Deletes expired demo colleges and sessions, class changes older than 180 days, and used or expired codes. The hourly cron does this too.', button: 'Clear now' },
  { name: 'prune-openingos', title: 'OpeningOS: prune stale sync', body: 'Deletes synced snapshots nobody has written for a year. The daily cron does this too.', button: 'Prune now', confirm: 'Delete every synced snapshot untouched for a year?' },
  { name: 'test-alert', title: 'Send a test alert', body: 'Pushes a test notification to your ntfy topic, to check alerts reach your phone.', button: 'Send test' },
]

export function Controls({ data, run, busy, onSignedOut }: { data: Overview; run: (name: string, body?: Record<string, unknown>, confirm?: string) => Promise<boolean>; busy: string | null; onSignedOut: () => void }) {
  const [history, setHistory] = useState<Alert[] | null>(null)
  const deploys = new Map((data.resources?.deployments ?? []).map(d => [d.site, d]))
  const vercel = data.resources?.connections.find(c => c.id === 'vercel')?.state === 'connected'

  useEffect(() => {
    api.alerts().then(setHistory).catch(e => { if (e instanceof SignedOut) onSignedOut() })
  }, [data.now, onSignedOut])

  return (
    <div class="controls stack">
      <Panel title="Levers" kicker="ONE-OFF JOBS" id="levers-title">
        <ul class="levers">
          {LEVERS.map(l => (
            <li key={l.name} class="lever">
              <div>
                <h3 class="lever-title">{l.title}</h3>
                <p class="lever-body">{l.body}</p>
              </div>
              <button type="button" class="btn" disabled={busy !== null} onClick={() => void run(l.name, {}, l.confirm)}>
                {busy === l.name ? 'Working…' : l.button}
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <div class="grid-2">
        <Panel title="Watched lines" kicker="CHECKED EVERY 5 MINUTES" id="watch-title">
          <p class="fine">A watched line is health-checked, shown on the Lab's status strip and can raise alerts. Turn a project on when it ships; no deploy needed.</p>
          <ul class="toggles">
            {data.services.map(s => (
              <li key={s.id}>
                <span class="toggle-name">{s.name}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={s.live}
                  aria-label={`Watch ${s.name}`}
                  class={`switch ${s.live ? 'is-on' : ''}`}
                  disabled={busy !== null}
                  onClick={() => void run('set-live', { id: s.id, live: !s.live }, s.live ? `Stop watching ${s.name}? It will show as planned on the Lab.` : undefined)}
                >
                  <span class="switch-knob" />
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Redeploy" kicker="VERCEL · FROM MAIN" id="redeploy-title">
          {!vercel && <p class="notice">Connect Vercel in Resources to redeploy from here.</p>}
          <ul class="redeploys">
            {['archive', 'edusched', 'safespace', 'openingos', 'farmsaathi', 'loomcore'].map(site => {
              const d = deploys.get(site)
              const name = data.services.find(s => s.id === site)?.name ?? site
              return (
                <li key={site}>
                  <div>
                    <span class="toggle-name">{name}</span>
                    <span class="fine">{d ? `${d.state.toLowerCase()} · ${d.sha ?? ''} · ${ago(d.at, data.now)}` : 'no deploy info'}</span>
                  </div>
                  <button type="button" class="btn btn-ghost" disabled={!vercel || busy !== null} onClick={() => void run('redeploy', { site }, `Start a new production build of ${name} from main?`)}>
                    {busy === 'redeploy' ? 'Starting…' : 'Redeploy'}
                  </button>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>

      <Panel title="Alert history" kicker="LAST 30 DAYS" id="history-title">
        {!history ? <p class="empty">Loading…</p> : history.length === 0 ? <p class="empty">No alerts in the last 30 days.</p> : (
          <ul class="alerts">
            {history.map(a => (
              <li key={a.key + a.openedAt} class={`alert alert-${a.resolvedAt ? 'resolved' : a.level}`}>
                <Lamp state={a.resolvedAt ? 'ok' : a.level} label={a.resolvedAt ? 'Resolved' : a.level} />
                <span class="alert-msg">{a.message}</span>
                <span class="alert-time">{a.resolvedAt ? `resolved ${ago(a.resolvedAt, data.now)}` : `open since ${ago(a.openedAt, data.now)}`}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
