import { useEffect, useRef } from 'react'
import { CAPS, PROJECTS } from '../../data/content'
import { reveal } from '../../hooks'
import { useArchive } from '../../store'
import { DrawerHead, MisfiledStamp } from '../ui'

export function Capabilities() {
  const capId = useArchive(s => s.capId)
  const { pickCap, openProject } = useArchive.getState()
  const cap = CAPS.flatMap(g => g.items).find(c => c.id === capId)
  const group = CAPS.find(g => g.items.some(c => c.id === capId))
  const used = cap ? cap.projects.map(id => PROJECTS.find(x => x.id === id)!) : []
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => { if (capId) reveal(panel.current) }, [capId])

  return (
    <div data-screen-label="05 Capabilities" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <DrawerHead kicker="DRAWER 02 · CAPABILITIES" title="WHAT I CAN BUILD" lead="Each capability is cross-referenced to the work that proves it. No percentages." />
      {/* The cross-reference opens as a full-width row right after the tapped group. Dense
          packing lets the other groups fill in above it, so on wide screens it lands under the
          whole row and on a phone directly under the group you tapped. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))', gridAutoFlow: 'row dense', gap: 0, borderTop: '1.5px solid var(--ink)', borderLeft: '1.5px solid var(--ink)' }}>
        {CAPS.flatMap(g => {
          const cell = (
            <div key={g.group} role="group" aria-label={g.group} style={{ borderRight: '1.5px solid var(--ink)', borderBottom: '1.5px solid var(--ink)', padding: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="label" style={{ paddingBottom: 10 }}>{g.group}</div>
              {g.items.map(c => {
                const on = capId === c.id
                return (
                  <button key={c.id} type="button" onClick={() => pickCap(c.id, g.cat)} aria-pressed={on} className="stencil"
                    style={{ textAlign: 'left', padding: '6px 8px', background: on ? 'var(--ink)' : 'transparent', border: 0, color: on ? 'var(--bg)' : 'var(--ink)', cursor: 'pointer', fontWeight: 700, fontSize: 22, letterSpacing: '.05em' }}>{c.name}</button>
                )
              })}
            </div>
          )
          if (!cap || group !== g) return [cell]
          return [cell, (
            <div key="xref" ref={panel} data-reveal style={{ gridColumn: '1 / -1', background: 'var(--panel)', borderRight: '1.5px solid var(--ink)', borderBottom: '1.5px solid var(--ink)', padding: 'clamp(18px,3vw,26px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '18px 28px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="label">CROSS-REFERENCE</div>
                <h2 className="stencil" style={{ fontWeight: 800, fontSize: 'clamp(30px,5vw,40px)', lineHeight: .95 }}>{cap.name}</h2>
                <div style={{ fontSize: 16, color: 'var(--muted)', fontStyle: 'italic' }}>{cap.tech}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="label">USED IN</div>
                {used.map(p => (
                  <button key={p.id} type="button" onClick={() => openProject(p.id)} className="hover-shade" style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px solid var(--ink)', color: 'var(--ink)', padding: '7px 12px', cursor: 'pointer', fontSize: 17 }}>{p.name} →</button>
                ))}
              </div>
            </div>
          )]
        })}
      </div>
      <p className="sr-only" aria-live="polite">{cap ? `${cap.title}: used in ${used.map(p => p.name).join(' and ')}.` : ''}</p>
      <MisfiledStamp drawer="capabilities" rotate={2} align="flex-end" />
    </div>
  )
}
