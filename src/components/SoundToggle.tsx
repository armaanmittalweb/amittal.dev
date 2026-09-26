import type { CSSProperties } from 'react'
import { useArchive } from '../store'

const plainStyle: CSSProperties = { background: 'transparent', border: 0, padding: '6px 0', color: 'inherit', cursor: 'pointer', font: 'inherit', letterSpacing: 'inherit', whiteSpace: 'nowrap' }

/** The master switch for every sound on the site. */
export function SoundToggle({ plain, className, style }: { plain?: boolean; className?: string; style?: CSSProperties }) {
  const sound = useArchive(s => s.sound)
  const toggleSound = useArchive(s => s.toggleSound)
  return (
    <button type="button" className={className} style={{ ...(plain ? plainStyle : {}), ...style }} title={sound ? 'Turn all sound off' : 'Turn sound on'}
      onClick={toggleSound}>
      SOUND · {sound ? 'ON' : 'OFF'}
    </button>
  )
}

/** The seed-tuned drone. Turning it on turns sound on too. */
export function DroneToggle({ className, style }: { className?: string; style?: CSSProperties }) {
  const drone = useArchive(s => s.drone)
  const toggleDrone = useArchive(s => s.toggleDrone)
  return (
    <button type="button" className={className} style={style} title={drone ? 'Stop the drone' : 'Play a drone tuned from your seed'}
      onClick={toggleDrone}>
      DRONE · {drone ? 'ON' : 'OFF'}
    </button>
  )
}
