// The vault unlock as one timeline, in seconds from the moment the key turns.
// The 3D door (three/vault3d.js), the flat drawing (Entrance), and the unlock
// sounds (lib/sfx.ts) all read it, so they cannot drift apart.

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** easeInOutCubic, the curve every part of the door moves on. */
export const ease = (x: number) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
/** Its slope: 0 at both ends, 3 in the middle. */
export const easeSlope = (x: number) => x < .5 ? 12 * x * x : 3 * Math.pow(-2 * x + 2, 2)
/** The x at which ease(x) reaches y. */
export const easeInverse = (y: number) => y < .5 ? Math.cbrt(y / 4) : 1 - Math.cbrt(2 * (1 - y)) / 2

/** A move on the door: `turn` radians over `dur` seconds, starting `at` seconds in. */
export interface Move { at: number; dur: number; turn: number }
export const DIAL: Move = { at: 0, dur: .7, turn: Math.PI * 4 }
export const WHEEL: Move = { at: .2, dur: .6, turn: -Math.PI * 1.25 }
export const SWING: Move = { at: .8, dur: .9, turn: -1.75 }
/** The light behind the door rises linearly over this span. */
export const GLOW = { at: .7, dur: .5 }
/** The key turns a quarter in the lock, on the key's own CSS transition curve. */
export const KEY_TURN = { dur: .55, curve: [.3, .7, .2, 1] as const }
/** The vault then zooms past the viewer: a CSS transition on its container. */
export const ZOOM = { at: 1.2, dur: 1, curve: [.7, 0, .2, 1] as const }
/** When the Entrance hands over to the next screen, measured from the key turning. */
export const UNLOCK_END = 2.35

export const progress = (m: { at: number; dur: number }, e: number) => clamp01((e - m.at) / m.dur)

/** The door's pose `e` seconds into the unlock. `ring` is the seed's dial offset in degrees. */
export function doorPose(e: number, ring: number) {
  return {
    dial: -ring * Math.PI / 180 + DIAL.turn * ease(progress(DIAL, e)),
    wheel: WHEEL.turn * ease(progress(WHEEL, e)),
    swing: SWING.turn * ease(progress(SWING, e)),
    glow: progress(GLOW, e),
  }
}

/** A CSS cubic-bezier timing function: progress at time fraction x, and the inverse. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const X = (u: number) => ((ax * u + bx) * u + cx) * u
  const Y = (u: number) => ((ay * u + by) * u + cy) * u
  const solve = (f: (u: number) => number, v: number) => {
    let lo = 0, hi = 1
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (f(m) < v) lo = m; else hi = m }
    return (lo + hi) / 2
  }
  return {
    /** Progress at time fraction x. */
    at: (x: number) => Y(solve(X, clamp01(x))),
    /** Time fraction at which progress reaches y. */
    timeOf: (y: number) => X(solve(Y, clamp01(y))),
  }
}

/**
 * easeInOutCubic as a CSS/WAAPI easing. `linear()` follows the curve to within half a
 * degree of the dial; browsers without it get the usual cubic-bezier stand-in.
 */
export function easeCss() {
  const pts = Array.from({ length: 51 }, (_, i) => +ease(i / 50).toFixed(5))
  const exact = `linear(${pts.join(', ')})`
  try { if (CSS.supports('animation-timing-function', 'linear(0, 1)')) return exact } catch { /* no CSS.supports */ }
  return 'cubic-bezier(.65,0,.35,1)'
}
