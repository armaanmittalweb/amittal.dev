import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { compact, num, shortDay, weekday } from '../format'

// The console's charts, drawn by hand in SVG and HTML: one axis each, thin marks, a hover read-out on every one, and
// the numbers behind each chart one tap away. Series colours come from CSS (--s1 blue, --s2 orange, validated for both
// the light and dark card surfaces); text always wears the ink colours, never a series colour.

/** The element's width, kept up to date, so the SVG is drawn in real pixels (crisp text, true 2px lines). */
function useWidth<T extends HTMLElement>(): [preact.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

/** A clean top for an axis: 1, 2 or 5 times a power of ten, at or above the data's top. */
function niceMax(v: number) {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p
  return 10 * p
}

export interface LineKey { key: string; label: string; color: 's1' | 's2' }

/**
 * Lines over days (one axis; the second series is a measure of the same unit, people). A crosshair follows the
 * pointer or the arrow keys and the read-out above names the day and every value.
 */
export function DayLines({ rows, keys, height = 220, area = true }: { rows: ({ day: string } & Record<string, number | string>)[]; keys: LineKey[]; height?: number; area?: boolean }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [pick, setPick] = useState<number | null>(null)
  const n = rows.length
  if (!n) return <p class="d-empty">No days in this range yet.</p>
  const val = (r: (typeof rows)[number], k: string) => Number(r[k]) || 0
  const top = niceMax(Math.max(...rows.flatMap(r => keys.map(k => val(r, k.key)))))
  const padL = 36, padR = 12, padT = 10, padB = 24
  const iw = Math.max(1, w - padL - padR), ih = height - padT - padB
  const x = (i: number) => padL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v: number) => padT + ih - (v / top) * ih
  const at = pick ?? n - 1
  const d = rows[at]
  const move = (e: PointerEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left - padL) / iw) * (n - 1))
    setPick(Math.min(n - 1, Math.max(0, i)))
  }
  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { setPick(Math.max(0, at - 1)); e.preventDefault() }
    if (e.key === 'ArrowRight') { setPick(Math.min(n - 1, at + 1)); e.preventDefault() }
  }
  const ticks = [0, top / 2, top]
  const labelsAt = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0]
  return (
    <div class="d-chart">
      <div class="d-readout" aria-live="polite">
        <span class="d-readout-day">{weekday(d.day as string)} {shortDay(d.day as string)}</span>
        {keys.map(k => <span key={k.key} class="d-readout-v"><i class={`d-key d-${k.color}`} />{k.label} <b>{num(val(d, k.key))}</b></span>)}
      </div>
      <div ref={ref} class="d-plot">
        {w > 0 && (
          <svg width={w} height={height} role="img" aria-label={`${keys.map(k => k.label).join(' and ')} per day`} tabIndex={0}
            onPointerMove={move} onPointerLeave={() => setPick(null)} onKeyDown={key}>
            {ticks.map(t => <g key={t}><line class="d-gl" x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} /><text class="d-tick" x={padL - 8} y={y(t) + 4} text-anchor="end">{t < 10 && !Number.isInteger(t) ? t.toFixed(1) : compact(t)}</text></g>)}
            {keys.map(k => {
              const pts = rows.map((r, i) => `${x(i)},${y(val(r, k.key))}`).join(' ')
              return <g key={k.key}>
                {area && k.color === 's1' && <polygon class={`d-area d-${k.color}`} points={`${x(0)},${y(0)} ${pts} ${x(n - 1)},${y(0)}`} />}
                <polyline class={`d-line d-${k.color}`} points={pts} />
              </g>
            })}
            <line class="d-cross" x1={x(at)} x2={x(at)} y1={padT} y2={padT + ih} />
            {keys.map(k => <circle key={k.key} class={`d-dot d-${k.color}`} cx={x(at)} cy={y(val(d, k.key))} r={4.5} />)}
            {labelsAt.map(i => <text key={i} class="d-tick" x={x(i)} y={height - 6} text-anchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{shortDay(rows[i].day as string)}</text>)}
          </svg>
        )}
      </div>
      {keys.length > 1 && <div class="d-legend">{keys.map(k => <span key={k.key}><i class={`d-key d-${k.color}`} />{k.label}</span>)}</div>}
    </div>
  )
}

/** Columns for the 24 hours of the day (IST): when people play. Hover names the hour. */
export function HourColumns({ hours }: { hours: number[] }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [pick, setPick] = useState<number | null>(null)
  const top = Math.max(1, ...hours)
  const best = hours.indexOf(Math.max(...hours))
  const height = 140, padB = 20, ih = height - padB - 8
  const band = w / 24, bw = Math.min(24, Math.max(3, band - 2))
  const at = pick ?? best
  const hour = (h: number) => `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`
  return (
    <div class="d-chart">
      <div class="d-readout" aria-live="polite"><span class="d-readout-day">{hour(at)}–{hour((at + 1) % 24)}</span><span class="d-readout-v">Games started <b>{num(hours[at] ?? 0)}</b></span></div>
      <div ref={ref} class="d-plot">
        {w > 0 && (
          <svg width={w} height={height} role="img" aria-label="Games started by hour of the day, IST" onPointerLeave={() => setPick(null)}>
            <line class="d-base" x1={0} x2={w} y1={8 + ih} y2={8 + ih} />
            {hours.map((v, h) => {
              const bh = Math.max(v ? 2 : 0, (v / top) * ih)
              const x0 = h * band + (band - bw) / 2
              return <g key={h} onPointerEnter={() => setPick(h)}>
                <rect x={h * band} y={0} width={band} height={height} fill="transparent" />
                <path class={`d-col ${h === at ? 'is-on' : ''}`} d={colPath(x0, 8 + ih, bw, bh)} />
                {h % 6 === 0 && <text class="d-tick" x={h === 0 ? 0 : h * band + band / 2} y={height - 4} text-anchor={h === 0 ? 'start' : 'middle'}>{hour(h)}</text>}
              </g>
            })}
          </svg>
        )}
      </div>
    </div>
  )
}

/** A column with a 4px rounded top and a square foot on the baseline. */
function colPath(x: number, base: number, w: number, h: number) {
  if (h <= 0) return ''
  const r = Math.min(4, w / 2, h)
  return `M${x},${base}V${base - h + r}Q${x},${base - h} ${x + r},${base - h}H${x + w - r}Q${x + w},${base - h} ${x + w},${base - h + r}V${base}Z`
}

/** Ranked rows with a bar each (HTML, so long labels wrap and screen readers read a list). */
export function Ranked({ rows, empty, format = num, extra }: { rows: { key: string; label: ComponentChildren; n: number; sub?: string }[]; empty: string; format?: (n: number) => string; extra?: string }) {
  if (!rows.length) return <p class="d-empty">{empty}</p>
  const top = Math.max(1, ...rows.map(r => r.n))
  return (
    <ul class="d-ranked">
      {extra && <li class="d-ranked-head" aria-hidden="true"><span /><span>{extra}</span></li>}
      {rows.map(r => (
        <li key={r.key} title={`${typeof r.label === 'string' ? r.label : r.key}: ${format(r.n)}`}>
          <span class="d-ranked-label">{r.label}{r.sub && <small>{r.sub}</small>}</span>
          <span class="d-ranked-n">{format(r.n)}</span>
          <span class="d-ranked-bar" aria-hidden="true"><i style={{ width: `${(r.n / top) * 100}%` }} /></span>
        </li>
      ))}
    </ul>
  )
}

/** A tiny trend for a stat tile: the range in the muted ink, today as the end dot. */
export function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const w = 96, h = 28, top = Math.max(1, ...values)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 6) + 3, h - 3 - (v / top) * (h - 6)])
  const [lx, ly] = pts[pts.length - 1]
  return <svg class="d-spark" width={w} height={h} aria-hidden="true"><polyline points={pts.map(p => p.join(',')).join(' ')} /><circle cx={lx} cy={ly} r={3} /></svg>
}

/** One headline number: label, value, what it is measured against, and a trend. */
export function Tile({ label, value, sub, trend, delta, href }: { label: string; value: string; sub?: string; trend?: number[]; delta?: { text: string; good: boolean | null }; href?: string }) {
  const body = (
    <>
      <span class="d-tile-label">{label}</span>
      <span class="d-tile-row"><b class="d-tile-value">{value}</b>{trend && <Spark values={trend} />}</span>
      {(sub || delta) && <span class="d-tile-sub">{delta && <em class={delta.good === null ? '' : delta.good ? 'is-up' : 'is-down'}>{delta.text}</em>}{sub}</span>}
    </>
  )
  return href ? <a class="d-tile" href={href}>{body}</a> : <div class="d-tile">{body}</div>
}

/** A step-down funnel: each stage as a share of the first, with the number. */
export function Funnel({ steps }: { steps: { label: string; n: number }[] }) {
  const first = Math.max(1, steps[0]?.n ?? 1)
  return (
    <ol class="d-funnel">
      {steps.map((s, i) => (
        <li key={s.label}>
          <span class="d-funnel-label">{s.label}</span>
          <span class="d-funnel-bar" aria-hidden="true"><i style={{ width: `${Math.max(s.n ? 1.5 : 0, (s.n / first) * 100)}%` }} /></span>
          <span class="d-funnel-n"><b>{num(s.n)}</b>{i > 0 && <small>{Math.round((s.n / first) * 100)}%</small>}</span>
        </li>
      ))}
    </ol>
  )
}

/** A meter: share used, coloured by how close it is to the limit (with the words, never colour alone). */
export function Meter({ label, used, limit, text }: { label: string; used: number; limit: number; text: string }) {
  const p = limit > 0 ? Math.min(1, used / limit) : 0
  const lvl = p >= 0.9 ? 'critical' : p >= 0.7 ? 'warn' : 'ok'
  return (
    <div class={`d-meter is-${lvl}`}>
      <div class="d-meter-top"><span>{label}</span><span>{text}{lvl !== 'ok' && <b class="d-meter-flag">{lvl === 'critical' ? ' · near the limit' : ' · getting close'}</b>}</span></div>
      <div class="d-meter-track" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} aria-label={label}><i style={{ width: `${p * 100}%` }} /></div>
    </div>
  )
}
