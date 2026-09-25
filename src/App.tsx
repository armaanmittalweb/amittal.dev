import { useEffect } from 'react'
import { Core } from './components/Core'
import { Entrance } from './components/Entrance'
import { FastAccess } from './components/FastAccess'
import { Objective } from './components/Objective'
import { Toast } from './components/Toast'
import { MATERIAL } from './data/content'
import { useGlobalListeners, useMotionAttribute, useReducedMotion, useTilt } from './hooks'
import { derive } from './lib/seed'
import { theme, themeVars } from './lib/theme'
import { useArchive } from './store'

export default function App() {
  const screen = useArchive(s => s.screen)
  const view = useArchive(s => s.view)
  const seed = useArchive(s => s.seed)
  const glitch = useArchive(s => s.glitch)
  const negative = useArchive(s => s.negative)
  const reduced = useReducedMotion()

  useMotionAttribute(reduced)
  useGlobalListeners()
  useTilt(!reduced)

  const hue = derive(seed || '0000000000000000').hue
  const T = theme(screen === 'core' ? MATERIAL[view] : screen === 'entrance' ? 'vault' : 'paper', hue)
  const filter = glitch === 1 ? 'invert(1) sepia(.4)' : glitch === 2 ? 'contrast(4) grayscale(1)' : negative ? 'invert(1) hue-rotate(180deg)' : ''

  // On <html>, a filter doesn't become the containing block for position:fixed
  // children, so the mobile menu and toast stay pinned to the viewport.
  useEffect(() => { document.documentElement.style.filter = filter }, [filter])

  return (
    <>
      <div style={{
        ...themeVars(T), minHeight: '100vh', backgroundColor: 'var(--bg)', backgroundImage: 'var(--tex)', backgroundSize: 'var(--tex-size)',
        color: 'var(--ink)', fontFamily: "'Newsreader',serif", transition: 'background-color .9s,color .9s',
      }}>
        {screen === 'entrance' && <Entrance />}
        {screen === 'objective' && <Objective />}
        {screen === 'core' && <Core />}
        {screen === 'fast' && <FastAccess />}
      </div>
      <Toast />
    </>
  )
}
