import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { DIAL, GLOW, SWING, WHEEL, doorPose, easeCss } from '../lib/unlock'

// The flat door, drawn to the 3D camera's framing: the scene is 2 × 1.2326 units tall and the
// SVGs are 800 units, so one scene unit is 400 / 1.2326 drawing units.
const U = 400 / 1.2326
const C = 400
const r = (units: number) => +(units * U).toFixed(1)
// The door hangs on a hinge at x = -1.02 units, as the 3D door's pivot does.
const HINGE = ((C - 1.02 * U) / 800 * 100).toFixed(2) + '% 50%'
// The 3D camera sits 4.6 units from the door; as CSS perspective, in px of the drawing's size.
const PERSPECTIVE = 4.6 / 2.4652

const deg = (rad: number) => rad * 180 / Math.PI
/**
 * A door pose as CSS angles. three.js turns counter-clockwise for positive z and CSS
 * clockwise, so the dial and wheel flip sign; rotateY has the same sense in both.
 */
const css = (p: ReturnType<typeof doorPose>) => ({ dial: -deg(p.dial), wheel: -deg(p.wheel), swing: deg(p.swing), glow: .04 + .96 * p.glow })

const layer: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }
const face: CSSProperties = { ...layer, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }

/**
 * The vault door drawn flat: shown until the 3D door is actually rendering, and for good
 * without WebGL. It plays the same unlock timeline (lib/unlock.ts) from the same start
 * time, so it can hand over to the 3D door mid-swing without a jump, and the unlock sounds
 * match whichever one is on screen.
 */
export function VaultDrawing({ seed, ring, hue, size, openedAt, reduced }: {
  seed: string; ring: number; hue: number; size: number; openedAt: number | null; reduced: boolean
}) {
  const dial = useRef<SVGSVGElement>(null), wheel = useRef<SVGSVGElement>(null)
  const door = useRef<HTMLDivElement>(null), glow = useRef<SVGGElement>(null)

  // With reduced motion the door is simply open; otherwise it rests closed and the
  // animations below carry it open, each pinned to the shared start time.
  const at = css(doorPose(openedAt != null && reduced ? 99 : 0, ring))

  useLayoutEffect(() => {
    if (openedAt == null || reduced) return
    const runs: Animation[] = []
    const run = (el: Element | null, frames: Keyframe[], m: { at: number; dur: number }, ease: string) => {
      if (!el) return
      const a = el.animate(frames, { duration: m.dur * 1000, delay: m.at * 1000, easing: ease, fill: 'both' })
      a.startTime = openedAt
      runs.push(a)
    }
    const from = css(doorPose(0, ring)), to = css(doorPose(99, ring)), easing = easeCss()
    run(dial.current, [{ transform: `rotate(${from.dial}deg)` }, { transform: `rotate(${to.dial}deg)` }], DIAL, easing)
    run(wheel.current, [{ transform: `rotate(${from.wheel}deg)` }, { transform: `rotate(${to.wheel}deg)` }], WHEEL, easing)
    run(door.current, [{ transform: `rotateY(${from.swing}deg)` }, { transform: `rotateY(${to.swing}deg)` }], SWING, easing)
    run(glow.current, [{ opacity: from.glow }, { opacity: to.glow }], GLOW, 'linear')
    return () => runs.forEach(a => a.cancel())
  }, [openedAt, reduced, ring])

  const bolts = [8, 10, 12, 16][parseInt(seed.slice(-2), 16) % 4]
  // The 3D glow is the seed colour at 55% saturation, which its filmic tone mapping washes out to a pale tint.
  const glowColor = `hsl(${hue} 20% 72%)`
  const steel = 'url(#vd-steel)'

  return (
    <div role="img" aria-label="The vault door" data-part="drawing" style={{ ...layer, perspective: Math.round(size * PERSPECTIVE) + 'px' }}>
      <svg viewBox="0 0 800 800" style={layer} aria-hidden="true">
        <defs>
          <radialGradient id="vd-steel" cx="38%" cy="32%" r="80%">
            <stop offset="0" stopColor="#a39e93" /><stop offset=".6" stopColor="#8d887e" /><stop offset="1" stopColor="#5f5b53" />
          </radialGradient>
          <radialGradient id="vd-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset=".7" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r={r(1.14)} fill="none" stroke="#2a251e" strokeWidth={r(.12)} />
        <circle cx={C} cy={C} r={r(1.02)} fill="#050404" />
        <g ref={glow} data-part="glow" style={{ opacity: at.glow }}>
          <circle cx={C} cy={C} r={r(1.02)} fill={glowColor} />
          <circle cx={C} cy={C} r={r(1.02)} fill="url(#vd-glow)" />
        </g>
        <circle cx={C} cy={C} r={r(1.08)} fill="none" stroke="#3a3731" strokeWidth={r(.18)} />
        <circle cx={C} cy={C} r={r(1.08) - r(.05)} fill="none" stroke="#4a463f" strokeWidth={2} />
      </svg>
      <div ref={door} data-part="door" style={{ ...layer, transformOrigin: HINGE, transformStyle: 'preserve-3d', transform: `rotateY(${at.swing}deg)` }}>
        <div style={face}>
          <svg viewBox="0 0 800 800" style={layer} aria-hidden="true">
            <circle cx={C} cy={C} r={r(1)} fill={steel} />
            <circle cx={C} cy={C} r={r(.93)} fill="none" stroke="#3a3731" strokeWidth={r(.05)} />
            <circle cx={C} cy={C} r={r(.62)} fill="none" stroke="#3a3731" strokeWidth={r(.024)} />
            {Array.from({ length: bolts }, (_, i) => {
              const a = i / bolts * Math.PI * 2
              return <circle key={i} cx={C + Math.cos(a) * r(.965)} cy={C - Math.sin(a) * r(.965)} r={r(.035)} fill="#c29d56" stroke="#8d6c30" strokeWidth={1.5} />
            })}
          </svg>
          <svg ref={dial} data-part="dial" viewBox="0 0 800 800" style={{ ...layer, transform: `rotate(${at.dial}deg)` }} aria-hidden="true">
            <circle cx={C} cy={C} r={r(.76)} fill="none" stroke="#5a564d" strokeWidth={r(.2)} />
            {Array.from({ length: 60 }, (_, i) => {
              const long = i % 5 === 0, a = i / 60 * Math.PI * 2, mid = long ? .79 : .81, half = long ? .05 : .025
              const x = Math.sin(a), y = -Math.cos(a)
              return <line key={i} x1={C + x * r(mid - half)} y1={C + y * r(mid - half)} x2={C + x * r(mid + half)} y2={C + y * r(mid + half)}
                stroke={long ? '#d9b76e' : '#2e2b26'} strokeWidth={long ? 5 : 3} />
            })}
          </svg>
          <svg ref={wheel} data-part="wheel" viewBox="0 0 800 800" style={{ ...layer, transform: `rotate(${at.wheel}deg)` }} aria-hidden="true">
            {[0, 1, 2].map(i => {
              const a = i / 3 * Math.PI * 2 + Math.PI / 6, x = Math.cos(a), y = -Math.sin(a)
              return (
                <g key={i}>
                  <line x1={C + x * r(.3)} y1={C + y * r(.3)} x2={C + x * r(.62)} y2={C + y * r(.62)} stroke="#77736a" strokeWidth={r(.064)} strokeLinecap="round" />
                  <circle cx={C + x * r(.63)} cy={C + y * r(.63)} r={r(.065)} fill="#c29d56" stroke="#8d6c30" strokeWidth={2} />
                </g>
              )
            })}
            <circle cx={C} cy={C} r={r(.31)} fill={steel} stroke="#4a463f" strokeWidth={3} />
          </svg>
          <svg viewBox="0 0 800 800" style={layer} aria-hidden="true">
            <circle cx={C} cy={C} r={r(.2)} fill="#c29d56" stroke="#8d6c30" strokeWidth={2} />
            <circle cx={C} cy={C - r(.08)} r={r(.075)} fill="#080706" />
            <rect x={C - r(.03)} y={C + r(.04) - r(.1)} width={r(.06)} height={r(.2)} fill="#080706" />
          </svg>
        </div>
        {/* Past 90° the door shows its back edge-on, as the 3D slab does. */}
        <div style={{ ...face, transform: 'rotateY(180deg)' }}>
          <svg viewBox="0 0 800 800" style={layer} aria-hidden="true"><circle cx={C} cy={C} r={r(1)} fill="#4a463f" /></svg>
        </div>
      </div>
    </div>
  )
}
