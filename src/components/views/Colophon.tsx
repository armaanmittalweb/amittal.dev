import { COLOPHON } from '../../data/content'
import { useIsDesk } from '../../hooks'
import { FactRow } from '../ui'

export function Colophon() {
  const desk = useIsDesk()
  return (
    <div data-screen-label="14 Colophon" style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div className="kicker">DRAWER 99 · NOT IN THE INDEX</div>
      <h1 className="stencil" style={{ fontWeight: 800, fontSize: 'clamp(40px,11vw,96px)', lineHeight: .85 }}>COLOPHON</h1>
      <p style={{ fontSize: 21, fontStyle: 'italic', color: 'var(--muted)', maxWidth: 600 }}>How this archive was made, for the few who look for it.</p>
      <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--ink)', maxWidth: 760 }}>
        {COLOPHON.map(c => <FactRow key={c.k} k={c.k} v={c.v} cols={desk ? '150px 1fr' : '1fr'} size={19} />)}
      </div>
    </div>
  )
}
