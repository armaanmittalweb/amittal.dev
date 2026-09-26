// Named sound effects, one per thing the visitor does. Each is called from the action
// that causes the visual change it accompanies, and does nothing while sound is off.
import { useEffect } from 'react'
import { play, primeAudio, type Handle } from './audio'
import { isReducedMotion } from './motion'
import * as S from './synth'

// One-shots answer a click; if the context is still waking, they may start up to 80 ms late
// before they are dropped. Timed sequences allow 25 ms.
const now = (name: string, parts: S.Part[]) => play(name, parts, { late: 80 })

export const sfx = {
  keyJingle: () => now('jingle', S.keyJingle()),
  /** `frame` is the rAF time the key's transition starts; `dist` its travel in px. */
  keyInsert: (frame: number, dist: number): Handle => play('insert', S.keyInsert(dist), { zero: frame }),
  /** `openedAt` is the rAF time the unlock starts: the same zero the door and the CSS zoom use. */
  unlock: (openedAt: number, ring: number, reduced: boolean): Handle =>
    play('unlock', reduced ? S.unlockCompact() : S.unlockParts(ring), { zero: openedAt }),
  lamp: () => now('relay', S.relay()),
  /** The 3D cabinet: the drawer slides out on its runners (its travel is 1.2 - z). */
  drawer: (z: number) => isReducedMotion() ? now('thunk', S.drawerThunk()) : now('drawer', S.drawerSlide(1.2 - z)),
  /** The text drawer list: nothing moves, so just the thunk. */
  drawerThunk: () => now('thunk', S.drawerThunk()),
  stageDrop: () => now('drop', S.stageDrop()),
  stageRefit: () => now('refit', S.stageRefit()),
  glitch: (): Handle => play('glitch', S.glitchStatic()),
  shutter: () => now('shutter', S.shutter()),
  stamp: () => now('stamp', S.stamp()),
  rattle: () => now('rattle', S.rattle()),
  slam: () => now('slam', S.slam()),
}

/**
 * On screens that make sounds, a press anywhere (pointerdown, or a key) wakes the audio,
 * creating it the first time: a returning visitor who lands in the Core never sees ISSUE KEY. Every sound here follows a click or pointerup, so the context is
 * up by then, and its one-time start-up cost falls in the press, before anything moves.
 */
export function usePrimeAudioOnPress() {
  useEffect(() => {
    // Any key that could act (Enter, Space, the letters of an easter egg); not Esc, which leaves for Fast Access, or Tab.
    const onKey = (e: KeyboardEvent) => { if (!['Escape', 'Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) primeAudio() }
    document.addEventListener('pointerdown', primeAudio, { capture: true, passive: true })
    document.addEventListener('keydown', onKey, { capture: true })
    return () => {
      document.removeEventListener('pointerdown', primeAudio, { capture: true })
      document.removeEventListener('keydown', onKey, { capture: true })
    }
  }, [])
}
