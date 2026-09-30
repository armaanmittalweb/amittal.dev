import type { Day, Line } from './api'
import type { LampState } from './ui'

/** Share of checks that passed, in percent, or null before the first check. */
export function uptimePct(days: Day[]) {
  const up = days.reduce((a, d) => a + d.up, 0), total = days.reduce((a, d) => a + d.total, 0)
  return total ? (up / total) * 100 : null
}

/** A line's lamp: planned until it is watched, idle until its first check, then up or down. */
export function lineState(l: Line): LampState {
  if (!l.live) return 'planned'
  const last = l.recent[0]
  if (!last) return 'idle'
  return last.ok ? 'up' : 'down'
}
