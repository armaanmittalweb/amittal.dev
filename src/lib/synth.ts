// Every sound on the site, synthesized: filtered noise, a few sine partials, envelopes.
// Recipes only build nodes on whatever context they are given (live or offline);
// lib/audio.ts decides when they play and routes them.
import {
  DIAL, GLOW, KEY_TURN, SWING, WHEEL, ZOOM, cubicBezier, easeInverse, easeSlope,
} from './unlock'

/** Where a recipe builds: a context, the node to feed, the shared noise, and a hook that tracks sources. */
export interface Out {
  ctx: BaseAudioContext
  dest: AudioNode
  noise: AudioBuffer
  src<T extends AudioScheduledSourceNode>(n: T): T
}

/** One scheduled piece of a sound. `at` and `dur` are seconds from the sound's zero time. */
export interface Part {
  label: string
  at: number
  dur: number
  /** Extra moments inside the part worth logging (the dial ticks), in seconds from zero. */
  marks?: number[]
  /**
   * A continuous sound shaped on something moving. If it cannot start on time (a click's
   * sound can't beat the output latency) it joins in progress, `skip` seconds in, so what is
   * heard matches what is on screen, rather than starting late.
   */
  join?: boolean
  play(o: Out, t: number, skip: number): void
}

/** Two seconds of white noise from a fixed seed, made once per context. */
export function makeNoise(ctx: BaseAudioContext) {
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0)
  let a = 0x9e3779b9
  for (let i = 0; i < d.length; i++) {
    a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    d[i] = ((t ^ t >>> 14) >>> 0) / 2147483648 - 1
  }
  return b
}

/* ---------- building blocks ---------- */

const gain = (o: Out, v = 0) => { const n = o.ctx.createGain(); n.gain.value = v; return n }
function filter(o: Out, type: BiquadFilterType, freq: number, Q = .707) {
  const n = o.ctx.createBiquadFilter(); n.type = type; n.frequency.value = freq; n.Q.value = Q; return n
}

/** Looping noise from a random point in the buffer, from t for dur seconds. */
function noise(o: Out, t: number, dur: number, to: AudioNode) {
  const s = o.src(o.ctx.createBufferSource())
  s.buffer = o.noise; s.loop = true
  s.connect(to); s.start(t, Math.random() * (o.noise.duration - .25)); s.stop(t + dur)
  return s
}

/** Silent until t, up to `peak` in `a` seconds, then an exponential decay with time constant tau. */
function strike(p: AudioParam, t: number, peak: number, tau: number, a = .0015) {
  p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + a); p.setTargetAtTime(0, t + a, tau)
}

/**
 * The time span of a continuous part that starts at t and lasts dur, of which `skip` seconds
 * are already past (see Part.join). Its curves run x from skip/dur to 1 over what is left.
 */
function span(t: number, dur: number, skip = 0) {
  const x0 = Math.min(skip / dur, .99), left = dur - dur * x0
  /** Drives a param along shape(x) over the span. Gains joined late fade in over 5 ms instead of stepping. */
  const follow = (p: AudioParam, shape: (x: number) => number, scale = 1, isGain = true, n = 96) => {
    const c = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1)
      c[i] = shape(x0 + (1 - x0) * u) * scale * (isGain && x0 > 0 ? Math.min(1, u * left / .005) : 1)
    }
    p.value = c[0]
    p.setValueCurveAtTime(c, t, left)
  }
  return { t, left, x0, follow, rate: (p: AudioParam, shape: (x: number) => number) => follow(p, shape, 1, false) }
}

/** Fades the first and last few percent of a shape so a curve never starts or stops on a step. */
const edges = (x: number, inn = .02, out = .06) => Math.min(1, x / inn, (1 - x) / out)

interface Mode { f: number; a: number; tau: number }
/** A struck metal or wooden body: a few decaying sine partials. */
function modes(o: Out, t: number, ms: Mode[], level: number, to: AudioNode, tune = 1) {
  for (const m of ms) {
    const osc = o.src(o.ctx.createOscillator()), amp = gain(o)
    osc.frequency.value = m.f * tune
    strike(amp.gain, t, m.a * level, m.tau)
    osc.connect(amp).connect(to)
    osc.start(t); osc.stop(t + .002 + m.tau * 7)
  }
}

/** A short burst of filtered noise: the contact transient of a hit. */
function burst(o: Out, t: number, type: BiquadFilterType, freq: number, Q: number, level: number, tau: number, to: AudioNode) {
  const f = filter(o, type, freq, Q), amp = gain(o)
  noise(o, t, .001 + tau * 7, f)
  strike(amp.gain, t, level, tau, .0006)
  f.connect(amp).connect(to)
}

/** A low sine whose pitch drops as it decays: the weight behind a heavy hit. */
function thump(o: Out, t: number, f0: number, f1: number, drop: number, level: number, tau: number, to: AudioNode) {
  const osc = o.src(o.ctx.createOscillator()), amp = gain(o)
  osc.frequency.setValueAtTime(f0, t); osc.frequency.exponentialRampToValueAtTime(f1, t + drop)
  strike(amp.gain, t, level, tau, .003)
  osc.connect(amp).connect(to)
  osc.start(t); osc.stop(t + .003 + tau * 7)
}

/**
 * Many short clicks from one noise source: each click is a spike on one gain, shaped by
 * shared resonant filters. A ratchet or a row of bolts for five nodes instead of fifty.
 */
function clicks(o: Out, t: number, hits: { t: number; a: number }[], bands: [number, number, number][], level: number, tau: number, to: AudioNode) {
  if (!hits.length) return
  const end = hits[hits.length - 1].t + tau * 8
  const spikes = gain(o), sum = gain(o, level)
  noise(o, t + hits[0].t, end - hits[0].t, spikes)
  for (const h of hits) strike(spikes.gain, t + h.t, h.a, tau, .0004)
  for (const [f, Q, a] of bands) { const b = filter(o, 'bandpass', f, Q), g = gain(o, a); spikes.connect(b).connect(g).connect(sum) }
  sum.connect(to)
}

const part = (label: string, at: number, dur: number, play: (o: Out, t: number) => void, marks?: number[]): Part => ({ label, at, dur, play, marks })
/** A continuous part: see Part.join. */
const join = (label: string, at: number, dur: number, play: (o: Out, t: number, skip: number) => void, marks?: number[]): Part => ({ label, at, dur, play, marks, join: true })

/* ---------- the key ---------- */

/** ISSUE KEY: a few keys on a ring, clinking. */
export function keyJingle(): Part[] {
  const keys: Mode[][] = [
    [{ f: 2380, a: 1, tau: .1 }, { f: 3710, a: .5, tau: .055 }],
    [{ f: 2710, a: 1, tau: .085 }, { f: 4120, a: .45, tau: .045 }],
    [{ f: 1640, a: 1, tau: .14 }, { f: 2980, a: .4, tau: .07 }],
  ]
  const hits = [[0, 0, 1], [.052, 1, .6], [.09, 2, .75], [.16, 0, .45], [.235, 1, .3]]
  return [part('jingle', 0, .6, (o, t) => {
    const lp = filter(o, 'lowpass', 6500); lp.connect(o.dest)
    for (const [dt, k, a] of hits) modes(o, t + dt, keys[k], .1 * a, lp, 1 + (dt * 7 % .02))
    clicks(o, t, hits.map(([dt, , a]) => ({ t: dt, a })), [[4200, 1.5, 1]], .06, .004, lp)
  })]
}

const keyCurve = cubicBezier(...KEY_TURN.curve)
/** Seconds into the key's .55s transition when it has covered `p` of the way. */
const keyAt = (p: number) => KEY_TURN.dur * keyCurve.timeOf(p)

/**
 * The key sliding into the lock: a scrape over the pins as the tip covers its last 24px,
 * then the seat click as it comes to rest (under 1.5px left to travel). `dist` is how far
 * the key has to travel, in CSS px.
 */
export function keyInsert(dist: number): Part[] {
  const when = (px: number) => dist <= px ? 0 : keyAt(1 - px / dist)
  const seat = when(1.5), from = when(24), parts: Part[] = []
  if (seat - from > .04) {
    const pins = [16, 9, 4].map(when).filter(p => p > from + .01 && p < seat - .01)
    parts.push(join('scrape', from, seat - from, (o, t, skip) => {
      const d = seat - from, S = span(t, d, skip), lp = filter(o, 'lowpass', 5200), bp = filter(o, 'bandpass', 1900, 2.2), amp = gain(o)
      noise(o, t, S.left, bp)
      S.rate(bp.frequency, x => 1900 + 1100 * x)
      S.follow(amp.gain, x => edges(x, .12, .1) * (1 - .45 * x), .13)
      bp.connect(amp).connect(lp).connect(o.dest)
      clicks(o, t, pins.map(p => ({ t: p - from - skip, a: 1 })).filter(h => h.t >= 0), [[3400, 6, 1], [2100, 5, .6]], .15, .003, lp)
    }, pins))
  }
  parts.push(part('seat', seat, .2, (o, t) => {
    modes(o, t, [{ f: 1250, a: 1, tau: .035 }, { f: 2890, a: .55, tau: .02 }, { f: 4310, a: .3, tau: .012 }], .08, o.dest)
    thump(o, t, 210, 140, .03, .07, .025, o.dest)
    burst(o, t, 'lowpass', 4000, .7, .06, .003, o.dest)
  }))
  return parts
}

/* ---------- the vault ---------- */

const keyClack = (o: Out, t: number, level = 1) => {
  modes(o, t, [{ f: 980, a: 1, tau: .05 }, { f: 2240, a: .55, tau: .03 }, { f: 3570, a: .3, tau: .018 }], .11 * level, o.dest)
  thump(o, t, 160, 110, .04, .068 * level, .03, o.dest)
  burst(o, t, 'lowpass', 3500, .7, .068 * level, .004, o.dest)
}
const boltClunk = (o: Out, t: number, level = 1) => {
  thump(o, t, 92, 46, .12, .2 * level, .09, o.dest)
  modes(o, t, [{ f: 212, a: 1, tau: .16 }, { f: 487, a: .6, tau: .11 }, { f: 861, a: .4, tau: .07 }, { f: 1390, a: .2, tau: .04 }], .085 * level, o.dest)
  burst(o, t, 'lowpass', 2200, .8, .11 * level, .012, o.dest)
  burst(o, t + .016, 'lowpass', 1600, .8, .07 * level, .014, o.dest)
}

/**
 * The full unlock, in step with lib/unlock.ts. `ring` is the seed's dial offset in degrees:
 * the ratchet ticks each time a long mark on the dial passes 12 o'clock.
 */
export function unlockParts(ring: number): Part[] {
  const parts: Part[] = []

  // The key turns a quarter: two levers lift, then the cam throws.
  for (const p of [.3, .62]) parts.push(part('tumbler', keyAt(p), .08, (o, t) => {
    modes(o, t, [{ f: 1850, a: 1, tau: .02 }, { f: 3300, a: .45, tau: .012 }], .072, o.dest)
    burst(o, t, 'highpass', 2500, .7, .045, .002, o.dest)
  }))
  parts.push(part('cam', keyAt(.96), .3, (o, t) => keyClack(o, t)))

  // The dial: a detent every 30°, louder while it spins fast.
  const step = Math.PI / 6, r0 = (((ring % 30) + 30) % 30) * Math.PI / 180, ticks: { t: number; a: number }[] = []
  for (let th = r0 || step; th < DIAL.turn - 1e-6; th += step) {
    const x = easeInverse(th / DIAL.turn)
    ticks.push({ t: DIAL.at + DIAL.dur * x, a: .35 + .65 * easeSlope(x) / 3 })
  }
  const t0 = ticks[0].t
  parts.push(part('ratchet', t0, ticks[ticks.length - 1].t - t0 + .03, (o, t) => {
    clicks(o, t, ticks.map(k => ({ t: k.t - t0, a: k.a })), [[2250, 9, 1], [3650, 7, .6], [900, 4, .5]], .4, .0035, o.dest)
  }, ticks.map(k => k.t)))

  // The wheel draws the bolts: a geared grind as loud as the wheel is fast.
  parts.push(join('grind', WHEEL.at, WHEEL.dur, (o, t, skip) => {
    const S = span(t, WHEEL.dur, skip), v = (x: number) => easeSlope(x) / 3
    const bp = filter(o, 'bandpass', 420, 1.6), am = gain(o, .55), lfo = o.src(o.ctx.createOscillator()), depth = gain(o, .45)
    const body = gain(o), lp = filter(o, 'lowpass', 170), low = gain(o)
    lfo.type = 'triangle'; S.rate(lfo.frequency, x => 18 + 44 * v(x))
    lfo.connect(depth).connect(am.gain); lfo.start(t); lfo.stop(t + S.left)
    S.rate(bp.frequency, x => 380 + 300 * v(x))
    S.follow(body.gain, x => Math.pow(v(x), .8), .25)
    S.follow(low.gain, v, .21)
    const n = gain(o, 1); noise(o, t, S.left, n)
    n.connect(bp).connect(am).connect(body).connect(o.dest)
    n.connect(lp).connect(low).connect(o.dest)
  }))

  // The bolts hit their stops as the wheel arrives, a moment before the door moves.
  parts.push(part('clunk', SWING.at - .015, .5, (o, t) => boltClunk(o, t)))

  // The seal lets go: a hiss that swells with the light behind the door, then dies away.
  const airDur = GLOW.dur + .6
  parts.push(join('air', GLOW.at, airDur, (o, t, skip) => {
    const s = GLOW.dur / airDur, S = span(t, airDur, skip)
    const bp = filter(o, 'bandpass', 800, .9), lp = filter(o, 'lowpass', 5200), amp = gain(o)
    noise(o, t, S.left, bp)
    S.rate(bp.frequency, x => x < s ? 700 + 1700 * x / s : 2400 - 900 * (x - s) / (1 - s))
    S.follow(amp.gain, x => edges(x, .01, .08) * (x < s ? Math.pow(x / s, 1.3) : Math.exp(-(x - s) * airDur / .18)), .1)
    bp.connect(lp).connect(amp).connect(o.dest)
  }))

  // The door swings on its hinge: a low rumble that follows its speed.
  parts.push(join('swing', SWING.at, SWING.dur, (o, t, skip) => {
    const S = span(t, SWING.dur, skip), v = (x: number) => Math.pow(easeSlope(x) / 3, .9)
    const n = gain(o, 1), lp = filter(o, 'lowpass', 150, .9), bp = filter(o, 'bandpass', 115, 2.5), a = gain(o), b = gain(o)
    noise(o, t, S.left, n)
    S.follow(a.gain, v, .75); S.follow(b.gain, v, .4)
    n.connect(lp).connect(a).connect(o.dest)
    n.connect(bp).connect(b).connect(o.dest)
  }))

  parts.push(zoomWhoosh())
  return parts
}

/** The vault container's zoom past the viewer, following the transition's speed. */
function zoomWhoosh(): Part {
  const z = cubicBezier(...ZOOM.curve), h = .004
  const speed = (x: number) => (z.at(Math.min(1, x + h)) - z.at(Math.max(0, x - h))) / (Math.min(1, x + h) - Math.max(0, x - h))
  let top = 0
  for (let i = 0; i <= 100; i++) top = Math.max(top, speed(i / 100))
  const v = (x: number) => speed(x) / top
  return join('whoosh', ZOOM.at, ZOOM.dur, (o, t, skip) => {
    const S = span(t, ZOOM.dur, skip), bp = filter(o, 'bandpass', 300, .7), amp = gain(o)
    noise(o, t, S.left, bp)
    S.rate(bp.frequency, x => 260 + 1100 * v(x))
    S.follow(amp.gain, x => edges(x) * Math.pow(v(x), 1.2), .19)
    bp.connect(amp).connect(o.dest)
  })
}

/** Reduced motion: the door is simply open, so one compact unlock: the key throws, the bolts clunk. */
export function unlockCompact(): Part[] {
  return [
    part('cam', 0, .3, (o, t) => keyClack(o, t, .85)),
    part('clunk', .05, .5, (o, t) => boltClunk(o, t, .85)),
  ]
}

/** The vault lamp's push button: a small relay pulling in. */
export function relay(): Part[] {
  return [part('relay', 0, .1, (o, t) => {
    modes(o, t, [{ f: 1720, a: 1, tau: .012 }, { f: 3050, a: .45, tau: .008 }], .08, o.dest)
    burst(o, t, 'highpass', 2500, .7, .06, .002, o.dest)
    modes(o, t + .009, [{ f: 2300, a: 1, tau: .008 }], .045, o.dest)
  })]
}

/* ---------- the core ---------- */

/** frame_cabinet eases a picked drawer out as z → 1.2 - (1.2 - z0)·e^(-t/τ), frame-rate independent. */
export const DRAWER_TAU = 1 / (60 * Math.log(1 / .88))

/** A steel drawer running out on ball-bearing slides; `travel` is how far it has to go (0 to 1.2). */
export function drawerSlide(travel: number): Part[] {
  const d = .6, k = Math.max(.25, Math.min(1, travel / 1.2))
  const env = (x: number) => { const s = x * d; return Math.min(1, s / .008) * Math.exp(-s / DRAWER_TAU) * Math.min(1, (1 - x) / .08) }
  return [
    part('latch', 0, .12, (o, t) => modes(o, t, [{ f: 880, a: 1, tau: .025 }, { f: 2050, a: .45, tau: .015 }], .12, o.dest)),
    join('drawer', 0, d, (o, t, skip) => {
      const S = span(t, d, skip)
      const n = gain(o, 1), bp = filter(o, 'bandpass', 1150, 1.3), am = gain(o, .55), lfo = o.src(o.ctx.createOscillator()), depth = gain(o, .45)
      const run = gain(o), body = filter(o, 'bandpass', 190, 3), bodyAmp = gain(o)
      noise(o, t, S.left, n)
      lfo.type = 'triangle'; S.rate(lfo.frequency, x => 20 + 30 * Math.exp(-x * d / DRAWER_TAU))
      lfo.connect(depth).connect(am.gain); lfo.start(t); lfo.stop(t + S.left)
      S.follow(run.gain, env, .25 * k); S.follow(bodyAmp.gain, env, .36 * k)
      n.connect(bp).connect(am).connect(run).connect(o.dest)
      n.connect(body).connect(bodyAmp).connect(o.dest)
    }),
  ]
}

/** A drawer opened with no motion to follow (the text list, or reduced motion): one short thunk. */
export function drawerThunk(): Part[] {
  return [part('thunk', 0, .3, (o, t) => {
    thump(o, t, 120, 80, .05, .17, .04, o.dest)
    modes(o, t, [{ f: 160, a: 1, tau: .08 }, { f: 380, a: .5, tau: .05 }, { f: 720, a: .25, tau: .03 }], .08, o.dest)
    burst(o, t, 'lowpass', 1200, .7, .1, .01, o.dest)
  })]
}

/** A pipeline block knocked out of its seat. */
export function stageDrop(): Part[] {
  return [part('drop', 0, .35, (o, t) => {
    thump(o, t, 140, 70, .08, .13, .05, o.dest)
    modes(o, t, [{ f: 230, a: 1, tau: .07 }, { f: 540, a: .55, tau: .045 }, { f: 980, a: .3, tau: .03 }], .068, o.dest)
    burst(o, t, 'lowpass', 1800, .7, .1, .008, o.dest)
  })]
}

/** A pipeline block snapping back into place. */
export function stageRefit(): Part[] {
  return [part('refit', 0, .15, (o, t) => {
    modes(o, t, [{ f: 1320, a: 1, tau: .018 }, { f: 2650, a: .45, tau: .01 }], .1, o.dest)
    burst(o, t, 'highpass', 1500, .7, .077, .003, o.dest)
    modes(o, t + .028, [{ f: 980, a: 1, tau: .025 }], .066, o.dest)
    thump(o, t + .028, 260, 200, .03, .055, .02, o.dest)
  })]
}

/** Inspect: static under each phase of the screen glitch (0–140ms, 140–260ms, 260–420ms). */
export function glitchStatic(): Part[] {
  const phase = (label: string, at: number, dur: number, f: number, level: number, hum: boolean) => join(label, at, dur, (o, t, skip) => {
    const S = span(t, dur, skip), bp = filter(o, 'bandpass', f, .8), crackle = gain(o), amp = gain(o)
    noise(o, t, S.left, bp)
    // Sample-and-hold crackle: the level jumps every few milliseconds.
    let s = Math.round(f + at * 1000)
    for (let x = 0; x < dur - .004; x += .0035 + (s % 5) * .0008) {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      if (x >= skip) crackle.gain.setValueAtTime(Math.pow((s % 1000) / 1000, 2), t + x - skip)
    }
    S.follow(amp.gain, x => edges(x, .03, .05) * (label === 'static3' ? 1 - .7 * x : 1), level)
    bp.connect(crackle).connect(amp).connect(o.dest)
    if (hum) {
      const osc = o.src(o.ctx.createOscillator()), lp = filter(o, 'lowpass', 420), h = gain(o)
      osc.type = 'sawtooth'; osc.frequency.value = 57
      S.follow(h.gain, x => edges(x, .03, .05), .07)
      osc.connect(lp).connect(h).connect(o.dest); osc.start(t); osc.stop(t + S.left)
    }
  })
  return [phase('static1', 0, .14, 1600, .15, false), phase('static2', .14, .12, 900, .17, true), phase('static3', .26, .16, 2200, .13, false)]
}

/** Research: the projector's shutter as a frame comes up. */
export function shutter(): Part[] {
  return [part('shutter', 0, .2, (o, t) => {
    thump(o, t, 180, 120, .02, .05, .02, o.dest)
    modes(o, t, [{ f: 760, a: 1, tau: .03 }, { f: 1830, a: .5, tau: .02 }, { f: 3100, a: .3, tau: .012 }], .1, o.dest)
    burst(o, t, 'bandpass', 2400, 1, .08, .004, o.dest)
    modes(o, t + .035, [{ f: 690, a: 1, tau: .025 }, { f: 1650, a: .4, tau: .015 }], .06, o.dest)
    burst(o, t + .035, 'bandpass', 2200, 1, .05, .004, o.dest)
  })]
}

/** An easter-egg toast: a rubber stamp coming down on paper. */
export function stamp(): Part[] {
  return [part('stamp', 0, .25, (o, t) => {
    thump(o, t, 130, 75, .04, .19, .035, o.dest)
    burst(o, t, 'lowpass', 700, .7, .155, .02, o.dest)
    burst(o, t, 'bandpass', 1400, .9, .055, .012, o.dest)
  })]
}

/** The logo is a handle: pulled against the latch, it rattles. */
export function rattle(): Part[] {
  return [part('rattle', 0, .3, (o, t) => {
    const knocks = [[0, .11], [.048, .08], [.09, .05]]
    for (const [dt, a] of knocks) modes(o, t + dt, [{ f: 540, a: 1, tau: .05 }, { f: 1260, a: .5, tau: .03 }, { f: 2130, a: .25, tau: .018 }], a, o.dest, 1 + dt * .2)
    clicks(o, t, knocks.map(([dt, a]) => ({ t: dt, a: a / .11 })), [[3000, 1, 1]], .07, .004, o.dest)
    thump(o, t, 170, 130, .03, .06, .03, o.dest)
  })]
}

/** Ten pulls: the vault door slams shut and its bolts run home. */
export function slam(): Part[] {
  const bolts = Array.from({ length: 8 }, (_, k) => ({ t: .09 + k * .028, a: 1 - k * .06 }))
  return [
    part('slam', 0, .9, (o, t) => {
      thump(o, t, 64, 36, .25, .22, .16, o.dest)
      burst(o, t, 'lowpass', 380, .7, .16, .07, o.dest)
      modes(o, t, [{ f: 118, a: 1, tau: .45 }, { f: 271, a: .6, tau: .32 }, { f: 523, a: .4, tau: .2 }, { f: 884, a: .25, tau: .13 }, { f: 1347, a: .12, tau: .08 }], .067, o.dest)
      burst(o, t, 'lowpass', 2500, .7, .1, .01, o.dest)
    }),
    part('bolts', bolts[0].t, bolts[bolts.length - 1].t - bolts[0].t + .03, (o, t) => {
      clicks(o, t, bolts.map(b => ({ t: b.t - bolts[0].t, a: b.a })), [[1500, 5, 1], [2600, 6, .6]], .3, .006, o.dest)
    }, bolts.map(b => b.t)),
    part('lock', .36, .4, (o, t) => {
      thump(o, t, 110, 70, .05, .14, .05, o.dest)
      modes(o, t, [{ f: 340, a: 1, tau: .09 }, { f: 790, a: .5, tau: .05 }], .08, o.dest)
      burst(o, t, 'lowpass', 1800, .7, .08, .008, o.dest)
    }),
  ]
}
