import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { LINKS } from '../data/content'
import { useReducedMotion, useViewport } from '../hooks'
import { derive } from '../lib/seed'
import { useArchive } from '../store'
import { MotionToggle } from './MotionToggle'
import { useSceneAvailable } from '../lib/scene'
import { Vault3D } from './Scene'

/** The vault door drawn flat, for browsers without WebGL. */
function VaultDrawing() {
  return (
    <svg viewBox="0 0 800 800" role="img" aria-label="The vault door" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <circle cx="400" cy="400" r="240" fill="#6b665c" stroke="#3a3731" strokeWidth="30" />
      <circle cx="400" cy="400" r="90" fill="#c29d56" />
      <circle cx="400" cy="380" r="26" fill="#080706" />
      <rect x="388" y="380" width="24" height="70" fill="#080706" />
    </svg>
  )
}

export function Entrance() {
  const seed = useArchive(s => s.seed)
  const revoked = useArchive(s => s.revoked)
  const { issueKey, unlocked, goFast, egg } = useArchive.getState()
  const { vw, vh } = useViewport()
  const reduced = useReducedMotion()
  const sceneOk = useSceneAvailable()

  const [key, setKey] = useState({ dx: 0, dy: 0 })
  const [dragging, setDragging] = useState(false)
  const [inserted, setInserted] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [tagFlipped, setTagFlipped] = useState(false)
  const [lamp, setLamp] = useState(0)
  const holeRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ sx: number; sy: number } | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const d = derive(seed || '0000000000000000')
  const entRow = vw >= 760 && vw / vh >= 1.05
  const vaultPx = Math.round(Math.max(170, entRow ? Math.min(440, vh - 190, vw * .42) : Math.min(400, vh - 430, vw * .84)))

  const insertKey = () => {
    if (!seed || inserted || !tipRef.current || !holeRef.current) return
    const k = tipRef.current.getBoundingClientRect(), h = holeRef.current.getBoundingClientRect()
    setInserted(true); setDragging(false)
    setKey(p => ({ dx: p.dx + (h.left + h.width / 2) - (k.left + k.width / 2), dy: p.dy + (h.top + 14) - k.top }))
    timers.current.push(
      setTimeout(() => setUnlocking(true), reduced ? 0 : 550),
      setTimeout(unlocked, reduced ? 800 : 2900),
    )
  }

  const keyDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!seed || inserted) return
    drag.current = { sx: e.clientX - key.dx, sy: e.clientY - key.dy }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const keyMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    setKey({ dx: e.clientX - drag.current.sx, dy: e.clientY - drag.current.sy })
  }
  const keyUp = () => {
    if (!drag.current || !tipRef.current || !holeRef.current) return
    drag.current = null
    const k = tipRef.current.getBoundingClientRect(), h = holeRef.current.getBoundingClientRect()
    const dist = Math.hypot((k.left + k.width / 2) - (h.left + h.width / 2), k.top - (h.top + h.height / 2))
    if (dist < 70) insertKey()
    else { setDragging(false); setKey({ dx: 0, dy: 0 }) }
  }
  /** A drag the browser took away (system gesture, call, palm rejection) snaps the key back. */
  const keyCancel = () => {
    if (!drag.current) return
    drag.current = null
    setDragging(false); setKey({ dx: 0, dy: 0 })
  }

  // With reduced motion the door doesn't zoom away; it stays on screen, open, until the next screen.
  const doorGone = unlocking && !reduced
  const lampColor = unlocking ? '#9fe08a' : seed ? '#e8b85a' : '#c2584a'
  const mono = { fontFamily: "'Martian Mono',monospace" }

  return (
    <div data-screen-label="01 Vault" style={{ minHeight: '100dvh', overflow: 'clip', display: 'flex', flexDirection: 'column', padding: 'clamp(12px,3vw,26px) clamp(16px,4vw,36px)', gap: 10, background: 'radial-gradient(ellipse at 50% 40%,#2a241c,#15120e 70%)', color: '#e9e1cf' }}>
      <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, ...mono, fontSize: 10, letterSpacing: '.12em', color: '#a89c84' }}>
        <span>AMITTAL.DEV</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 14, whiteSpace: 'nowrap' }}><span>{vw < 520 ? 'VAULT 01' : 'PERSONAL ARCHIVE · VAULT 01'}</span><MotionToggle plain /></span>
      </div>
      <main style={{ flex: '1 0 auto', display: 'flex', flexDirection: entRow ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: entRow ? 72 : 16 }}>
        <h1 className="sr-only">Armaan Mittal · personal archive</h1>
        <div style={{ position: 'relative', flex: 'none', width: vaultPx, height: vaultPx, transform: `scale(${doorGone ? 1.8 : 1})`, opacity: doorGone ? 0 : 1, transition: 'transform 1s cubic-bezier(.7,0,.2,1) 1.2s,opacity 1s 1.2s' }}>
          {sceneOk
            ? <Vault3D seed={seed || '0000000000000000'} ring={d.ring} hue={d.hue} state={unlocking ? 'open' : seed ? 'keyed' : 'locked'} />
            : <VaultDrawing />}
          <div ref={holeRef} style={{ position: 'absolute', left: '50%', top: '50%', width: 28, height: 52, margin: '-26px 0 0 -14px', pointerEvents: 'none' }} />
          <button type="button" aria-label="Vault lamp" onClick={() => { const n = lamp + 1; setLamp(n); if (n >= 5) egg('lamp') }} style={{ position: 'absolute', top: 0, left: '50%', width: 32, height: 32, marginLeft: -16, background: 'transparent', border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: lampColor, boxShadow: `0 0 16px ${lampColor}` }} />
          </button>
        </div>
        <div style={{ position: 'relative', flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: 'min(300px,100%)' }}>
          <div onPointerDown={keyDown} onPointerMove={keyMove} onPointerUp={keyUp} onPointerCancel={keyCancel} onLostPointerCapture={keyCancel}
            style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: !seed ? 'default' : dragging ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none', opacity: !seed ? .35 : doorGone ? 0 : 1, transform: `translate(${key.dx}px,${key.dy}px) rotate(${unlocking ? 90 : 0}deg)`, transition: dragging ? 'none' : 'transform .55s cubic-bezier(.3,.7,.2,1), opacity .6s .5s', zIndex: 5 }}>
            <div ref={tipRef} style={{ width: 8, height: 5, background: '#caa55e', borderRadius: '2px 2px 0 0' }} />
            <div style={{ position: 'relative', width: 8, height: 50, background: 'linear-gradient(90deg,#8d6c30,#d9b76e 45%,#9a7736)' }}>
              <div style={{ position: 'absolute', left: 8, top: 7, width: 10, height: 7, background: '#b8934d' }} />
              <div style={{ position: 'absolute', left: 8, top: 18, width: 7, height: 7, background: '#b8934d' }} />
            </div>
            <div style={{ width: 38, height: 38, borderRadius: '50%', border: '9px solid #c29d56', boxShadow: 'inset 0 0 0 1px #8d6c30,0 0 0 1px #8d6c30' }} />
            <div style={{ width: 1, height: 10, background: '#a89c84' }} />
            <div onDoubleClick={() => { if (!seed) return; setTagFlipped(f => !f); egg('tag') }}
              style={{ background: '#d9c9a2', color: '#231f18', padding: '8px 12px 10px', transform: `rotate(${seed ? d.tagRot : -3}deg)`, boxShadow: '0 8px 20px rgba(0,0,0,.45)', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 190, minHeight: 54 }}>
              {!tagFlipped ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', ...mono, fontSize: 8, letterSpacing: '.14em', color: '#5a4f3c' }}><span>SESSION SEED</span><span>NO. {seed ? String(parseInt(seed.slice(12), 16)).padStart(5, '0') : '—'}</span></div>
                  <div style={{ ...mono, fontSize: 14, letterSpacing: '.08em', minHeight: 20 }}>{seed || '················'}</div>
                </>
              ) : (
                <>
                  <div style={{ ...mono, fontSize: 8, letterSpacing: '.14em', color: '#5a4f3c' }}>IF FOUND, RETURN TO</div>
                  <div style={{ fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontSize: 16 }}>{LINKS.email}</div>
                  <div style={{ ...mono, fontSize: 8, color: '#5a4f3c' }}>REWARD · ONE CONVERSATION</div>
                </>
              )}
            </div>
          </div>
          {!seed && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
              {revoked && <div className="stencil" style={{ border: '2px solid #d0513f', color: '#ff8f7a', padding: '3px 10px', fontWeight: 800, fontSize: 15, letterSpacing: '.14em', transform: 'rotate(-2deg)' }}>KEY {'0x' + revoked.slice(0, 8)} REVOKED</div>}
              <p style={{ fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontSize: 17, color: '#cfc4ad' }}>{revoked ? 'The vault was resealed. The old key no longer fits. Issue a new one.' : 'The archive is locked. A key must be issued.'}</p>
              <button type="button" onClick={issueKey} className="stencil hover-white" style={{ fontWeight: 700, fontSize: 21, letterSpacing: '.14em', minHeight: 46, padding: '0 30px', background: '#e9e1cf', border: 0, color: '#15120e', cursor: 'pointer', whiteSpace: 'nowrap' }}>ISSUE KEY</button>
            </div>
          )}
          {seed && !inserted && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
              <p style={{ fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontSize: 17, color: '#cfc4ad' }}>This instance of the archive is unique to you.</p>
              <div style={{ ...mono, fontSize: 10, letterSpacing: '.14em', lineHeight: 1.8, color: '#a89c84' }}>
                {vw < 820 ? 'DRAG THE KEY UP INTO THE LOCK' : 'DRAG THE KEY INTO THE LOCK'} · <button type="button" onClick={insertKey} style={{ background: 'transparent', border: 0, padding: '6px 0', color: '#e9e1cf', cursor: 'pointer', font: 'inherit', letterSpacing: 'inherit', textDecoration: 'underline' }}>INSERT FOR ME</button>
              </div>
            </div>
          )}
        </div>
      </main>
      <div style={{ flex: 'none', borderTop: '1px solid #3a342b', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px 16px' }}>
        <div className="stencil" style={{ fontWeight: 500, fontSize: 'clamp(14px,2.4vw,22px)', letterSpacing: '.06em', color: '#cfc4ad' }}>YOU DON'T BROWSE THE ARCHIVE. YOU RECONSTRUCT IT.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontStyle: 'italic', fontSize: 15, color: '#a89c84' }}>Recruiter?</span>
          <button type="button" onClick={goFast} className="hover-light-border" style={{ ...mono, fontSize: 11, letterSpacing: '.14em', minHeight: 44, padding: '0 16px', background: 'transparent', border: '1px solid #6b6252', color: '#e9e1cf', cursor: 'pointer', whiteSpace: 'nowrap' }}>FAST ACCESS →</button>
        </div>
      </div>
    </div>
  )
}
