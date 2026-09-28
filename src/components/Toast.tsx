import { EGGS } from '../data/content'
import { usePresence } from '../hooks'
import { useArchive } from '../store'

export function Toast() {
  const toast = useArchive(s => s.toast)
  const found = useArchive(s => Object.keys(s.eggs).length)
  const dismiss = useArchive(s => s.dismissToast)
  // It slides up into place and drops away when it times out or is dismissed.
  const { item, leaving } = usePresence(toast, 180)
  return (
    <div role="status" aria-live="polite">
      {item && (
        <div key={item.code + item.title} className={'vt-toast ' + (leaving ? 'toast-out' : 'toast-in')} inert={leaving}
          style={{ position: 'fixed', right: 16, left: 16, bottom: 16, marginLeft: 'auto', zIndex: 70, maxWidth: 340, background: '#f4f0e6', color: '#1c1a15', padding: '16px 18px', boxShadow: '0 16px 40px rgba(0,0,0,.35)', transform: 'rotate(-1.5deg)', display: 'flex', flexDirection: 'column', gap: 6, border: '2px solid oklch(0.5 0.17 28)' }}>
          <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 9, letterSpacing: '.14em', color: 'oklch(0.5 0.17 28)' }}>
            <span>{item.kicker || 'EASTER EGG FOUND · ' + String(found).padStart(2, '0') + '/' + EGGS.length} · {item.code}</span>
            {/* It sits over the bottom of the page, so it can be put away before it times out. */}
            <button type="button" onClick={dismiss} aria-label="Dismiss" style={{ margin: '-10px -10px -10px 0', minWidth: 36, minHeight: 36, background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
          <div className="stencil" style={{ fontWeight: 800, fontSize: 28, letterSpacing: '.06em', lineHeight: 1 }}>{item.title}</div>
          <div style={{ fontFamily: "'Newsreader',serif", fontSize: 17, lineHeight: 1.4 }}>{item.body}</div>
        </div>
      )}
    </div>
  )
}
