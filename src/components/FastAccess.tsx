import type { CSSProperties } from 'react'
import { CAPS, LINKS, PROFILE, PROJECTS } from '../data/content'
import { useIsDesk } from '../hooks'
import { useArchive } from '../store'

/** The recruiter page: no metaphor, no 3D, nothing to load beyond the text. */
export function FastAccess() {
  const leaveFast = useArchive(s => s.leaveFast)
  const desk = useIsDesk()
  const cols = desk ? 'minmax(0,220px) minmax(0,1fr)' : '1fr'
  const label = { fontFamily: "'Martian Mono',monospace", fontSize: 10, letterSpacing: '.14em', color: '#5a5447', paddingBottom: 12 } as const
  return (
    <main data-screen-label="13 Fast access" style={{ minHeight: '100vh', background: '#f4f0e6', color: '#1c1a15', padding: 'clamp(24px,6vw,52px) clamp(16px,4vw,32px) 96px', '--accent': '#1c1a15' } as CSSProperties}>
      <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 46 }}>
        <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 10, letterSpacing: '.14em', color: '#5a5447' }}>
          <span>AMITTAL.DEV · FAST ACCESS · 60-SECOND READ</span>
          <button type="button" onClick={leaveFast} className="mono hover-invert" style={{ fontSize: 10, letterSpacing: '.12em', padding: '9px 14px', border: '1px solid #1c1a15', background: 'transparent', color: '#1c1a15', cursor: 'pointer', whiteSpace: 'nowrap' }}>ENTER THE ARCHIVE →</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h1 className="stencil" style={{ fontWeight: 800, fontSize: 'clamp(40px,11vw,96px)', lineHeight: .85 }}>{PROFILE.name.toUpperCase()}</h1>
          <p style={{ fontSize: 23, lineHeight: 1.4, maxWidth: 620 }}>{PROFILE.line}</p>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 18, paddingTop: 4 }}>
            <a href={LINKS.resumePdf}>Resume (PDF)</a><a href={LINKS.github}>GitHub</a><a href={LINKS.linkedin}>LinkedIn</a><a href={'mailto:' + LINKS.email}>{LINKS.email}</a>
          </div>
        </div>
        <section style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={label}>PROJECTS</h2>
          {PROJECTS.map(p => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: cols, gap: 20, padding: '18px 0', borderTop: '1.5px solid #1c1a15' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><h3 className="stencil" style={{ fontWeight: 700, fontSize: 28 }}>{p.name}</h3><span className="mono" style={{ fontSize: 10, color: '#5a5447' }}>{p.year}</span></div>
              <p style={{ fontSize: 18, lineHeight: 1.5 }}>{p.l1}</p>
            </div>
          ))}
        </section>
        <section style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={label}>CAPABILITIES</h2>
          {CAPS.map(g => (
            <div key={g.group} style={{ display: 'grid', gridTemplateColumns: cols, gap: 20, padding: '14px 0', borderTop: '1px solid #c7bca2', fontSize: 18 }}>
              <h3 className="stencil" style={{ fontWeight: 700, fontSize: 22 }}>{g.group}</h3>
              <span>{g.items.map(c => c.title).join(', ')}</span>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
