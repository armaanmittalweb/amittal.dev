import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react'
import { isReducedMotion, onSystemMotionChange, systemPrefersReduced } from './lib/motion'
import { sfx } from './lib/sfx'
import { useArchive } from './store'

/** Exact viewport size, at most one update per frame. Only the Entrance needs this; everything else uses useIsDesk. */
export function useViewport() {
  const [vp, setVp] = useState({ vw: window.innerWidth, vh: window.innerHeight })
  useEffect(() => {
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setVp({ vw: window.innerWidth, vh: window.innerHeight }))
    }
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('resize', on); cancelAnimationFrame(raf) }
  }, [])
  return vp
}

/** A media query as a stable subscribe/read pair, so hooks re-render only when it flips. */
function media(query: string) {
  const mq = window.matchMedia(query)
  return {
    subscribe: (cb: () => void) => {
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    get: () => mq.matches,
  }
}
const DESK = media('(min-width: 820px)')
// The sidebar layout needs width for the sidebar and height for a sticky header plus a
// usable view, so tablets in portrait and phones in landscape get the mobile layout.
const SIDEBAR = media('(min-width: 1024px) and (min-height: 600px)')

/** Two-column content (label beside text). */
export const useIsDesk = () => useSyncExternalStore(DESK.subscribe, DESK.get)
/** Sidebar and full header, versus top bar and drawer strip. */
export const useSidebarLayout = () => useSyncExternalStore(SIDEBAR.subscribe, SIDEBAR.get)

/** Publishes a sticky header's height as --hdr-h, which sizes 3D stages and scroll offsets. */
export function useHeaderHeight(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const ro = new ResizeObserver(() => {
      const h = Math.round(el.getBoundingClientRect().height)
      if (h) root.style.setProperty('--hdr-h', h + 'px')
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
}

/**
 * Brings content the visitor just revealed into view with the least scrolling,
 * clear of the sticky header (see [data-reveal] in app.css). Waits a frame for layout.
 */
export function reveal(el: Element | null | undefined) {
  if (!el) return
  requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest', behavior: isReducedMotion() ? 'auto' : 'smooth' }))
}

/** The effective motion setting: the visitor's explicit choice, else their OS preference. */
export function useReducedMotion() {
  const pref = useArchive(s => s.motion)
  const system = useSyncExternalStore(onSystemMotionChange, systemPrefersReduced)
  return pref === 'reduced' || (pref === 'system' && system)
}

/** Publishes the motion setting on <html data-motion> for CSS, the store and the 3D elements. */
export function useMotionAttribute(reduced: boolean) {
  useEffect(() => { document.documentElement.dataset.motion = reduced ? 'reduced' : 'full' }, [reduced])
}

const KONAMI = 'ArrowUp ArrowUp ArrowDown ArrowDown ArrowLeft ArrowRight ArrowLeft ArrowRight b a'

const editable = (el: EventTarget | null): el is HTMLElement =>
  el instanceof HTMLElement && (el.isContentEditable || el.matches('input, textarea, select'))

/** Page-wide listeners: keyboard shortcuts, easter eggs, and events from the 3D views. */
export function useGlobalListeners() {
  useEffect(() => {
    const store = useArchive.getState
    let keys: string[] = []
    let typed = ''
    let lastAct = Date.now()
    let hiddenAt: number | null = null
    const title = document.title

    const onKey = (e: KeyboardEvent) => {
      lastAct = Date.now()
      // Keys an IME is composing with belong to the text, not to shortcuts or typed eggs.
      if (e.isComposing || e.keyCode === 229) return
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return
        // In a field Escape clears autocomplete or the text, so it only lets go of the
        // field; a second press is the shortcut.
        if (editable(e.target)) { e.target.blur(); return }
        const s = store()
        if (s.menuOpen) s.toggleMenu()
        else if (s.screen === 'core' || s.screen === 'objective') s.goFast()
        else if (s.screen === 'fast') s.leaveFast()
        return
      }
      keys = [...keys, e.key].slice(-10)
      if (keys.join(' ') === KONAMI) { keys = []; store().toggleNegative(); store().egg('konami') }
      if (e.key.length === 1) {
        typed = (typed + e.key.toLowerCase()).slice(-8)
        if (typed.endsWith('sudo')) store().egg('sudo')
      }
    }
    // Scrolling and touch count as activity: reading down a page is not dozing off.
    const ACTIVITY = ['pointermove', 'pointerdown', 'wheel', 'scroll', 'touchstart'] as const
    const onAct = () => { lastAct = Date.now() }
    const idle = setInterval(() => {
      if (!document.hidden && store().screen === 'core' && Date.now() - lastAct > 40000) store().egg('idle')
    }, 5000)
    const onVisibility = () => {
      if (document.hidden) {
        if (store().seed) { hiddenAt = Date.now(); document.title = 'The vault is open. Come back.' }
      } else {
        document.title = title
        lastAct = Date.now() // time away doesn't count as idle
        if (hiddenAt) { hiddenAt = null; store().egg('tab') }
      }
    }
    const on3d = (e: Event) => {
      const d = (e as CustomEvent).detail || {}
      const s = store()
      if (d.type === 'open') s.openKey(d.key)
      else if (d.type === 'drawer') sfx.drawer(d.z)
      else if (d.type === 'node') s.setNode(d.id)
      else if (d.type === 'stage') s.toggleStage(d.i)
      else if (d.type === 'layer') s.setLayer(d.i)
      else if (d.type === 'reel') s.toggleRes(d.i)
      else if (d.type === 'hover' && d.mode === 'cabinet') s.setCabHover(d.i)
    }

    window.addEventListener('keydown', onKey)
    ACTIVITY.forEach(t => window.addEventListener(t, onAct, { passive: true }))
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('archive3d', on3d)

    console.log('%cAMITTAL.DEV', 'font:800 28px sans-serif;letter-spacing:4px')
    console.log('%cYou opened the source drawer. Call archive.knock() to be let in.', 'font:12px monospace')
    ;(window as unknown as { archive: object }).archive = {
      knock: () => { store().egg('console'); return 'Door open. Seed: ' + (store().seed || 'none issued yet') },
    }

    return () => {
      window.removeEventListener('keydown', onKey)
      ACTIVITY.forEach(t => window.removeEventListener(t, onAct))
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('archive3d', on3d)
      clearInterval(idle)
    }
  }, [])
}

/** Cards marked data-tilt lean toward the pointer. Off for touch and reduced motion. */
export function useTilt(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    let current: HTMLElement | null = null
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('[data-tilt]') ?? null
      if (current && current !== el) current.style.transform = ''
      current = el
      if (!el) return
      const b = el.getBoundingClientRect(), x = (e.clientX - b.left) / b.width - .5, y = (e.clientY - b.top) / b.height - .5, k = +(el.dataset.tilt || 8)
      el.style.transform = 'perspective(900px) rotateX(' + (-y * k).toFixed(2) + 'deg) rotateY(' + (x * k).toFixed(2) + 'deg) translateZ(0)'
    }
    document.addEventListener('pointermove', onMove)
    return () => {
      document.removeEventListener('pointermove', onMove)
      if (current) current.style.transform = ''
    }
  }, [enabled])
}
