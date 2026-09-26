import { PROFILE } from '../../data/content'
import { FactRow, MisfiledStamp } from '../ui'

export function Identity() {
  return (
    <div data-screen-label="04 Identity" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 40, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div className="kicker">DRAWER 01 · IDENTITY · FILE A-001</div>
        <h1 className="stencil" style={{ fontWeight: 800, fontSize: 'clamp(40px,11vw,92px)', lineHeight: .85 }}>ARMAAN<br />MITTAL</h1>
        <p style={{ fontSize: 23, lineHeight: 1.4, maxWidth: 560, textWrap: 'pretty' }}>{PROFILE.line}</p>
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1.5px solid var(--ink)' }}>
          {PROFILE.facts.map(f => <FactRow key={f.k} k={f.k} v={f.v} cols="130px 1fr" />)}
        </div>
        <MisfiledStamp drawer="identity" rotate={-3} />
      </div>
      {/* The portrait is a print filed in the folder, not a full-bleed photo: the source is small. */}
      <div data-tilt="8" style={{ position: 'relative', aspectRatio: '4/5', border: '1px solid var(--line)', background: 'repeating-linear-gradient(135deg,transparent 0 9px,var(--line) 9px 10px)', display: 'grid', placeItems: 'center', padding: 14, transition: 'transform .2s ease-out', maxWidth: 460, width: '100%' }}>
        <figure style={{ margin: '0 0 24px', width: '72%', background: '#f4efe2', padding: '10px 10px 30px', boxShadow: '0 12px 28px rgba(0,0,0,.28)', transform: 'rotate(-2deg)' }}>
          <img src="/portrait.jpg" width={320} height={400} alt={PROFILE.name} loading="lazy" decoding="async"
            style={{ display: 'block', width: '100%', height: 'auto', filter: 'grayscale(.85) sepia(.2) contrast(1.04)' }} />
        </figure>
        <span className="mono" style={{ position: 'absolute', left: 14, bottom: 14, background: 'var(--bg)', padding: '4px 8px', fontSize: 10, letterSpacing: '.1em', color: 'var(--muted)' }}>PORTRAIT · FILE A-001</span>
      </div>
    </div>
  )
}
