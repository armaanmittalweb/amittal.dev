import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { PROJECTS } from '../data/content'
import { useSidebarLayout } from '../hooks'
import { isReducedMotion } from '../lib/motion'
import { sfx } from '../lib/sfx'
import { complete, promptFor, run, type Ink, type Line } from '../lib/teletype'
import { useArchive } from '../store'

const INK: Record<Ink, string> = { cmd: 'var(--ink)', dim: 'var(--muted)', acc: 'var(--accent)', err: 'var(--err)' }
/** Lines print one after another, like paper feeding through; the typebar sounds at most this often. */
const LINE_MS = 26, SOUND_GAP = 70

const BANNER: Line[] = [
  { t: 'AMITTAL.DEV TELETYPE', k: 'acc' },
  { t: 'A shell over the archive. Every file it prints is on the site too.', k: 'dim' },
  { t: 'Type help, or tap a command below.', k: 'dim' },
  { t: '' },
]

interface Printer { push(ls: Line[]): void; clear(): void }

/**
 * The Lab's teletype: a panel at the foot of the screen, opened with ` from anywhere in the
 * archive or from the Lab. It stays mounted so its paper, place and history survive closing.
 */
export function Teletype() {
  const open = useArchive(s => s.tty)
  const cwd = useArchive(s => s.ttyCwd)
  const projectId = useArchive(s => s.projectId)
  const toggleTty = useArchive(s => s.toggleTty)
  const desk = useSidebarLayout()

  const [lines, setLines] = useState<Line[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const history = useRef<string[]>([])
  const walk = useRef<number | null>(null)
  const printer = useRef<Printer | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const opener = useRef<Element | null>(null)
  const greeted = useRef(false)

  // The paper feed: a queue drained one line every LINE_MS, with the typebar at most every SOUND_GAP.
  // Under reduced motion a whole printout lands at once.
  useEffect(() => {
    const queue: Line[] = []
    let timer = 0, lastSound = 0
    const typebar = () => {
      const now = performance.now()
      if (now - lastSound < SOUND_GAP) return
      lastSound = now
      sfx.typebar()
    }
    const step = () => {
      const next = queue.shift()
      if (!next) { timer = 0; return }
      setLines(l => [...l, next].slice(-500))
      typebar()
      timer = window.setTimeout(step, LINE_MS)
    }
    printer.current = {
      push(ls) {
        if (!ls.length) return
        if (isReducedMotion()) { setLines(l => [...l, ...ls].slice(-500)); typebar(); return }
        queue.push(...ls)
        if (!timer) step()
      },
      clear() { queue.length = 0; clearTimeout(timer); timer = 0; setLines([]) },
    }
    return () => clearTimeout(timer)
  }, [])
  const print = (ls: Line[]) => printer.current?.push(ls)

  // Opening: follow the visitor to the drawing they are looking at, greet once, take focus.
  // Closing: give focus back to whatever had it.
  useEffect(() => {
    if (!open) {
      if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus({ preventScroll: true })
      return
    }
    opener.current = document.activeElement
    if (!greeted.current) { greeted.current = true; printer.current?.push(BANNER) }
    inputRef.current?.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines, open])

  const submit = async (raw: string) => {
    const cmd = raw.trim()
    print([{ t: promptFor(cwd) + ' ' + raw, k: 'cmd' }])
    if (!cmd) return
    history.current = [...history.current, cmd].slice(-100)
    walk.current = null
    useArchive.getState().visit('terminal', 'interface')
    setBusy(true)
    try {
      const r = await run(cmd, cwd, history.current)
      if (r.clear) printer.current?.clear()
      if (r.cwd !== undefined) useArchive.getState().setTtyCwd(r.cwd)
      print(r.lines)
      if (r.close) toggleTty(false)
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const h = history.current
    if (e.key === 'Enter') {
      e.preventDefault()
      if (busy) return
      const v = input
      setInput('')
      void submit(v)
    } else if (e.key === 'Escape') {
      // Handled here, so the archive's own Escape (leave for Fast Access) doesn't also fire.
      e.preventDefault()
      toggleTty(false)
    } else if (e.key === 'ArrowUp') {
      if (!h.length) return
      e.preventDefault()
      walk.current = walk.current === null ? h.length - 1 : Math.max(0, walk.current - 1)
      setInput(h[walk.current])
    } else if (e.key === 'ArrowDown') {
      if (walk.current === null) return
      e.preventDefault()
      walk.current = walk.current + 1
      if (walk.current >= h.length) { walk.current = null; setInput('') } else setInput(h[walk.current])
    } else if (e.key === 'Tab' && input.trim()) {
      // Tab completes a half-typed word; on an empty line it moves focus as usual.
      const hits = complete(input, cwd)
      if (!hits.length) return
      e.preventDefault()
      if (hits.length === 1) {
        const parts = input.split(' ')
        parts[parts.length - 1] = hits[0]
        setInput(parts.join(' ') + ' ')
      } else print([{ t: hits.join('   '), k: 'dim' }])
    }
  }

  if (!open) return null

  const chips = cwd
    ? ['cat README', 'pipeline', 'cat decisions', 'cat incidents', 'git log', 'open', 'cd ..']
    : ['help', 'ls -l', 'cd ' + (PROJECTS.find(p => p.id === projectId)?.id ?? PROJECTS[0].id), 'whoami', 'ask c++ latency', 'tree']

  return (
    <section aria-label="Teletype" className="tty" style={{
      position: 'fixed', zIndex: 45, display: 'flex', flexDirection: 'column',
      ...(desk
        ? { right: 20, bottom: 20, width: 'min(700px, calc(100vw - 40px))', height: 'min(470px, 62vh)' }
        : { left: 0, right: 0, bottom: 0, height: '60vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }),
      backgroundColor: 'var(--panel)', color: 'var(--ink)', border: '1.5px solid var(--ink)', boxShadow: desk ? '6px 6px 0 var(--line)' : 'none',
    }}>
      <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px dashed var(--line)', fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)' }}>
        <span>TELETYPE · {cwd ? '/LAB/' + cwd.toUpperCase() : '/LAB'}</span>
        <button type="button" onClick={() => toggleTty(false)} className="mono" style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--ink)', cursor: 'pointer', fontSize: 10, letterSpacing: '.12em', padding: '5px 9px' }}>
          {desk ? '` · CLOSE' : 'CLOSE ✕'}
        </button>
      </div>
      <div ref={logRef} role="log" aria-live="polite" aria-label="Teletype output" className="mono"
        onClick={() => { if (!String(window.getSelection() || '')) inputRef.current?.focus({ preventScroll: true }) }}
        style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '12px 0', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {lines.map((l, i) => (
          <div key={i} style={{ minHeight: '1.7em', color: l.k ? INK[l.k] : 'var(--ink)', fontWeight: l.k === 'cmd' ? 600 : 400 }}>{l.t}</div>
        ))}
      </div>
      <div role="group" aria-label="Suggested commands" style={{ display: 'flex', gap: 6, padding: '8px 0', borderTop: '1px dashed var(--line)', ...(desk ? { flexWrap: 'wrap' } : { overflowX: 'auto', scrollbarWidth: 'none' }) }}>
        {chips.map(c => (
          <button key={c} type="button" disabled={busy} onClick={() => { void submit(c); inputRef.current?.focus({ preventScroll: true }) }} className="mono"
            style={{ flex: 'none', fontSize: 10, letterSpacing: '.06em', padding: '6px 9px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', cursor: 'pointer' }}>{c}</button>
        ))}
      </div>
      <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 12px', borderTop: '1px dashed var(--line)', fontSize: 12.5 }}>
        <label htmlFor="tty-input" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{promptFor(cwd)}</label>
        <input id="tty-input" ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
          autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="send"
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', color: 'var(--ink)', font: 'inherit', caretColor: 'var(--accent)' }} />
      </div>
    </section>
  )
}
