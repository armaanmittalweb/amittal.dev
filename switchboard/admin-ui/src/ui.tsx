import type { ComponentChildren } from 'preact'
import type { Day, Meter } from './api'
import { amount, level, pctText, ratio, shortDay } from './format'

export type LampState = 'up' | 'down' | 'planned' | 'warn' | 'critical' | 'ok' | 'idle'

const LAMP_LABEL: Record<LampState, string> = {
  up: 'Up', down: 'Down', planned: 'Planned', warn: 'Warning', critical: 'Critical', ok: 'OK', idle: 'Idle',
}

export function Lamp({ state, label }: { state: LampState; label?: string }) {
  return <span class={`lamp lamp-${state}`} role="img" aria-label={label ?? LAMP_LABEL[state]} />
}

export function Panel(props: { title: string; kicker?: string; actions?: ComponentChildren; class?: string; children: ComponentChildren; id?: string }) {
  return (
    <section class={`panel ${props.class ?? ''}`} aria-labelledby={props.id}>
      <header class="panel-head">
        <div>
          {props.kicker && <div class="kicker">{props.kicker}</div>}
          <h2 class="panel-title" id={props.id}>{props.title}</h2>
        </div>
        {props.actions && <div class="panel-actions">{props.actions}</div>}
      </header>
      {props.children}
    </section>
  )
}

/** A free-tier gauge: the fill, plus tick marks where warnings (70%) and alerts (90%) start. */
export function Gauge({ meter, compact = false }: { meter: Meter; compact?: boolean }) {
  const p = ratio(meter)
  const lv = level(p)
  const width = Math.min(100, Math.max(p > 0 ? 1.5 : 0, p * 100))
  return (
    <div class={`gauge gauge-${lv} ${compact ? 'is-compact' : ''}`}>
      <div class="gauge-top">
        <span class="gauge-label">{meter.label}</span>
        <span class="gauge-pct">{pctText(p)}</span>
      </div>
      <div class="gauge-track" role="meter" aria-valuemin={0} aria-valuemax={meter.limit} aria-valuenow={meter.used} aria-label={`${meter.label}: ${pctText(p)} of the free limit`}>
        <div class="gauge-fill" style={{ width: `${width}%` }} />
        <i class="gauge-tick" style={{ left: '70%' }} />
        <i class="gauge-tick is-hot" style={{ left: '90%' }} />
      </div>
      {!compact && (
        <div class="gauge-foot">
          <span>{amount(meter.used, meter.unit)} of {amount(meter.limit, meter.unit)}</span>
          <span class="tag">{meter.period === 'now' ? 'NOW' : meter.period === 'today' ? 'TODAY · UTC' : 'THIS MONTH'}</span>
        </div>
      )}
      {!compact && meter.detail && <p class="gauge-detail">{meter.detail}</p>}
    </div>
  )
}

/** One cell per day for the last `span` days: full when every check passed, shorter and warmer when some failed. */
export function UptimeStrip({ days, span = 30, now }: { days: Day[]; span?: number; now: number }) {
  const byDay = new Map(days.map(d => [d.day, d]))
  const cells = Array.from({ length: span }, (_, i) => {
    const day = new Date(now - (span - 1 - i) * 86_400_000).toISOString().slice(0, 10)
    return { day, d: byDay.get(day) }
  })
  const known = days.filter(d => d.total > 0)
  const up = known.reduce((a, d) => a + d.up, 0), total = known.reduce((a, d) => a + d.total, 0)
  return (
    <div class="uptime" role="img" aria-label={total ? `${((up / total) * 100).toFixed(2)}% of checks passed over ${span} days` : 'No checks recorded yet'}>
      {cells.map(({ day, d }) => {
        const r = d && d.total ? d.up / d.total : null
        const cls = r === null ? 'none' : r >= 0.999 ? 'ok' : r >= 0.95 ? 'dip' : 'bad'
        return <i key={day} class={`u-${cls}`} title={d ? `${shortDay(day)}: ${d.up}/${d.total} checks passed${d.avgMs ? `, ${d.avgMs} ms average` : ''}` : `${shortDay(day)}: no checks`} />
      })}
    </div>
  )
}

/** Tiny bars of recent round trips, oldest on the left. */
export function Spark({ values }: { values: (number | null)[] }) {
  const max = Math.max(200, ...values.map(v => v ?? 0))
  return (
    <span class="spark" aria-hidden="true">
      {values.map((v, i) => <i key={i} class={v === null ? 'is-miss' : ''} style={{ height: `${v === null ? 100 : Math.max(8, (v / max) * 100)}%` }} />)}
    </span>
  )
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div class="stat">
      <div class="kicker">{label}</div>
      <div class="stat-value">{value}</div>
      {sub && <div class="stat-sub">{sub}</div>}
    </div>
  )
}

/** A ranked list with bars proportional to the top entry. */
export function Ranked({ rows, empty, format = (n: number) => n.toLocaleString('en') }: { rows: { key: string; label: ComponentChildren; n: number }[]; empty: string; format?: (n: number) => string }) {
  if (!rows.length) return <p class="empty">{empty}</p>
  const top = rows[0].n || 1
  return (
    <ol class="ranked">
      {rows.map(r => (
        <li key={r.key}>
          <span class="ranked-bar" style={{ width: `${(r.n / top) * 100}%` }} aria-hidden="true" />
          <span class="ranked-label">{r.label}</span>
          <span class="ranked-n">{format(r.n)}</span>
        </li>
      ))}
    </ol>
  )
}

export function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div class="segmented" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} class={o.value === value ? 'is-on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
