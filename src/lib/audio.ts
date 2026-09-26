// The site's one AudioContext: created on the first click that needs it, never on load.
// Effects and the drone each have a bus; both feed a master gain and a limiter.
//   sfx bus ─┐
//   drone bus ┴─ master ─ limiter ─ speakers
//   warm-up ── 6 ms delay ────────┘   (only for sounds in the context's first 250 ms, see WARMUP)
// Recipes live in lib/synth.ts; this file decides when they sound.
import type { Material } from '../data/content'
import { CHORDS, derive } from './seed'
import { makeNoise, type Out, type Part } from './synth'

export interface Handle { cancel(): void }
const NONE: Handle = { cancel() {} }

interface Seq {
  name: string
  /** performance.now() moment the parts are timed from. */
  zero: number
  late: number
  born: number
  /** Parts not yet scheduled. */
  parts: Part[] | null
  /** Its own gain on each output path it uses, so cancel() can fade just this sound. */
  buses: { to: AudioNode; gain: GainNode }[]
  sources: Set<AudioScheduledSourceNode>
  done: boolean
  logs: SfxLogEntry[]
}

/** Dev-only record of what was scheduled, for the browser tests. Stripped from production builds. */
export interface SfxLogEntry {
  name: string
  part: string
  /** performance.now() when it was scheduled (or skipped). */
  at: number
  /** The frame time (performance.now() clock) of the moment on screen it belongs to. It is meant to be heard DISPLAY_LAG later. */
  wall: number
  /** The AudioContext time it was scheduled for; null when skipped for being late. */
  audioAt: number | null
  dur: number
  /** Seconds of a continuous part already past when it started (it joined in progress). */
  skip: number
  marks?: number[]
  cancelled?: number
}

declare global {
  interface Window {
    __sfxLog?: SfxLogEntry[]
    __sfx?: { ctx: AudioContext; level(): number; clock(): { contextTime: number; performanceTime: number; currentTime: number; now: number } }
    webkitAudioContext?: typeof AudioContext
  }
}

let ctx: AudioContext | null = null
let broken = false
let enabled = true
let noise: AudioBuffer
let master: GainNode, sfxBus: GainNode, droneBus: GainNode, warm: GainNode
let sleepTimer: ReturnType<typeof setTimeout> | undefined
/** The context's clock reads true from this audio time on: 100 ms after it last started running. */
let steadyFrom = .1
const live = new Set<Seq>()

/**
 * The limiter only catches pile-ups: nothing is meant to reach its threshold. Browsers add
 * make-up gain for any threshold (about +0.6 dB for these settings), so master takes it back.
 */
const MASTER = .935
/** Browsers' DynamicsCompressor delays its input by a fixed 6 ms of look-ahead. */
const LIMITER_DELAY = .006
/** A frame stamped t by requestAnimationFrame reaches the screen about one frame later. */
const DISPLAY_LAG = 16
/** Never schedule closer to now than this: the render quantum in flight may have started. */
const LEAD = .008
/**
 * A new DynamicsCompressor's detector starts from zero and takes about 150 ms of running to
 * open, so a click in that window would come out up to 11 dB quiet and swell in. Sounds that
 * begin in the context's first 250 ms (usually the click that created it) skip the limiter
 * through a matching 6 ms delay instead. They are single effects far below full scale.
 */
const WARMUP = .25
/**
 * While the clock is still settling, impulsive parts due within this many ms are placed with
 * the latency estimate (they could not be placed any better: the device is only just
 * starting); everything else waits for the steady clock.
 */
const SOON = 150
/** How long a sequence waits for the output clock to report a usable timestamp. */
const STEADY_WAIT = 500
/** With nothing playing for this long, the context is suspended; the next press wakes it (in ~20 ms). */
const IDLE = 4000

/** Only inside a click, tap or key press may the site start (or restart) audio. */
function inGesture() {
  const ua = navigator.userActivation
  return ua ? ua.isActive : true
}

function context(create: boolean): AudioContext | null {
  if (ctx) {
    if (ctx.state === 'suspended' && create && !document.hidden && inGesture()) ctx.resume().catch(() => {})
    return ctx
  }
  if (!create || broken || !inGesture()) return null
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) throw new Error('no Web Audio')
    const c = new AC({ latencyHint: 'interactive' })
    const limiter = c.createDynamicsCompressor()
    limiter.threshold.value = -1; limiter.knee.value = 0; limiter.ratio.value = 20
    limiter.attack.value = .002; limiter.release.value = .2
    master = c.createGain(); master.gain.value = MASTER
    sfxBus = c.createGain(); droneBus = c.createGain()
    sfxBus.connect(master); droneBus.connect(master)
    master.connect(limiter).connect(c.destination)
    warm = c.createGain()
    const lag = c.createDelay(.05); lag.delayTime.value = LIMITER_DELAY
    warm.connect(lag).connect(c.destination)
    noise = makeNoise(c)
    c.addEventListener('statechange', () => {
      if (c.state !== 'running') return
      steadyFrom = c.currentTime + .1
      live.forEach(begin)
    })
    document.addEventListener('visibilitychange', onVisibility)
    if (import.meta.env.DEV) devTap(c, [limiter, lag])
    ctx = c
    if (c.state === 'suspended') c.resume().catch(() => {})
    sleepSoon(IDLE)
    return c
  } catch {
    broken = true
    return null
  }
}

/**
 * The output timestamp, once it can be trusted. A context that has just started (or resumed)
 * reports currentTime 0 or a frozen time until its audio thread runs, then for a few tens of
 * ms an output timestamp and output latency that are still settling (off by 20-50 ms), so
 * the first 100 ms of audio after each start are ignored.
 */
function outputStamp(c: AudioContext) {
  if (c.currentTime < steadyFrom || !c.getOutputTimestamp) return null
  const ts = c.getOutputTimestamp()
  return ts.contextTime && ts.performanceTime && Math.abs(performance.now() - ts.performanceTime) < 1000 ? ts : null
}
const clockSteady = (c: AudioContext) => c.currentTime >= steadyFrom && (!c.getOutputTimestamp || !!outputStamp(c))

/**
 * The AudioContext time at which a sound must start to be heard as the frame stamped
 * `wall` (a performance.now() time) is seen. Uses the output timestamp where the browser
 * reports one, which already includes the device's output latency; otherwise the
 * context's latency estimates.
 */
export function audioTimeAt(c: AudioContext, wall: number) {
  const target = wall + DISPLAY_LAG, ts = outputStamp(c)
  const t = ts
    ? ts.contextTime! + (target - ts.performanceTime!) / 1000
    : c.currentTime + (target - performance.now()) / 1000 - (c.baseLatency || 0) - (c.outputLatency || 0)
  return t - LIMITER_DELAY
}

/**
 * Plays a sound. `zero` is the performance.now() moment its parts are timed from (default:
 * now). A part whose moment has passed by more than `late` ms when the context is running
 * is skipped rather than played late. The handle's cancel() fades out in 50 ms.
 */
export function play(name: string, parts: Part[], opt: { zero?: number; late?: number } = {}): Handle {
  if (!enabled || !parts.length) return NONE
  const c = context(true)
  if (!c) return NONE
  const now = performance.now()
  const seq: Seq = { name, zero: opt.zero ?? now, late: opt.late ?? 25, born: now, parts, buses: [], sources: new Set(), done: false, logs: [] }
  live.add(seq)
  if (c.state === 'running') begin(seq)
  return { cancel: () => cancel(seq) }
}

/**
 * Schedules every part that is still on time. Parts due now play as soon as possible; later
 * ones wait for a steady clock so they land exactly. Waits for the context if it isn't running.
 */
function begin(seq: Seq) {
  const c = ctx
  if (!c || !seq.parts || c.state !== 'running') return
  const now = performance.now(), steady = clockSteady(c) || now - seq.born > STEADY_WAIT
  const due: Part[] = [], later: Part[] = []
  // Until the clock is steady only impulsive parts due now go out (as early as they can); a
  // continuous part waits and then joins in progress, in phase with what is on screen.
  for (const p of seq.parts) (steady || (!p.join && seq.zero + p.at * 1000 <= now + SOON) ? due : later).push(p)
  seq.parts = later.length ? later : null
  for (const p of due) {
    const wall = seq.zero + p.at * 1000, ideal = audioTimeAt(c, wall), t = Math.max(c.currentTime + LEAD, ideal)
    // A continuous part that can't start on time joins in progress; anything else that is late is dropped.
    const skip = p.join ? t - ideal : 0
    if (p.join ? skip > p.dur - .03 : wall + seq.late < now) { if (import.meta.env.DEV) log(seq, p, wall, null, 0); continue }
    p.play(output(seq, c, t < WARMUP), t, skip)
    if (import.meta.env.DEV) log(seq, p, wall, t, skip)
  }
  if (later.length) setTimeout(() => begin(seq), 10)
  else if (!seq.sources.size) finish(seq)
}

/** Where a sequence's part plays: its own gain on the limited bus, or on the warm-up path. */
function output(seq: Seq, c: AudioContext, early: boolean): Out {
  const to = early ? warm : sfxBus
  let bus = seq.buses.find(b => b.to === to)
  if (!bus) {
    bus = { to, gain: c.createGain() }
    bus.gain.connect(to)
    seq.buses.push(bus)
  }
  return {
    ctx: c, dest: bus.gain, noise,
    src: n => {
      seq.sources.add(n)
      n.onended = () => { seq.sources.delete(n); if (!seq.sources.size && !seq.parts) finish(seq) }
      return n
    },
  }
}

function finish(seq: Seq) {
  if (seq.done) return
  seq.done = true
  seq.buses.forEach(b => b.gain.disconnect())
  live.delete(seq)
  if (!live.size) sleepSoon(IDLE)
}

function cancel(seq: Seq) {
  if (seq.done) return
  if (import.meta.env.DEV) { const now = performance.now(); seq.logs.forEach(l => { l.cancelled ??= now }) }
  seq.parts = null
  if (!ctx || !seq.sources.size) { finish(seq); return }
  const t = ctx.currentTime
  for (const b of seq.buses) { const g = b.gain.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + .05) }
  for (const s of seq.sources) try { s.stop(t + .06) } catch { /* never started */ }
}

/** Fades out every effect in flight. The drone is separate: see stopDrone(). */
export function cancelAll() { live.forEach(cancel) }

/** The master switch. Off cancels effects in flight, and lets the context sleep once they have faded. */
export function setSoundEnabled(on: boolean) {
  if (on === enabled) return
  enabled = on
  if (on) return
  cancelAll()
  sleepSoon(250)
}

/**
 * Call on the press (pointerdown, or a key) of anything that will make a sound. It creates or
 * wakes the context then, so the one-time cost of creating it (40-50 ms of main thread on
 * some systems) falls in the press, before anything starts moving, and it is running by the click.
 */
export function primeAudio() {
  if (enabled) context(true)
}

/** Whether anything needs the context running. */
const needed = () => enabled && !document.hidden && (live.size > 0 || drone !== null)

/** Suspends the context after `ms`, unless by then something needs it. Suspended, it costs nothing. */
function sleepSoon(ms: number) {
  clearTimeout(sleepTimer)
  sleepTimer = setTimeout(() => { if (ctx?.state === 'running' && !needed()) ctx.suspend().catch(() => {}) }, ms)
}

// A hidden tab goes quiet: effects in flight are cancelled (they would be out of step on
// return) and the context is suspended, which also pauses the drone where it is.
function onVisibility() {
  const c = ctx
  if (!c) return
  const t = c.currentTime
  const ramp = (g: AudioParam, to: number, dt: number) => { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to, t + dt) }
  if (document.hidden) {
    cancelAll()
    ramp(master.gain, 0, .04); ramp(warm.gain, 0, .04)
    sleepSoon(60)
  } else {
    ramp(master.gain, MASTER, enabled ? .12 : 0); ramp(warm.gain, 1, enabled ? .12 : 0)
    // Only the drone picks up where it left off; effects were cancelled on the way out.
    if (needed() && c.state === 'suspended') c.resume().catch(() => {})
  }
}

/* ---------- the drone ---------- */

interface Drone { filter: BiquadFilterNode; gain: GainNode; oscs: OscillatorNode[] }
let drone: Drone | null = null

const CUTOFF: Record<Material, number> = { paper: 380, draft: 900, film: 2200 }

/** A three-note drone tuned from the seed. Only ever started by an explicit click. */
export function startDrone(seed: string, material: Material) {
  if (drone || !enabled) return
  const c = context(true)
  if (!c) return
  const d = derive(seed), t = c.currentTime
  const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = CUTOFF[material]
  const gain = c.createGain(); gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.05, t + 2)
  filter.connect(gain).connect(droneBus)
  const oscs = CHORDS[d.chord].map((r, i) => {
    const o = c.createOscillator(); o.type = i ? 'triangle' : 'sine'
    o.frequency.value = d.base * r; o.detune.value = (i - 1) * 4
    o.connect(filter); o.start(t); return o
  })
  drone = { filter, gain, oscs }
}

/** Fades the drone out over 150 ms, then stops it. */
export function stopDrone() {
  if (!drone || !ctx) return
  const { gain, oscs } = drone, t = ctx.currentTime, g = gain.gain
  drone = null
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + .15)
  oscs.forEach(o => o.stop(t + .16))
  oscs[0].onended = () => gain.disconnect()
  sleepSoon(IDLE)
}

/** The filter opens as the visitor moves from paper to film. */
export function setDroneMaterial(material: Material) {
  if (drone && ctx) drone.filter.frequency.setTargetAtTime(CUTOFF[material], ctx.currentTime, 0.8)
}

/* ---------- dev instrumentation (removed from production builds) ---------- */

function log(seq: Seq, p: Part, wall: number, audioAt: number | null, skip: number) {
  const e: SfxLogEntry = { name: seq.name, part: p.label, at: performance.now(), wall, audioAt, dur: p.dur, skip }
  if (p.marks) e.marks = p.marks.map(m => seq.zero + m * 1000)
  seq.logs.push(e)
  ;(window.__sfxLog ??= []).push(e)
}

function devTap(c: AudioContext, from: AudioNode[]) {
  const an = c.createAnalyser(), buf = new Float32Array(2048)
  an.fftSize = 2048
  from.forEach(n => n.connect(an))
  window.__sfx = {
    ctx: c,
    /** Peak level of the last 2048 samples at the output. */
    level: () => { an.getFloatTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v)); return m },
    clock: () => { const ts = c.getOutputTimestamp(); return { contextTime: ts.contextTime ?? 0, performanceTime: ts.performanceTime ?? 0, currentTime: c.currentTime, now: performance.now() } },
  }
}
