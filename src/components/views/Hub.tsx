import { useEffect, useLayoutEffect, useRef } from 'react'
import { CABINET, MATERIAL } from '../../data/content'
import { isReducedMotion } from '../../lib/motion'
import { derive } from '../../lib/seed'
import { sfx } from '../../lib/sfx'
import { useArchive } from '../../store'
import { useSceneAvailable } from '../../lib/scene'
import { Archivist } from '../Archivist'
import { Brief } from '../Brief'
import { Archive3D } from '../Scene'
import { DrawerHead } from '../ui'

/** Without WebGL the cabinet becomes a plain list of its drawers. */
function DrawerList() {
  const visited = useArchive(s => s.visited)
  const openKey = useArchive(s => s.openKey)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1.5px solid var(--ink)' }}>
      {CABINET.map(([num, label, key, mat, desc]) => (
        <button key={key} type="button" onClick={() => { sfx.drawerThunk(); openKey(key) }} className="hover-shade"
          style={{ display: 'grid', gridTemplateColumns: '34px 1fr auto', gap: 12, alignItems: 'baseline', textAlign: 'left', padding: '12px 4px', background: 'transparent', border: 0, borderBottom: '1px solid var(--line)', color: 'var(--ink)', cursor: 'pointer' }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{num}</span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="stencil" style={{ fontWeight: 700, fontSize: 22, letterSpacing: '.06em' }}>{label}</span>
            <span style={{ fontSize: 15, color: 'var(--muted)' }}>{desc}</span>
          </span>
          <span className="mono" style={{ fontSize: 9, letterSpacing: '.12em', color: visited[key] ? 'var(--accent)' : 'var(--muted)' }}>{visited[key] ? 'RECOVERED' : mat.toUpperCase()}</span>
        </button>
      ))}
    </div>
  )
}

/** Names the drawer under the pointer. Its own component, so hovering doesn't re-render the Core. */
function CabinetHint() {
  const cabHover = useArchive(s => s.cabHover)
  const hovered = cabHover != null ? CABINET[cabHover] : null
  return (
    <div className="mono" aria-hidden="true" style={{ fontSize: 10, letterSpacing: '.12em', color: hovered ? 'var(--ink)' : 'var(--muted)', minHeight: 16 }}>
      {hovered ? hovered[0] + ' ' + hovered[1] + ' · ' + hovered[4].toUpperCase() : 'PULL A DRAWER TO OPEN IT · DRAG TO TURN THE CABINET'}
    </div>
  )
}

// Once an answer comes back with results, a wide Core splits: the title and cabinet on the
// left, the answer beside them, filling the height. The CSS does the layout (app.css,
// .core-grid); this only lets the moves be seen.
const hasResults = (s: { answer: { cards: unknown[] } | null }) => !!s.answer?.cards.length
const EASE = 'cubic-bezier(.2,.8,.2,1)'

export function Hub() {
  const seed = useArchive(s => s.seed) || '0000000000000000'
  const visited = useArchive(s => s.visited)
  const split = useArchive(hasResults)
  const sceneOk = useSceneAvailable()
  const cabRef = useRef<HTMLDivElement>(null), briefRef = useRef<HTMLDivElement>(null)
  const before = useRef<DOMRect | null>(null)

  // Where the cabinet stood, taken as the store changes and before React moves it.
  useEffect(() => useArchive.subscribe((s, prev) => {
    if (hasResults(s) !== hasResults(prev) && cabRef.current) before.current = cabRef.current.getBoundingClientRect()
  }), [])
  // The cabinet glides from there to its new place (it stays mounted, so the scene keeps
  // drawing as it goes) and the brief rises into its own. A narrow Core doesn't split, so
  // nothing has moved sideways and nothing plays.
  useLayoutEffect(() => {
    const from = before.current, cab = cabRef.current, brief = briefRef.current
    before.current = null
    if (!from || !cab || !brief || isReducedMotion()) return
    const to = cab.getBoundingClientRect()
    const dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top - to.top
    if (Math.abs(dx) < 2) return
    cab.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 620, easing: EASE })
    brief.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 160, easing: EASE, fill: 'backwards' })
  }, [split])

  return (
    <div data-screen-label="03 Core" className="core-wrap">
      <div className="core-grid" data-split={split || undefined}>
        <div className="cg-head">
          <DrawerHead kicker="DRAWER 00 · INDEX" title="THE CORE" size="clamp(40px,11vw,96px)" lineHeight={.85}
            lead="Records, projects and decisions, filed as they were made. Open a drawer and the archive starts to resolve."
            leadStyle={{ fontSize: 22, maxWidth: 620, lineHeight: 1.35, color: 'var(--ink)', textWrap: 'pretty' }} />
        </div>
        <div className="cg-search"><Archivist /></div>
        <div className="cg-brief" ref={briefRef}><Brief /></div>
        <div className="cg-cab" ref={cabRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sceneOk ? (
            <>
              <div style={{ position: 'relative', height: 'clamp(320px, calc(var(--avail) - 250px), 600px)' }}>
                <Archive3D mode="cabinet" mat={MATERIAL.hub} hue={derive(seed).hue}
                  data={{ items: CABINET.map(([num, label, key, mat]) => ({ num, label, key, mat, seen: !!visited[key] })) }} />
              </div>
              <CabinetHint />
            </>
          ) : <DrawerList />}
        </div>
      </div>
    </div>
  )
}
