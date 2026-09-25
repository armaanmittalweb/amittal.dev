import type { Material } from '../data/content'
import { CHORDS, derive } from './seed'

interface Drone { ctx: AudioContext; filter: BiquadFilterNode; oscs: OscillatorNode[] }
let drone: Drone | null = null

const CUTOFF: Record<Material, number> = { paper: 380, draft: 900, film: 2200 }

/** A three-note drone tuned from the seed. Only ever started by an explicit click. */
export function startDrone(seed: string, material: Material) {
  if (drone) return
  const d = derive(seed)
  const ctx = new AudioContext()
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = CUTOFF[material]
  const gain = ctx.createGain(); gain.gain.value = 0; gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2)
  filter.connect(gain); gain.connect(ctx.destination)
  const oscs = CHORDS[d.chord].map((r, i) => {
    const o = ctx.createOscillator(); o.type = i ? 'triangle' : 'sine'
    o.frequency.value = d.base * r; o.detune.value = (i - 1) * 4
    o.connect(filter); o.start(); return o
  })
  drone = { ctx, filter, oscs }
}

export function stopDrone() {
  if (!drone) return
  try { drone.oscs.forEach(o => o.stop()); drone.ctx.close() } catch { /* already closed */ }
  drone = null
}

/** The filter opens as the visitor moves from paper to film. */
export function setDroneMaterial(material: Material) {
  if (drone) drone.filter.frequency.setTargetAtTime(CUTOFF[material], drone.ctx.currentTime, 0.8)
}
