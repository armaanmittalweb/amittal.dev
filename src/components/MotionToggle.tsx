import type { CSSProperties } from 'react'
import { useReducedMotion } from '../hooks'
import { useArchive } from '../store'

/** Overrides the OS reduced-motion setting for this site. */
export function MotionToggle({ plain, className, style }: { plain?: boolean; className?: string; style?: CSSProperties }) {
  const reduced = useReducedMotion()
  const setMotion = useArchive(s => s.setMotion)
  const base: CSSProperties = plain
    ? { background: 'transparent', border: 0, padding: '6px 0', color: 'inherit', cursor: 'pointer', font: 'inherit', letterSpacing: 'inherit' }
    : {}
  return (
    <button type="button" className={className} style={{ ...base, ...style }} title={reduced ? 'Switch to full motion' : 'Switch to reduced motion'}
      onClick={() => setMotion(reduced ? 'full' : 'reduced')}>
      MOTION · {reduced ? 'REDUCED' : 'FULL'}
    </button>
  )
}
