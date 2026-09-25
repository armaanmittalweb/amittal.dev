import { PROJECTS } from '../../data/content'
import { derive } from '../../lib/seed'
import { useArchive } from '../../store'
import { DrawerHead } from '../ui'

export function Lab() {
  const seed = useArchive(s => s.seed) || '0000000000000000'
  const visited = useArchive(s => s.visited)
  const openProject = useArchive(s => s.openProject)
  const d = derive(seed)
  return (
    <div data-screen-label="08 Lab" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <DrawerHead kicker={`DRAWER 05 · THE LAB · ORDER FROM SEED ${seed}`} title="THE LAB" lead="Working drawings of each project. Open one, then take it apart." leadStyle={{ maxWidth: 'none' }} />
      <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1.5px solid var(--ink)' }}>
        {d.order.map((id, i) => {
          const p = PROJECTS.find(x => x.id === id)!, seen = !!visited['p:' + id]
          return (
            <button key={id} type="button" onClick={() => openProject(id)} className="hover-glow"
              style={{ display: 'grid', gridTemplateColumns: 'clamp(44px,10vw,64px) minmax(0,1fr) auto', gap: 'clamp(10px,3vw,18px)', alignItems: 'center', textAlign: 'left', padding: '24px 6px', background: 'transparent', border: 0, borderBottom: '1px solid var(--line)', color: 'var(--ink)', cursor: 'pointer' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>DWG-{String(i + 1).padStart(2, '0')}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="stencil" style={{ fontWeight: 700, fontSize: 'clamp(26px,6vw,38px)', letterSpacing: '.03em', lineHeight: 1 }}>{p.name}</span>
                <span style={{ fontSize: 17, color: 'var(--muted)' }}>{p.tag}</span>
              </span>
              <span className="stencil" style={{ border: '2px solid ' + (seen ? 'var(--accent)' : 'var(--muted)'), color: seen ? 'var(--accent)' : 'var(--muted)', padding: '2px 8px', fontWeight: 800, fontSize: 15, letterSpacing: '.12em', transform: `rotate(${d.rots[7 + i]}deg)` }}>{seen ? 'INSPECTED' : 'SEALED'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
