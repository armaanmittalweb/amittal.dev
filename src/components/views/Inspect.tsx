import { useEffect, useState } from 'react'
import { EGGS, LAYERS, MATERIAL, PROJECTS } from '../../data/content'
import { useReducedMotion } from '../../hooks'
import { derive } from '../../lib/seed'
import { useArchive } from '../../store'
import { useSceneAvailable } from '../../lib/scene'
import { Archive3D } from '../Scene'
import { Stage, StageHint } from '../Stage'

/** Frames per second, measured while this page is open. */
function useFps() {
  const [fps, setFps] = useState<number | null>(null)
  useEffect(() => {
    let frames = 0, last = performance.now(), raf = 0
    const loop = (t: number) => {
      frames++
      if (t - last >= 1000) { setFps(Math.round(frames * 1000 / (t - last))); frames = 0; last = t }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return fps
}

function Rows({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <dl className="mono" style={{ margin: 0, display: 'flex', flexDirection: 'column', fontSize: 11 }}>
      <div style={{ fontSize: 10, letterSpacing: '.14em', color: 'var(--accent)', paddingBottom: 10 }}>{title}</div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
          <dt style={{ color: 'var(--muted)' }}>{k}</dt><dd style={{ margin: 0, textAlign: 'right' }}>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Inspect() {
  const seed = useArchive(s => s.seed) || '0000000000000000'
  const layerIdx = useArchive(s => s.layer)
  const log = useArchive(s => s.log)
  const sound = useArchive(s => s.sound)
  const eggs = useArchive(s => s.eggs)
  const { setLayer, go, lockdown } = useArchive.getState()
  const reduced = useReducedMotion()
  const fps = useFps()
  const sceneOk = useSceneAvailable()
  const d = derive(seed)
  const layer = LAYERS[layerIdx] || LAYERS[0]
  const nextEgg = EGGS.find(e => !eggs[e.id])
  const btn = { fontSize: 10, letterSpacing: '.12em', padding: '11px 16px', background: 'transparent', cursor: 'pointer' } as const
  const step = (k: number) => setLayer((layerIdx + k + LAYERS.length) % LAYERS.length)
  const stepBtn = { minHeight: 40, minWidth: 44, padding: '0 12px', fontSize: 10, letterSpacing: '.12em', border: '1px solid var(--ink)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer' } as const

  // The stepper sits on the edge that touches the figure: directly under it when stacked,
  // beside it when side by side. Stepping never scrolls the figure out of view.
  const layerCard = (
    <div style={{ padding: 'clamp(16px,3vw,22px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.14em', color: 'var(--accent)' }}>
          LAYER {String(layerIdx + 1).padStart(2, '0')} / {String(LAYERS.length).padStart(2, '0')} <span style={{ color: 'var(--muted)' }}>· {layer.part}</span>
        </span>
        <div role="group" aria-label="Step through layers" className="mono" style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => step(-1)} style={stepBtn}>← PREV</button>
          <button type="button" onClick={() => step(1)} style={stepBtn}>NEXT →</button>
        </div>
      </div>
      <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="label">{layer.k}</div>
        <h2 className="stencil" style={{ fontWeight: 800, fontSize: 'clamp(28px,5vw,44px)', lineHeight: .95 }}>{layer.v}</h2>
        <p style={{ fontSize: 'clamp(16px,1.6vw + 10px,19px)', lineHeight: 1.45, textWrap: 'pretty' }}>{layer.why}</p>
      </div>
    </div>
  )

  return (
    <div data-screen-label="12 Inspect system" style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, borderBottom: '1px solid var(--line)', paddingBottom: 28 }}>
        <div className="kicker">SOURCE · SYSTEM: AMITTAL.DEV · NEGATIVE</div>
        <h1 className="stencil" style={{ fontWeight: 800, fontSize: 'clamp(40px,11vw,104px)', lineHeight: .84 }}>THE PORTFOLIO<br />IS THE PROJECT.</h1>
        <p style={{ fontSize: 21, fontStyle: 'italic', maxWidth: 620, lineHeight: 1.45, color: 'var(--muted)' }}>You are inside one of my projects. The vault, the paper and the film are layers of the same system.</p>
      </div>
      {sceneOk
        ? <Stage label="Exploded view of the vault" panel={layerCard}
            hStack="clamp(220px, calc(var(--avail) - 300px), 460px)" hSide="clamp(300px, calc(var(--avail) - 40px), 540px)"
            view={<Archive3D mode="exploded" mat={MATERIAL.inspect} hue={d.hue} data={{ layers: LAYERS.map(l => ({ k: l.k, v: l.part })), sel: layerIdx }} />}
            overlay={<StageHint short="TAP A LAYER · DRAG TO TURN">EACH PART OF THE VAULT IS A LAYER OF THE STACK · TAP A LAYER · DRAG TO TURN</StageHint>} />
        : <section style={{ border: '1px solid var(--line)' }}>{layerCard}</section>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: '30px 40px', alignItems: 'start' }}>
        <Rows title="DERIVED FROM YOUR SEED" rows={[
          ['SESSION SEED', seed],
          ['PRNG INPUT', '0x' + seed.slice(0, 8) + ' ⊕ 0x' + seed.slice(8)],
          ['ACCENT HUE', d.hue + '°'],
          ['VAULT RING', d.ring + '°'],
          ['DRONE', d.base + ' HZ · CHORD ' + (d.chord + 1)],
          ['MISFILED RECORD', 'DRAWER · ' + d.misfiled.toUpperCase()],
          ['LAB ORDER', d.order.map(id => PROJECTS.find(p => p.id === id)!.name).join(' / ')],
        ]} />
        <Rows title="PERFORMANCE · LIVE" rows={[
          ['FPS', fps == null ? '—' : String(fps)],
          ['INTERACTIONS LOGGED', String(log).padStart(2, '0')],
          ['3D', sceneOk ? 'WEBGL' : 'UNAVAILABLE'],
          ['MOTION', reduced ? 'REDUCED' : 'FULL'],
          ['AUDIO', sound ? `${d.base} HZ · CHORD ${d.chord + 1}` : 'MUTED'],
          ['STORAGE', 'THIS BROWSER ONLY'],
        ]} />
        <div className="mono" style={{ display: 'flex', flexDirection: 'column', fontSize: 11 }}>
          <div style={{ fontSize: 10, letterSpacing: '.14em', color: 'var(--accent)', paddingBottom: 10 }}>EASTER EGGS · {String(Object.keys(eggs).length).padStart(2, '0')}/{EGGS.length}</div>
          {EGGS.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)' }}>{e.code}</span><span style={{ color: eggs[e.id] ? 'var(--accent)' : 'var(--muted)', textAlign: 'right' }}>{eggs[e.id] ? e.title : '· · · · ·'}</span>
            </div>
          ))}
          <div style={{ paddingTop: 12, color: 'var(--muted)', lineHeight: 1.7 }}>{nextEgg ? 'HINT · ' + nextEgg.hint : 'ALL EGGS FOUND. YOU READ THE WHOLE ARCHIVE.'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => go('hub')} className="mono" style={{ ...btn, border: '1px solid var(--ink)', color: 'var(--ink)' }}>← BACK TO THE CORE</button>
        <button type="button" onClick={() => lockdown(false)} className="mono" style={{ ...btn, border: '1px solid var(--line)', color: 'var(--muted)' }}>ISSUE A NEW KEY</button>
      </div>
    </div>
  )
}
