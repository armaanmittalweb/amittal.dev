import { LINKS, PROFILE, RESUME } from '../../data/content'
import { useIsDesk } from '../../hooks'
import { MisfiledStamp } from '../ui'

export function Resume() {
  const desk = useIsDesk()
  return (
    <div data-screen-label="06 Resume" style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="kicker">DRAWER 03 · RESUME · ONE PAGE</div>
          <h1 className="stencil" style={{ fontWeight: 800, fontSize: 'clamp(40px,11vw,72px)', lineHeight: .9 }}>THE RECORD</h1>
        </div>
        <a href={LINKS.resumePdf} download="Armaan_Mittal_Resume.pdf" className="stencil" style={{ fontWeight: 700, fontSize: 20, letterSpacing: '.12em', padding: '10px 22px', background: 'var(--ink)', color: 'var(--bg)', textDecoration: 'none' }}>DOWNLOAD PDF</a>
      </div>
      <article data-tilt="4" style={{ background: '#f7f3e8', color: '#1c1a15', padding: 'clamp(22px,5vw,44px) clamp(18px,5vw,48px)', boxShadow: '0 1px 0 #c7bca2,0 18px 40px rgba(60,45,20,.18)', display: 'flex', flexDirection: 'column', gap: 26, maxWidth: 760, transition: 'transform .2s ease-out' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', borderBottom: '1.5px solid #1c1a15', paddingBottom: 14 }}>
          <span className="stencil" style={{ fontWeight: 800, fontSize: 34, letterSpacing: '.04em' }}>{PROFILE.name.toUpperCase()}</span>
          <span className="mono" style={{ fontSize: 10, lineHeight: 1.8, textAlign: desk ? 'right' : 'left' }}>
            <a href={'mailto:' + LINKS.email}>{LINKS.email}</a><br /><a href={LINKS.github} target="_blank" rel="noopener">{LINKS.githubLabel}</a>
          </span>
        </div>
        {RESUME.map(sec => (
          <section key={sec.h} style={{ display: 'grid', gridTemplateColumns: desk ? '120px 1fr' : '1fr', gap: desk ? 20 : 6 }}>
            <h2 className="mono" style={{ fontSize: 10, letterSpacing: '.14em', paddingTop: 5 }}>{sec.h}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sec.rows.map(r => (
                <div key={r.t} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 18, fontWeight: 500, minWidth: 0 }}>{r.t}</span>
                    {r.d && <span className="mono" style={{ fontSize: 10, paddingTop: 4, whiteSpace: 'nowrap' }}>{r.d}</span>}
                  </div>
                  <span style={{ fontSize: 16, color: '#4e483c', lineHeight: 1.4 }}>{r.s}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </article>
      <MisfiledStamp drawer="resume" rotate={-2} />
    </div>
  )
}
