import type { CSSProperties, ReactNode } from 'react'
import { CAPS, LINKS, PROFILE, PROJECTS, RESUME } from '../data/content'
import { useIsDesk } from '../hooks'
import { useArchive } from '../store'

const rowsOf = (h: string) => RESUME.find(s => s.h === h)?.rows ?? []

/** The recruiter page: no metaphor, no 3D, nothing to load beyond the text. */
export function FastAccess() {
  const leaveFast = useArchive(s => s.leaveFast)
  const desk = useIsDesk()
  const cols = desk ? 'minmax(0,220px) minmax(0,1fr)' : '1fr'
  const label = { fontFamily: "'Martian Mono',monospace", fontSize: 10, letterSpacing: '.14em', color: '#5a5447', paddingBottom: 12 } as const
  const meta = { fontFamily: "'Martian Mono',monospace", fontSize: 10, color: '#5a5447', letterSpacing: '.06em' } as const
  const row = (key: string, left: ReactNode, right: ReactNode, heavy = true) => (
    <div key={key} style={{ display: 'grid', gridTemplateColumns: cols, gap: desk ? 20 : 8, padding: '18px 0', borderTop: heavy ? '1.5px solid #1c1a15' : '1px solid #c7bca2' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>{left}</div>
      <div style={{ fontSize: 18, lineHeight: 1.5, minWidth: 0 }}>{right}</div>
    </div>
  )
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
          <div style={{ display: 'flex', gap: '10px 20px', flexWrap: 'wrap', fontSize: 18, paddingTop: 4 }}>
            <a href={LINKS.resumePdf} download="Armaan_Mittal_Resume.pdf">Resume (PDF)</a>
            <a href={LINKS.github} target="_blank" rel="noopener">GitHub</a>
            <a href={LINKS.linkedin} target="_blank" rel="noopener">LinkedIn</a>
            <a href={'mailto:' + LINKS.email}>{LINKS.email}</a>
          </div>
        </div>
        <section style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={label}>EXPERIENCE</h2>
          {rowsOf('EXPERIENCE').map(r => {
            const [role, org] = r.t.split(' · ')
            return row(r.t, <>
              <h3 className="stencil" style={{ fontWeight: 700, fontSize: 26, lineHeight: 1 }}>{org ?? role}</h3>
              {org && <span style={{ fontSize: 16, lineHeight: 1.3 }}>{role}</span>}
              <span style={meta}>{r.d}</span>
            </>, r.s)
          })}
          {rowsOf('EDUCATION').map(r => row(r.t, <>
            <h3 className="stencil" style={{ fontWeight: 700, fontSize: 26, lineHeight: 1 }}>EDUCATION</h3>
            <span style={meta}>{r.d}</span>
          </>, <>{r.t}. {r.s}</>))}
        </section>
        <section style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={label}>PROJECTS</h2>
          {PROJECTS.map(p => row(p.id, <>
            <h3 className="stencil" style={{ fontWeight: 700, fontSize: 28, lineHeight: 1 }}>{p.name}</h3>
            <span style={meta}>{p.year}{p.repo && <> · <a href={p.repo} target="_blank" rel="noopener">SOURCE</a></>}</span>
          </>, p.l1))}
        </section>
        <section style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={label}>PUBLICATIONS</h2>
          {rowsOf('PUBLICATIONS').map(r => row(r.t, <span style={meta}>{r.d}</span>, <><i>{r.t}</i>. {r.s}</>, false))}
        </section>
        <section style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={label}>CAPABILITIES</h2>
          {CAPS.map(g => row(g.group, <h3 className="stencil" style={{ fontWeight: 700, fontSize: 22 }}>{g.group}</h3>, g.items.map(c => c.title).join(', '), false))}
        </section>
      </div>
    </main>
  )
}
