import { OBJECTIVES } from '../data/content'
import { useIsDesk } from '../hooks'
import { useArchive } from '../store'

export function Objective() {
  const seed = useArchive(s => s.seed)
  const pickObjective = useArchive(s => s.pickObjective)
  const desk = useIsDesk()
  return (
    <main data-screen-label="02 Objective" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(24px,6vw,56px) clamp(16px,4vw,32px)' }}>
      <div style={{ width: '100%', maxWidth: 1040, display: 'flex', flexDirection: 'column', gap: 26 }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: '.14em', color: 'var(--muted)' }}>KEY ACCEPTED · SESSION {seed}</div>
        <h1 className="stencil" style={{ fontWeight: 800, fontSize: 'clamp(40px,11vw,84px)', lineHeight: .9, letterSpacing: '.01em' }}>I'M HERE TO…</h1>
        <p style={{ fontSize: 20, color: 'var(--muted)', maxWidth: 560, textWrap: 'pretty' }}>Pick what you came to understand. It sets a recommended path through the archive, and every drawer stays open.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,150px),1fr))', gap: 'clamp(10px,2vw,18px)', paddingTop: 10 }}>
          {OBJECTIVES.map((o, i) => (
            <button key={o.id} type="button" onClick={() => pickObjective(o.id)} className="hover-lift" data-tilt="10"
              style={{ position: 'relative', textAlign: 'left', padding: '28px clamp(14px,3vw,22px) 18px', background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--ink)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, minHeight: desk ? 230 : 150, transition: 'transform .2s ease-out,box-shadow .25s', boxShadow: '0 2px 0 var(--line)' }}>
              <span className="mono" style={{ position: 'absolute', top: -1, left: 18, padding: '3px 10px', background: 'var(--ink)', color: 'var(--bg)', fontSize: 9, letterSpacing: '.14em' }}>OBJ-{String(i + 1).padStart(2, '0')}</span>
              <span className="stencil" style={{ fontWeight: 700, fontSize: 'clamp(24px,5vw,34px)', letterSpacing: '.06em', lineHeight: 1 }}>{o.label}</span>
              <span style={{ fontSize: 'clamp(14px,3.6vw,17px)', color: 'var(--muted)', lineHeight: 1.4 }}>{o.desc}</span>
              <span className="mono" style={{ marginTop: 'auto', fontSize: 10, letterSpacing: '.06em', lineHeight: 1.8, color: 'var(--muted)' }}>{o.path.map(p => p[0].toUpperCase()).join(' → ')}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
