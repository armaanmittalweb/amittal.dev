import { CABINET, MATERIAL, PROJECTS } from '../../data/content'
import { useIsDesk } from '../../hooks'
import { derive } from '../../lib/seed'
import { useArchive } from '../../store'
import { useSceneAvailable } from '../../lib/scene'
import { Archive3D } from '../Scene'
import { DrawerHead } from '../ui'

/** Without WebGL the cabinet becomes a plain list of its drawers. */
function DrawerList() {
  const visited = useArchive(s => s.visited)
  const openKey = useArchive(s => s.openKey)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1.5px solid var(--ink)' }}>
      {CABINET.map(([num, label, key, mat, desc]) => (
        <button key={key} type="button" onClick={() => openKey(key)} className="hover-shade"
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

export function Hub() {
  const seed = useArchive(s => s.seed) || '0000000000000000'
  const visited = useArchive(s => s.visited)
  const query = useArchive(s => s.query)
  const results = useArchive(s => s.results)
  const secret = useArchive(s => s.secret)
  const { setQuery, runQuery, openProject, go } = useArchive.getState()
  const desk = useIsDesk()
  const sceneOk = useSceneAvailable()

  return (
    <div data-screen-label="03 Core" style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
      <DrawerHead kicker="DRAWER 00 · INDEX" title="THE CORE" size="clamp(40px,11vw,96px)" lineHeight={.85}
        lead="Records, projects and decisions, filed as they were made. Open a drawer and the archive starts to resolve."
        leadStyle={{ fontSize: 22, maxWidth: 620, lineHeight: 1.35, color: 'var(--ink)', textWrap: 'pretty' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 380px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
        <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <form role="search" onSubmit={e => { e.preventDefault(); runQuery() }} style={{ border: '1.5px solid var(--ink)', display: 'flex', flexDirection: 'column' }}>
            <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 16px', borderBottom: '1.5px solid var(--ink)', fontSize: 10, letterSpacing: '.14em' }}>
              <span>ARCHIVE INDEX · REQUEST FORM</span><span style={{ color: 'var(--muted)' }}>KEYWORD SEARCH</span>
            </div>
            <div style={{ display: 'flex' }}>
              <input value={query} onChange={e => setQuery(e.target.value)} aria-label="Search the archive" placeholder="Show me your projects involving NLP"
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, color: 'var(--ink)', padding: '18px 16px', fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontSize: 22, outline: 'none' }} />
              <button type="submit" className="stencil" style={{ fontWeight: 700, fontSize: 20, letterSpacing: '.12em', padding: '0 26px', background: 'var(--ink)', border: 0, color: 'var(--bg)', cursor: 'pointer', whiteSpace: 'nowrap' }}>FILE REQUEST</button>
            </div>
            <div aria-live="polite">
              {results && results.length > 0 && (
                <div style={{ borderTop: '1.5px solid var(--ink)', padding: '6px 16px 16px', display: 'flex', flexDirection: 'column' }}>
                  <div className="label" style={{ padding: '10px 0' }}>MATCHES · {String(results.length).padStart(2, '0')}</div>
                  {results.map(r => {
                    const p = PROJECTS.find(x => x.id === r.id)!
                    return (
                      <div key={r.id} style={{ display: 'grid', gridTemplateColumns: desk ? 'minmax(0,240px) minmax(0,1fr)' : '1fr', gap: 18, padding: '14px 0', borderTop: '1px solid var(--line)', alignItems: 'start' }}>
                        <button type="button" onClick={() => openProject(p.id)} className="stencil hover-underline" style={{ textAlign: 'left', background: 'transparent', border: 0, padding: 0, color: 'var(--ink)', cursor: 'pointer', fontWeight: 700, fontSize: 26, letterSpacing: '.04em' }}>{p.name} →</button>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {p.tags.map(t => {
                            const m = r.matched.includes(t)
                            return <span key={t} className="mono" style={{ fontSize: 10, padding: '4px 7px', border: '1px solid ' + (m ? 'var(--ink)' : 'var(--line)'), background: m ? 'var(--ink)' : 'transparent', color: m ? 'var(--bg)' : 'var(--muted)' }}>{t}</span>
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {results && results.length === 0 && (
                <div style={{ borderTop: '1.5px solid var(--ink)', padding: '14px 16px', fontStyle: 'italic', fontSize: 17, color: 'var(--muted)' }}>No records match. Try EEG, RAG, transformers or language.</div>
              )}
              {secret && (
                <div style={{ borderTop: '1.5px solid var(--ink)', padding: 16, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="stencil" style={{ fontWeight: 800, fontSize: 26, letterSpacing: '.08em', color: 'var(--stamp)' }}>{secret.title}</span>
                    <span style={{ fontSize: 19, fontStyle: 'italic' }}>{secret.body}</span>
                  </div>
                  {secret.to && <button type="button" onClick={() => go(secret.to!)} className="mono" style={{ fontSize: 10, letterSpacing: '.12em', padding: '10px 14px', background: 'transparent', border: '1px solid var(--ink)', color: 'var(--ink)', cursor: 'pointer', whiteSpace: 'nowrap' }}>OPEN DRAWER →</button>}
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
