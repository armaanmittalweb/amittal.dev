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
      <div data-tilt="8" style={{ aspectRatio: '4/5', border: '1px solid var(--line)', background: 'repeating-linear-gradient(135deg,transparent 0 9px,var(--line) 9px 10px)', display: 'flex', alignItems: 'flex-end', padding: 14, transition: 'transform .2s ease-out', maxWidth: 460, width: '100%' }}>
        <span className="mono" style={{ background: 'var(--bg)', padding: '4px 8px', fontSize: 10, letterSpacing: '.1em', color: 'var(--muted)' }}>PORTRAIT · PHOTO GOES HERE</span>
      </div>
    </div>
  )
}
