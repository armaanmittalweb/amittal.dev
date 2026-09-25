export type MotionPref = 'system' | 'full' | 'reduced'

const query = () => window.matchMedia('(prefers-reduced-motion: reduce)')

export function systemPrefersReduced() {
  return query().matches
}

export function onSystemMotionChange(cb: () => void) {
  const q = query()
  q.addEventListener('change', cb)
  return () => q.removeEventListener('change', cb)
}

/**
 * The effective setting lives on <html data-motion>, so CSS, the store and the
 * 3D elements all read one answer.
 */
export function isReducedMotion() {
  return document.documentElement.dataset.motion === 'reduced'
}
