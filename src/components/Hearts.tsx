import type { CSSProperties } from 'react'
import { mulberry32 } from '../lib/seed'

// Fixed once, so the hearts don't reshuffle on every render.
const rand = mulberry32(0x1f4)
const HEARTS = Array.from({ length: 18 }, () => ({
  x: rand() * 96, y: rand() * 92, size: 10 + rand() * 20, o: .18 + rand() * .3,
  dur: 11 + rand() * 10, delay: -rand() * 20,
}))

/** Bloom mode: hearts drifting up behind nothing, in front of everything, never in the way. */
export function Hearts() {
  return (
    <div aria-hidden="true">
      {HEARTS.map((h, i) => (
        <span key={i} className="heart" style={{
          left: h.x + 'vw', fontSize: h.size, '--y': h.y, '--o': h.o, '--dur': h.dur + 's', '--delay': h.delay + 's',
        } as CSSProperties} />
      ))}
    </div>
  )
}
