import { lazy, Suspense, useEffect, useState } from 'react'
import { useArchive } from '../store'

// The panel and its shell load on first open, in their own chunk, so the archive itself gets no heavier.
const Teletype = lazy(() => import('./Teletype').then(m => ({ default: m.Teletype })))

const editable = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || el.matches('input, textarea, select'))

/** Listens for ` everywhere in the archive and hosts the teletype once it has been opened. */
export function TeletypeHost() {
  const open = useArchive(s => s.tty)
  const [loaded, setLoaded] = useState(open)
  if (open && !loaded) setLoaded(true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '`' || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return
      // A backtick typed into another field is just a character; in the teletype's own line it closes it.
      if (editable(e.target) && (e.target as HTMLElement).id !== 'tty-input') return
      e.preventDefault()
      useArchive.getState().toggleTty()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return loaded ? <Suspense fallback={null}><Teletype /></Suspense> : null
}
