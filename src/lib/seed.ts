import { PROJECTS } from '../data/content'

const HUES = [28, 145, 230, 300, 85]
export const CHORDS = [[1, 1.5, 2.25], [1, 1.2, 1.5], [1, 1.335, 2], [1, 1.25, 1.875]]
export const MISFILE_DRAWERS = ['identity', 'capabilities', 'resume'] as const

export function mulberry32(a: number) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

/** A random 64-bit session seed as 16 hex characters. Presentation only, not a secret. */
export function newSeed() {
  const b = new Uint8Array(8)
  crypto.getRandomValues(b)
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('').toUpperCase()
}

export interface Derived {
  hue: number
  ring: number
  tagRot: string
  order: string[]
  base: number
  chord: number
  misfiled: typeof MISFILE_DRAWERS[number]
  rots: number[]
}

const cache = new Map<string, Derived>()

/** Everything that varies between visitors, derived from the seed in a fixed order. */
export function derive(seed: string): Derived {
  const hit = cache.get(seed)
  if (hit) return hit
  const rng = mulberry32(parseInt(seed.slice(0, 8), 16) ^ parseInt(seed.slice(8), 16))
  const hue = HUES[Math.floor(rng() * HUES.length)], ring = Math.floor(rng() * 360), tagRot = (rng() * 10 - 5).toFixed(1)
  const order = PROJECTS.map(p => p.id)
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]] }
  const base = 48 + Math.round(rng() * 30), chord = Math.floor(rng() * CHORDS.length)
  const misfiled = MISFILE_DRAWERS[Math.floor(rng() * 3)]
  const rots = Array.from({ length: 12 }, () => +(rng() * 10 - 5).toFixed(1))
  const d = { hue, ring, tagRot, order, base, chord, misfiled, rots }
  cache.set(seed, d)
  return d
}
