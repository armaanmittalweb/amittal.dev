import { CAT_LABEL, MATERIAL, PROJECTS, type Project as P } from '../../data/content'
import { useEffect, useRef, type MouseEvent } from 'react'
import { reveal, useIsDesk } from '../../hooks'
import { derive } from '../../lib/seed'
import { useArchive } from '../../store'
import { useSceneAvailable } from '../../lib/scene'
import { Archive3D } from '../Scene'

const DEPTHS = [['L1 · WHAT', '10 SECONDS'], ['L2 · HOW', '60 SECONDS'], ['L3 · WHY', '5 MINUTES']] as const

function pipelineStatus(proj: P, removed: number | null) {
  const Pl = proj.pipeline
  if (removed === null) return { ok: true, head: 'PIPELINE VALID', lines: [`OUTPUT  ${Pl[Pl.length - 1]}`] }
  const i = removed
  const lines = proj.breaks[i]
    ?? (i === Pl.length - 1
      ? ['FINAL STAGE REMOVED', `Stages run, but nothing becomes ${Pl[i].toLowerCase()}`, 'OUTPUT EMPTY']
      : [`${Pl[i + 1].toUpperCase()} EXPECTS  output of ${Pl[i]}`, `RECEIVED  ${i === 0 ? 'nothing' : 'output of ' + Pl[i - 1]}`, 'Mismatch detected', 'EXECUTION ABORTED'])
  return { ok: false, head: 'PIPELINE INVALID', lines }
}

/** The pipeline as buttons: the keyboard and screen-reader way to pull a stage. */
function StageControls({ proj, removed, toggle }: { proj: P; removed: number | null; toggle: (i: number) => void }) {
  return (
    <div role="group" aria-label="Pipeline stages. Press a stage to pull it out, press it again to refit it." style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {proj.pipeline.map((name, i) => {
        const pulled = removed === i, starved = removed !== null && i > removed
        return (
          <button key={name} type="button" aria-pressed={pulled} onClick={() => toggle(i)} className="mono"
            style={{ padding: '7px 10px', fontSize: 10, letterSpacing: '.08em', background: 'transparent', cursor: 'pointer', border: `1px ${pulled ? 'dashed' : 'solid'} ${pulled ? 'var(--err)' : starved ? 'var(--line)' : 'var(--ink)'}`, color: pulled ? 'var(--err)' : starved ? 'var(--muted)' : 'var(--ink)', textDecoration: pulled ? 'line-through' : 'none' }}>
            S{String(i + 1).padStart(2, '0')} · {name.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}

export function Project() {
  const seed = useArchive(s => s.seed) || '0000000000000000'
  const projectId = useArchive(s => s.projectId)
  const depth = useArchive(s => s.depth)
  const removed = useArchive(s => s.removed)
  const openWhy = useArchive(s => s.openWhy)
  const openFail = useArchive(s => s.openFail)
  const { go, setDepth, toggleStage, restore, toggleWhy, toggleFail, openProject } = useArchive.getState()
  const desk = useIsDesk()
  const sceneOk = useSceneAvailable()
  const proj = PROJECTS.find(p => p.id === projectId) || PROJECTS[0]
  const status = pipelineStatus(proj, removed)
  const col = desk ? '140px 1fr' : '1fr', gap = desk ? 20 : 6
  const levelLabel = { fontFamily: "'Martian Mono',monospace", fontSize: 10, letterSpacing: '.14em', color: 'var(--accent)' } as const
  const order = derive(seed).order, nextId = order[(order.indexOf(proj.id) + 1) % order.length]
  const nextProj = PROJECTS.find(p => p.id === nextId)!

  // Going deeper adds a section below everything already open. Bring it into view,
  // or the tab looks like it did nothing.
  const l2 = useRef<HTMLElement>(null), l3 = useRef<HTMLDivElement>(null), shown = useRef(depth)
  useEffect(() => {
    if (depth > shown.current) reveal(depth === 3 ? l3.current : l2.current)
    shown.current = depth
  }, [depth])
  // An accordion opened near the bottom of the screen is scrolled up just enough to read.
  const openAndReveal = (toggle: () => void) => (e: MouseEvent<HTMLButtonElement>) => { toggle(); reveal(e.currentTarget.parentElement) }

  return (
    <article data-screen-label="09 Project" style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
      <button type="button" onClick={() => go('lab')} className="mono" style={{ alignSelf: 'flex-start', background: 'transparent', border: 0, padding: 0, color: 'var(--muted)', cursor: 'pointer', fontSize: 10, letterSpacing: '.14em' }}>← THE LAB</button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="kicker">{CAT_LABEL[proj.cat]} · {proj.year} · WORKING DRAWING</div>
        <h1 className="stencil" style={{ fontWeight: 800, fontSize: 'clamp(40px,11vw,88px)', lineHeight: .85 }}>{proj.name}</h1>
        <p style={{ fontSize: 21, fontStyle: 'italic', color: 'var(--muted)' }}>{proj.tag}</p>
      </div>
      <div role="group" aria-label="Depth" style={{ display: 'flex', flexWrap: 'nowrap', border: '1px solid var(--ink)', alignSelf: 'flex-start', maxWidth: '100%', overflowX: 'auto' }}>
        {DEPTHS.map(([label, time], i) => {
          const cur = depth === i + 1
          return (
            <button key={label} type="button" aria-pressed={cur} onClick={() => setDepth((i + 1) as 1 | 2 | 3)}
              style={{ padding: '10px 18px', background: cur ? 'var(--ink)' : 'transparent', border: 0, borderRight: '1px solid var(--ink)', color: cur ? 'var(--bg)' : 'var(--ink)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'left', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
              <span className="stencil" style={{ fontWeight: 700, fontSize: 19, letterSpacing: '.1em' }}>{label}</span>
              <span className="mono" style={{ fontSize: 9, letterSpacing: '.1em' }}>{time}</span>
            </button>
          )
        })}
      </div>
      <section style={{ display: 'grid', gridTemplateColumns: col, gap }}>
        <h2 style={{ ...levelLabel, paddingTop: 8 }}>L1 · WHAT IS IT?</h2>
        <p style={{ fontSize: 26, lineHeight: 1.35, maxWidth: 700, textWrap: 'pretty' }}>{proj.l1}</p>
      </section>
      {depth >= 2 && (
        <section ref={l2} data-reveal style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: col, gap }}>
            <h2 style={{ ...levelLabel, paddingTop: 6 }}>L2 · HOW DOES IT WORK?</h2>
            <p style={{ fontSize: 19, lineHeight: 1.55, maxWidth: 700, textWrap: 'pretty', opacity: .9 }}>{proj.l2}</p>
          </div>
          <figure data-reveal style={{ margin: 0, border: '1.5px solid var(--ink)', padding: 'clamp(14px,3vw,22px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <figcaption className="mono" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)' }}><span>PIPELINE · FIG. 1</span><span>{sceneOk ? 'TAP A BLOCK TO PULL IT OUT · TAP AGAIN TO REFIT' : 'PRESS A STAGE TO PULL IT OUT · PRESS AGAIN TO REFIT'}</span></figcaption>
            {sceneOk && (
              <div style={{ margin: '0 -10px' }}>
                <Archive3D mode="pipeline" mat={MATERIAL.project} hue={derive(seed).hue} data={{ stages: proj.pipeline, removed }} autoHeight />
              </div>
            )}
            <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 14, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 14, alignItems: 'flex-end' }}>
              <div role="status" className="mono" style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, lineHeight: 1.5, minWidth: 0, overflowWrap: 'anywhere' }}>
                <span className="stencil" style={{ fontWeight: 800, fontSize: 24, letterSpacing: '.1em', color: status.ok ? 'var(--accent)' : 'var(--err)' }}>{status.head}</span>
                {status.lines.map(l => <span key={l}>{l}</span>)}
              </div>
              {!status.ok && <button type="button" onClick={restore} className="stencil" style={{ fontWeight: 700, fontSize: 18, letterSpacing: '.12em', padding: '8px 18px', background: 'var(--ink)', border: 0, color: 'var(--bg)', cursor: 'pointer' }}>RESTORE</button>}
            </div>
            <StageControls proj={proj} removed={removed} toggle={toggleStage} />
          </figure>
        </section>
      )}
      {depth >= 3 && (
        <div ref={l3} data-reveal style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 28 }}>
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{ ...levelLabel, paddingBottom: 4 }}>L3 · WHY? ENGINEERING DECISIONS</h2>
            {proj.why.map((w, i) => {
              const open = openWhy === i
              return (
                <div key={w.q} style={{ border: '1px solid var(--line)' }}>
                  <button type="button" aria-expanded={open} onClick={openAndReveal(() => toggleWhy(i))} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 12, textAlign: 'left', padding: '15px 16px', background: 'transparent', border: 0, color: 'var(--ink)', cursor: 'pointer', fontSize: 19 }}>
                    <span>{w.q}</span><span className="mono" aria-hidden="true">{open ? '−' : '+'}</span>
                  </button>
                  {open && (
                    <div className="mono" style={{ padding: '0 16px 18px', display: 'flex', flexDirection: 'column', gap: 9, fontSize: 11, lineHeight: 1.7 }}>
                      <div><span style={{ color: 'var(--muted)' }}>ALTERNATIVE · </span>{w.alt}</div>
                      <div style={{ color: 'var(--muted)' }}>WHY NOT?</div>
                      {w.whyNot.map(x => <div key={x} style={{ paddingLeft: 12, borderLeft: '1.5px solid var(--ink)' }}>{x}</div>)}
                      <div style={{ paddingTop: 4 }}><span style={{ color: 'var(--muted)' }}>DECISION · </span><span className="stencil" style={{ fontWeight: 800, fontSize: 20, letterSpacing: '.08em', color: 'var(--accent)' }}>{w.decision}</span></div>
                    </div>
                  )}
                </div>
              )
            })}
          </section>
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{ ...levelLabel, paddingBottom: 4 }}>KNOWN FAILURES · INCIDENT LOG</h2>
            {proj.fails.map((f, i) => {
              const open = openFail === i
              const rows = [['SYMPTOM', f.symptom], ['INVESTIGATION', f.investigation], ['SOLUTION', f.solution], ['RESULT', f.result]]
              return (
                <div key={f.problem} style={{ border: '1px solid var(--line)' }}>
                  <button type="button" aria-expanded={open} onClick={openAndReveal(() => toggleFail(i))} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 12, textAlign: 'left', padding: '15px 16px', background: 'transparent', border: 0, color: 'var(--ink)', cursor: 'pointer', fontSize: 19 }}>
                    <span>{f.problem}</span><span className="mono" aria-hidden="true">{open ? '−' : '+'}</span>
                  </button>
                  {open && (
                    <dl style={{ margin: 0, padding: '0 16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {rows.map(([k, v]) => (
                        <div key={k} style={{ display: 'grid', gridTemplateColumns: desk ? '120px 1fr' : '1fr', gap: desk ? 12 : 2 }}>
                          <dt className="mono" style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--muted)', paddingTop: 4 }}>{k}</dt>
                          <dd style={{ margin: 0, fontSize: 17, lineHeight: 1.45 }}>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              )
            })}
          </section>
        </div>
      )}
      <nav aria-label="Projects" className="mono" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 18 }}>
        <button type="button" onClick={() => go('lab')} style={{ fontSize: 10, letterSpacing: '.12em', padding: '12px 16px', background: 'transparent', border: '1px solid var(--line)', color: 'var(--ink)', cursor: 'pointer' }}>← THE LAB</button>
        {nextProj.id !== proj.id && (
          <button type="button" onClick={() => openProject(nextProj.id)} style={{ fontSize: 10, letterSpacing: '.12em', padding: '12px 16px', background: 'transparent', border: '1px solid var(--ink)', color: 'var(--ink)', cursor: 'pointer' }}>
            <span style={{ color: 'var(--muted)' }}>NEXT DRAWING · </span>{nextProj.name.toUpperCase()} →
          </button>
        )}
      </nav>
    </article>
  )
}
