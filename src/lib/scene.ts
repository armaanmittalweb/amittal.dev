import { useSyncExternalStore } from 'react'

let registration: Promise<unknown> | null = null
let webgl: boolean | null = null
let broken = false
const listeners = new Set<() => void>()

/** Probe once and release the context straight away; browsers cap how many can be alive. */
function webglAvailable() {
  if (webgl !== null) return webgl
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl')
    webgl = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch { webgl = false }
  return webgl
}

/** Once any scene fails, every view switches to its text form for the rest of the visit. */
export function markSceneBroken() {
  if (broken) return
  broken = true
  listeners.forEach(l => l())
}

// The 3D elements report failure with a bubbling 'scene-unavailable' event. Listening
// on window, from before any element exists, catches failures during connect as well.
window.addEventListener('scene-unavailable', markSceneBroken)

/** Loads three.js and defines the custom elements, once. */
export function registerScenes() {
  registration ??= import('../three/register.js')
  return registration
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}
const available = () => !broken && webglAvailable()

/** Whether 3D views can render. Views use it to hide drag hints and pick text-first layouts. */
export function useSceneAvailable() {
  return useSyncExternalStore(subscribe, available)
}
