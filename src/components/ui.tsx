import type { CSSProperties, ReactNode } from 'react'
import { derive } from '../lib/seed'
import { useArchive } from '../store'

/** The drawer heading: kicker line, display title, optional lead. */
export function DrawerHead({ kicker, title, size = 'clamp(40px,11vw,72px)', lineHeight = .9, lead, leadStyle }: {
  kicker: ReactNode; title: ReactNode; size?: string; lineHeight?: number; lead?: ReactNode; leadStyle?: CSSProperties
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="kicker">{kicker}</div>
      <h1 className="stencil" style={{ fontWeight: 800, fontSize: size, lineHeight }}>{title}</h1>
      {lead && <p style={{ fontSize: 20, color: 'var(--muted)', maxWidth: 560, ...leadStyle }}>{lead}</p>}
    </div>
  )
}

/** A mono button with an ink outline, used for "OPEN …" style actions. */
export function OutlineButton({ onClick, children, style }: { onClick: () => void; children: ReactNode; style?: CSSProperties }) {
  return (
    <button type="button" onClick={onClick} className="mono"
      style={{ fontSize: 10, letterSpacing: '.12em', padding: '10px 14px', background: 'transparent', border: '1px solid var(--ink)', color: 'var(--ink)', cursor: 'pointer', whiteSpace: 'nowrap', ...style }}>
      {children}
    </button>
  )
}

/** The seed hides one record in one paper drawer. This is its stamp. */
export function MisfiledStamp({ drawer, rotate, align = 'flex-start' }: { drawer: string; rotate: number; align?: 'flex-start' | 'flex-end' }) {
  const seed = useArchive(s => s.seed)
  const found = useArchive(s => s.found)
  const findMisfiled = useArchive(s => s.findMisfiled)
  if (found || derive(seed || '0000000000000000').misfiled !== drawer) return null
  return (
    <button type="button" onClick={findMisfiled} className="stencil"
      style={{ alignSelf: align, background: 'transparent', border: '2px solid var(--stamp)', color: 'var(--stamp)', padding: '3px 10px', fontWeight: 800, fontSize: 15, letterSpacing: '.14em', transform: `rotate(${rotate}deg)`, cursor: 'pointer' }}>
      MISFILED ¶
    </button>
  )
}

export function MisfiledNote() {
  const seed = useArchive(s => s.seed) || '0000000000000000'
  const found = useArchive(s => s.found)
  const view = useArchive(s => s.view)
  if (!found || view !== derive(seed).misfiled) return null
  return (
    <div style={{ border: '2px solid var(--stamp)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 620 }}>
      <span className="mono" style={{ fontSize: 10, letterSpacing: '.14em', color: 'var(--stamp)' }}>MISFILED RECORD · 0x{seed.slice(0, 8)}</span>
      <span style={{ fontSize: 18, fontStyle: 'italic', lineHeight: 1.45 }}>Your seed placed this record here. Another visitor would find it in a different drawer, or not at all.</span>
    </div>
  )
}

/** Key/value row used by the identity facts and the colophon. */
export function FactRow({ k, v, cols, size = 18 }: { k: string; v: ReactNode; cols: string; size?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 16, padding: '13px 0', borderBottom: '1px solid var(--line)' }}>
      <span className="label" style={{ paddingTop: 4 }}>{k}</span>
      <span style={{ fontSize: size }}>{v}</span>
    </div>
  )
}
