import { flushSync } from 'react-dom'
import { isReducedMotion } from './motion'

interface ViewTransition { ready: Promise<void>; finished: Promise<void>; skipTransition(): void }
type WithViewTransitions = Document & { startViewTransition?: (update: () => void) => ViewTransition }

let running: Promise<void> = Promise.resolve()
let current: ViewTransition | null = null
let seq = 0

// While a transition plays, the page under it can't be hit: a click lands on <html> and
// would be lost (rapid pulls on the logo, a quick second tap in the menu). A click means
// the visitor has moved on, so the transition ends at once and the click goes to whatever
// is under the pointer on the new page.
document.addEventListener('click', e => {
  const vt = current
  if (!vt || e.target !== document.documentElement) return
  const { clientX: x, clientY: y } = e
  vt.skipTransition()
  vt.finished.catch(() => {}).then(() => { (document.elementFromPoint(x, y) as HTMLElement | null)?.click() })
}, true)

/**
 * Swaps one screen or drawer for the next as a View Transition. By default the old page
 * fades out onto the new page's colour (the root's background is the theme's --bg), then
 * the new page rises in; `kind` picks another pair of animations from app.css through
 * <html data-vt>. Without the API, with reduced motion, or in a hidden tab, the swap is
 * instant. Returns the transition, or null when there isn't one.
 */
export function transition(update: () => void, kind = 'page'): ViewTransition | null {
  const doc = document as WithViewTransitions
  if (!doc.startViewTransition || isReducedMotion() || document.hidden) { update(); return null }
  const root = document.documentElement, mine = ++seq
  root.dataset.vt = kind
  const vt = doc.startViewTransition(() => flushSync(update))
  current = vt
  // A transition started over this one skips it; only the latest clears the attribute.
  running = vt.finished.catch(() => {}).finally(() => { if (seq === mine) { delete root.dataset.vt; current = null } })
  return vt
}

/** Resolves once the page transition in progress, if any, has finished. 3D views start after it. */
export const settled = () => running
