import { useEffect, useLayoutEffect } from 'react'
import { Core } from './components/Core'
import { Entrance } from './components/Entrance'
import { FastAccess } from './components/FastAccess'
import { Objective } from './components/Objective'
import { Hearts } from './components/Hearts'
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
  const negative = useArchive(s => s.negative)
  const bloom = useArchive(s => s.bloom)
  const reduced = useReducedMotion()

  useMotionAttribute(reduced)
  useGlobalListeners()
  useTilt(!reduced)

  const hue = derive(seed || '0000000000000000').hue
  // Bloom recolours every screen the visitor has unlocked; the vault stays the vault.
  const material = bloom && screen !== 'entrance' ? 'bloom' : screen === 'core' ? MATERIAL[view] : screen === 'entrance' ? 'vault' : 'paper'
  const filter = negative ? 'invert(1) hue-rotate(180deg)' : ''

  // The theme lives on <html>, whose background is --bg: during a page transition the old
  // page fades out onto the new drawer's colour, never through a mix of the two.
  useLayoutEffect(() => {
    const s = document.documentElement.style
    for (const [k, v] of Object.entries(themeVars(theme(material, hue)))) s.setProperty(k, String(v))
  }, [material, hue])
  // On <html>, a filter doesn't become the containing block for position:fixed
  // children, so the mobile menu and toast stay pinned to the viewport.
  useEffect(() => { document.documentElement.style.filter = filter }, [filter])

  return (
    <>
      <div style={{
        minHeight: '100vh', backgroundColor: 'var(--bg)', backgroundImage: 'var(--tex)', backgroundSize: 'var(--tex-size)',
        color: 'var(--ink)', fontFamily: "'Newsreader',serif",
      }}>
        {screen === 'entrance' && <Entrance />}
        {screen === 'objective' && <Objective />}
        {screen === 'core' && <Core />}
        {screen === 'fast' && <FastAccess />}
      </div>
      {bloom && screen !== 'entrance' && <Hearts />}
      <Toast />
    </>
  )
}
