import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { LINKS } from '../data/content'
import { useReducedMotion, useViewport } from '../hooks'
import type { Handle } from '../lib/audio'
import { derive } from '../lib/seed'
import { sfx, usePrimeAudioOnPress } from '../lib/sfx'
import { KEY_TURN, UNLOCK_END, ZOOM } from '../lib/unlock'
import { useArchive } from '../store'
import { MotionToggle } from './MotionToggle'
import { useSceneAvailable } from '../lib/scene'
import { Vault3D } from './Scene'
import { SoundToggle } from './SoundToggle'
import { VaultDrawing } from './VaultDrawing'

const KEY_EASE = `cubic-bezier(${KEY_TURN.curve.join(',')})`
/** The key slides into the lock, then turns: each takes KEY_TURN.dur. */
const TURN_DELAY = KEY_TURN.dur * 1000
/** With reduced motion the door opens at once and the next screen follows shortly. */
const REDUCED_END = 800

export function Entrance() {
  const seed = useArchive(s => s.seed)
  const revoked = useArchive(s => s.revoked)
  const { issueKey, unlocked, goFast, egg } = useArchive.getState()
  const { vw, vh } = useViewport()
  const reduced = useReducedMotion()
  const sceneOk = useSceneAvailable()
  usePrimeAudioOnPress()

  const [key, setKey] = useState({ dx: 0, dy: 0 })
  const [dragging, setDragging] = useState(false)
  const [inserted, setInserted] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [tagFlipped, setTagFlipped] = useState(false)
  const [lamp, setLamp] = useState(0)
  /** performance.now() at which the key turns and the door starts to open: one clock for CSS, 3D and sound. */
  const [openedAt, setOpenedAt] = useState<number | null>(null)
  const [sceneReady, setSceneReady] = useState(false)
  const holeRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const keyRef = useRef<HTMLDivElement>(null)
  const vaultRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ sx: number; sy: number } | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const sounds = useRef<Handle[]>([])
  const done = useRef(false)
  // Leaving mid-unlock (Fast Access, a reload of the screen) silences what is still to come.
  useEffect(() => () => {
    timers.current.forEach(clearTimeout)
    if (!done.current) sounds.current.forEach(h => h.cancel())
  }, [])

  // The flat drawing stands in until the 3D door has drawn its first frame.
  useLayoutEffect(() => {
    const el = vaultRef.current
    if (!el) return
    const ready = () => setSceneReady(true)
    el.addEventListener('scene-ready', ready)
    if (el.querySelector<HTMLElement & { drawn?: boolean }>('vault-3d')?.drawn) ready()
    return () => el.removeEventListener('scene-ready', ready)
  }, [])

  const d = derive(seed || '0000000000000000')
  const entRow = vw >= 760 && vw / vh >= 1.05
  const vaultPx = Math.round(Math.max(170, entRow ? Math.min(440, vh - 190, vw * .42) : Math.min(400, vh - 430, vw * .84)))

  /**
   * The key goes in, turns, and the door opens, all timed from one moment. Every moving
   * part is a Web Animation (or the 3D door) started at that time, and the sounds are
   * scheduled against the same clock, so none of them waits on React or a timer.
   */
  const insertKey = () => {
    const keyEl = keyRef.current, vault = vaultRef.current
    if (!seed || inserted || !tipRef.current || !holeRef.current || !keyEl || !vault) return
    const k = tipRef.current.getBoundingClientRect(), h = holeRef.current.getBoundingClientRect()
    const from = key, to = { dx: from.dx + (h.left + h.width / 2) - (k.left + k.width / 2), dy: from.dy + (h.top + 14) - k.top }
    const t0 = performance.now(), opened = reduced ? t0 : t0 + TURN_DELAY
    setInserted(true); setDragging(false); setKey(to); setOpenedAt(opened)
    if (!reduced) {
      const at = (p: { dx: number; dy: number }, deg: number) => `translate(${p.dx}px,${p.dy}px) rotate(${deg}deg)`
      keyEl.animate([
        { offset: 0, transform: at(from, 0), easing: KEY_EASE },
        { offset: .5, transform: at(to, 0), easing: KEY_EASE },
        { offset: 1, transform: at(to, 90) },
      ], { duration: TURN_DELAY * 2, fill: 'both' }).startTime = t0
      const zoom = { duration: ZOOM.dur * 1000, delay: ZOOM.at * 1000, fill: 'both' } as const
      vault.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.8)' }], { ...zoom, easing: `cubic-bezier(${ZOOM.curve.join(',')})` }).startTime = opened
      vault.animate([{ opacity: 1 }, { opacity: 0 }], { ...zoom, easing: 'ease' }).startTime = opened
      sounds.current.push(sfx.keyInsert(t0, Math.hypot(to.dx - from.dx, to.dy - from.dy)))
    }
    sounds.current.push(sfx.unlock(opened, d.ring, reduced))
    const after = (at: number, f: () => void) => timers.current.push(setTimeout(f, Math.max(0, at - performance.now())))
    // Reduced motion: the key turns in the same frame the door opens.
    if (reduced) setUnlocking(true)
    else after(opened, () => setUnlocking(true))
    after(opened + (reduced ? REDUCED_END : UNLOCK_END * 1000), () => { done.current = true; unlocked() })
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
  // The zoom itself is a Web Animation started in insertKey.
  const doorGone = unlocking && !reduced
  const lampColor = unlocking ? '#9fe08a' : seed ? '#e8b85a' : '#c2584a'
  const mono = { fontFamily: "'Martian Mono',monospace" }

  return (
    <div data-screen-label="01 Vault" style={{ minHeight: '100dvh', overflow: 'clip', display: 'flex', flexDirection: 'column', padding: 'clamp(12px,3vw,26px) clamp(16px,4vw,36px)', gap: 10, background: 'radial-gradient(ellipse at 50% 40%,#2a241c,#15120e 70%)', color: '#e9e1cf' }}>
      {/* One line down to 374px wide with the longest labels; narrower, the switches wrap under the name. */}
      <div style={{ flex: 'none', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0 16px', ...mono, fontSize: 10, letterSpacing: '.12em', color: '#a89c84' }}>
        <span>AMITTAL.DEV</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 14, whiteSpace: 'nowrap', marginLeft: 'auto' }}>{vw >= 460 && <span>{vw < 630 ? 'VAULT 01' : 'PERSONAL ARCHIVE · VAULT 01'}</span>}<MotionToggle plain /><SoundToggle plain /></span>
      </div>
      <main style={{ flex: '1 0 auto', display: 'flex', flexDirection: entRow ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: entRow ? 72 : 16 }}>
        <h1 className="sr-only">Armaan Mittal · personal archive</h1>
        <div ref={vaultRef} data-part="vault" style={{ position: 'relative', flex: 'none', width: vaultPx, height: vaultPx }}>
          {sceneOk && <Vault3D seed={seed || '0000000000000000'} ring={d.ring} hue={d.hue} state={openedAt != null ? 'open' : seed ? 'keyed' : 'locked'} openedAt={openedAt} />}
          {(!sceneOk || !sceneReady) && <VaultDrawing seed={seed || '0000000000000000'} ring={d.ring} hue={d.hue} size={vaultPx} openedAt={openedAt} reduced={reduced} />}
          <div ref={holeRef} style={{ position: 'absolute', left: '50%', top: '50%', width: 28, height: 52, margin: '-26px 0 0 -14px', pointerEvents: 'none' }} />
          <button type="button" aria-label="Vault lamp" onClick={() => { sfx.lamp(); const n = lamp + 1; setLamp(n); if (n >= 5) egg('lamp') }} style={{ position: 'absolute', top: 0, left: '50%', width: 32, height: 32, marginLeft: -16, background: 'transparent', border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: lampColor, boxShadow: `0 0 16px ${lampColor}` }} />
          </button>
        </div>
        <div style={{ position: 'relative', flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: 'min(300px,100%)' }}>
          <div ref={keyRef} data-part="key" onPointerDown={keyDown} onPointerMove={keyMove} onPointerUp={keyUp} onPointerCancel={keyCancel} onLostPointerCapture={keyCancel}
            style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: !seed ? 'default' : dragging ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none', opacity: !seed ? .35 : doorGone ? 0 : 1, transform: `translate(${key.dx}px,${key.dy}px) rotate(${unlocking ? 90 : 0}deg)`, transition: dragging ? 'none' : inserted ? 'opacity .6s .5s' : 'transform .55s cubic-bezier(.3,.7,.2,1), opacity .6s .5s', zIndex: 5 }}>
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
