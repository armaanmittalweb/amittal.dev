import { useEffect, useRef } from 'react'
import { MATERIAL, RESEARCH } from '../../data/content'
import { reveal, useIsDesk } from '../../hooks'
import { derive } from '../../lib/seed'
import { useArchive } from '../../store'
import { useSceneAvailable } from '../../lib/scene'
import { Archive3D } from '../Scene'
import { DrawerHead } from '../ui'

export function Research() {
  const seed = useArchive(s => s.seed) || '0000000000000000'
  const openRes = useArchive(s => s.openRes)
  const toggleRes = useArchive(s => s.toggleRes)
  const sceneOk = useSceneAvailable()
  const desk = useIsDesk()
  // A frame tapped on the reel opens its record in the list; scroll just enough to show it.
  const rows = useRef<(HTMLDivElement | null)[]>([])
  useEffect(() => { if (openRes != null) reveal(rows.current[openRes]) }, [openRes])
  const sprockets = { background: 'repeating-linear-gradient(180deg,transparent 0 8px,var(--line) 8px 16px)' }
  return (
    <div data-screen-label="10 Research" style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <DrawerHead kicker="DRAWER 06 · RESEARCH" title="RESEARCH" leadStyle={{ maxWidth: 'none' }}
        lead="Studies and experiments, as frames on a reel. The engineering lives in the Lab; this drawer holds the questions." />
      {sceneOk && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ position: 'relative', height: 'clamp(170px, 24vw + 100px, 280px)' }}>
            <Archive3D mode="reel" mat={MATERIAL.research} hue={derive(seed).hue} data={{ frames: RESEARCH.map(r => r.id + '|' + r.status), sel: openRes }} />
          </div>
          <div className="mono" aria-hidden="true" style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--muted)' }}>DRAG TO WIND THE REEL · TAP A FRAME TO OPEN IT</div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {RESEARCH.map((r, i) => {
          const open = openRes === i
          return (
            <div key={r.id} ref={el => { rows.current[i] = el }} data-reveal style={{ display: 'grid', gridTemplateColumns: '22px 1fr 22px', border: '1px solid var(--line)' }}>
              <div style={sprockets} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <button type="button" aria-expanded={open} onClick={() => toggleRes(i)} style={{ display: 'grid', gridTemplateColumns: desk ? '70px 1fr auto' : '1fr auto', gap: desk ? 16 : '4px 12px', alignItems: 'center', textAlign: 'left', padding: desk ? 18 : '14px 12px', background: 'transparent', border: 0, color: 'var(--ink)', cursor: 'pointer' }}>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--muted)', gridColumn: desk ? undefined : '1 / -1' }}>{r.id}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span style={{ fontSize: 21 }}>{r.title}</span><span className="mono" style={{ fontSize: 10, letterSpacing: '.1em', color: 'var(--accent)' }}>{r.status}</span></span>
                  <span className="mono" aria-hidden="true">{open ? '−' : '+'}</span>
                </button>
                {open && (
                  <dl style={{ margin: 0, padding: desk ? '0 18px 20px 104px' : '0 12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {r.rows.map(([k, v]) => (
                      <div key={k} style={{ display: 'grid', gridTemplateColumns: desk ? '100px 1fr' : '1fr', gap: desk ? 12 : 2 }}>
                        <dt className="mono" style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--muted)', paddingTop: 4 }}>{k}</dt>
                        <dd style={{ margin: 0, fontSize: 17, lineHeight: 1.45 }}>{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
              <div style={sprockets} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
