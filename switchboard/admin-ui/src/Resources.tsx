import { Fragment } from 'preact'
import type { Connection, Resources as Snapshot } from './api'
import { ago, bytes, compact, num } from './format'
import { Gauge, Lamp, Panel } from './ui'

const SETUP: Record<Connection['id'], string[]> = {
  bindings: [
    'Both project Workers need the same INTERNAL_KEY secret as the Switchboard.',
    'In each Worker folder: npx wrangler secret put INTERNAL_KEY, then deploy.',
  ],
  cloudflare: [
    'Cloudflare dashboard → My Profile → API Tokens → Create Token → Create Custom Token.',
    'Permissions: Account · Account Analytics · Read. Account resources: your account.',
    'In Portfolio/switchboard: npx wrangler secret put CF_API_TOKEN',
  ],
  neon: [
    'Neon console → Account settings → API keys → Create new API key.',
    'In Portfolio/switchboard: npx wrangler secret put NEON_API_KEY',
  ],
  vercel: [
    'vercel.com/account/settings/tokens → Create Token, scope armaanmittalwebs-projects.',
    'In Portfolio/switchboard: npx wrangler secret put VERCEL_TOKEN',
  ],
  ntfy: [
    'Install the ntfy app (Android or iOS) and subscribe to a long random topic, e.g. sb-7f3k9q2m4x.',
    'In Portfolio/switchboard: npx wrangler secret put NTFY_TOPIC (the same topic name).',
    'Then press Send a test alert in Controls.',
  ],
}

function ConnectionRow({ c }: { c: Connection }) {
  const state = c.state === 'connected' ? 'ok' : c.state === 'error' ? 'critical' : 'idle'
  return (
    <li class={`conn conn-${c.state}`}>
      <Lamp state={state} label={c.state} />
      <div class="conn-body">
        <div class="conn-top"><span class="conn-label">{c.label}</span><span class="tag">{c.state === 'connected' ? 'CONNECTED' : c.state === 'error' ? 'ERROR' : 'NOT CONNECTED'}</span></div>
        <p class="conn-detail">{c.detail}</p>
        {c.state !== 'connected' && (
          <details class="conn-setup">
            <summary>How to connect</summary>
            <ol>{SETUP[c.id].map(s => <li key={s}>{s}</li>)}</ol>
          </details>
        )}
      </div>
    </li>
  )
}

export function Resources({ data, now, busy, onRefresh }: { data: Snapshot | null; now: number; busy: boolean; onRefresh: () => void }) {
  const refresh = (
    <button type="button" class="btn" onClick={onRefresh} disabled={busy} title="Reads every source now. This wakes both Neon databases for a few minutes.">
      {busy ? 'Reading…' : 'Refresh usage'}
    </button>
  )

  if (!data) {
    return (
      <Panel title="Resources" kicker="FREE TIERS" actions={refresh} id="res-empty">
        <p class="empty">Nothing read yet. The cron reads usage every 6 hours; press Refresh usage to read it now.</p>
      </Panel>
    )
  }

  const groups = [...new Set(data.meters.map(m => m.group))]
  const edu = data.projects.edusched, os = data.projects.openingos, ss = data.projects.safespace, fs = data.projects.farmsaathi
  const ok = (p: unknown): p is Record<string, number> => !!p && !('error' in (p as object))

  return (
    <div class="resources stack">
      <div class="toolbar">
        <p class="fine">Read {ago(data.at, now)} · refreshed every 6 hours so the databases can sleep in between</p>
        {refresh}
      </div>

      {groups.map(g => (
        <Panel key={g} title={g} kicker="METERS" id={`g-${g}`}>
          <div class="gauges">{data.meters.filter(m => m.group === g).map(m => <Gauge key={m.id} meter={m} />)}</div>
        </Panel>
      ))}

      <div class="grid-2">
        <Panel title="Inside the projects" kicker="FROM /INTERNAL/STATS" id="inside-title">
          <dl class="facts">
            {ok(edu) && <>
              <dt>EduSched users</dt><dd>{num(edu.users)}</dd>
              <dt>Departments</dt><dd>{num(edu.workspaces)}</dd>
              <dt>Class changes</dt><dd>{num(edu.changes)}</dd>
              <dt>Demo copies open</dt><dd>{num(edu.demoCopies)}</dd>
            </>}
            {ok(os) && <>
              <dt>Synced phrases</dt><dd>{num(os.snapshots)}</dd>
              <dt>Active in 30 days</dt><dd>{num(os.active30d)}</dd>
              <dt>Encrypted data stored</dt><dd>{bytes(os.dataBytes)}</dd>
            </>}
            {ok(ss) && <>
              <dt>SafeSpace accounts</dt><dd>{num(ss.users)}</dd>
              <dt>Encrypted records</dt><dd>{num(ss.records)}</dd>
            </>}
            {ok(fs) && <>
              <dt>FarmSaathi accounts</dt><dd>{num(fs.users)}</dd>
              <dt>Saved chats</dt><dd>{num(fs.chats)}</dd>
              <dt>Answers today</dt><dd>{num((fs.today as unknown as Record<string, number>)?.chat ?? 0)}</dd>
            </>}
            {!ok(edu) && <><dt>EduSched</dt><dd class="is-err">{edu?.error ?? 'not read'}</dd></>}
            {!ok(os) && <><dt>OpeningOS</dt><dd class="is-err">{os?.error ?? 'not read'}</dd></>}
            {!ok(ss) && <><dt>SafeSpace</dt><dd class="is-err">{ss?.error ?? 'not read'}</dd></>}
            {!ok(fs) && <><dt>FarmSaathi</dt><dd class="is-err">{fs?.error ?? 'not read'}</dd></>}
          </dl>
        </Panel>

        {data.workers.length > 0 && (
          <Panel title="Worker requests today" kicker="CLOUDFLARE · PER SCRIPT" id="workers-title">
            <dl class="facts">
              {data.workers.map(w => <Fragment key={w.script}><dt>{w.script}</dt><dd>{compact(w.requests)}{w.errors ? <span class="is-err"> · {num(w.errors)} errors</span> : null}</dd></Fragment>)}
            </dl>
          </Panel>
        )}
      </div>

      <Panel title="Connections" kicker="DATA SOURCES" id="conn-title">
        <ul class="conns">{data.connections.map(c => <ConnectionRow key={c.id} c={c} />)}</ul>
      </Panel>
    </div>
  )
}
