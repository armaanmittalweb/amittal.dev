import { useEffect, type CSSProperties } from 'react'
import { markSceneBroken, registerScenes, useSceneAvailable } from '../lib/scene'

/** Registers the custom elements on first use. Failures inside an element reach lib/scene through a window listener. */
function useScene() {
  const failed = !useSceneAvailable()
  useEffect(() => {
    if (!failed) registerScenes().catch(markSceneBroken)
  }, [failed])
  return failed
}

const fill: CSSProperties = { position: 'absolute', inset: 0 }
const grow: CSSProperties = { position: 'relative', display: 'block', width: '100%', minHeight: 200 }

export type ArchiveMode = 'cabinet' | 'graph' | 'pipeline' | 'seed' | 'exploded' | 'reel'

/**
 * A 3D view. Always hidden from assistive tech: every view has a DOM equivalent
 * on the same screen. Renders nothing if WebGL fails; callers check
 * useSceneAvailable() to show their text version instead.
 */
export function Archive3D({ mode, mat, hue, data, autoHeight }: { mode: ArchiveMode; mat: string; hue: number; data: unknown; autoHeight?: boolean }) {
  if (useScene()) return null
  // autoHeight: the element sets its own height from its layout (the pipeline does, by rows).
  return <archive-3d mode={mode} mat={mat} hue={String(hue)} data={JSON.stringify(data)} aria-hidden="true" style={autoHeight ? grow : fill} />
}

export function Vault3D({ seed, ring, hue, state }: { seed: string; ring: number; hue: number; state: 'locked' | 'keyed' | 'open' }) {
  if (useScene()) return null
  return <vault-3d seed={seed} ring={String(ring)} hue={String(hue)} state={state} aria-hidden="true" style={fill} />
}

/** One line at the top of the Core when 3D is off, so the plainer layouts don't look like a bug. */
export function SceneNotice() {
  if (useSceneAvailable()) return null
  return (
    <p role="note" className="mono" style={{ fontSize: 10, letterSpacing: '.12em', lineHeight: 1.7, color: 'var(--muted)', borderLeft: '2px solid var(--line)', paddingLeft: 10 }}>
      3D UNAVAILABLE IN THIS BROWSER · EVERY DRAWER IS SHOWN IN ITS TEXT FORM
    </p>
  )
}
