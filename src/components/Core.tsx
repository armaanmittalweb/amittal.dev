import { useEffect, useRef, type ComponentType } from 'react'
import { MATERIAL, NAV, OBJECTIVES, TARGETS, type View } from '../data/content'
import { useHeaderHeight, useSidebarLayout } from '../hooks'
import { useArchive } from '../store'
import { MisfiledNote } from './ui'
import { MotionToggle } from './MotionToggle'
import { SceneNotice } from './Scene'
import { Capabilities } from './views/Capabilities'
import { Colophon } from './views/Colophon'
import { Hub } from './views/Hub'
import { Identity } from './views/Identity'
import { Inspect } from './views/Inspect'
import { Lab } from './views/Lab'
import { Project } from './views/Project'
import { Report } from './views/Report'
import { Research } from './views/Research'
import { Resume } from './views/Resume'
import { Trace } from './views/Trace'

const VIEWS: Record<View, ComponentType> = {
  hub: Hub, identity: Identity, capabilities: Capabilities, resume: Resume, trace: Trace, lab: Lab,
  project: Project, research: Research, report: Report, inspect: Inspect, colophon: Colophon,
}

function useCoreState() {
  const view = useArchive(s => s.view)
  const visited = useArchive(s => s.visited)
  const objective = useArchive(s => s.objective)
  const obj = OBJECTIVES.find(o => o.id === objective) || OBJECTIVES[0]
  const done = TARGETS.filter(t => visited[t]).length
  return { view, visited, obj, done, doneText: String(done).padStart(2, '0') + '/' + TARGETS.length, mat: MATERIAL[view] }
}

function Materials({ current, pad }: { current: string; pad: string }) {
  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }} aria-label={'Material: ' + current}>
      {(['paper', 'draft', 'film'] as const).map(m => {
        const on = m === current
        return <span key={m} aria-hidden="true" style={{ padding: pad, border: '1px solid ' + (on ? 'var(--ink)' : 'var(--line)'), color: on ? 'var(--bg)' : 'var(--muted)', background: on ? 'var(--ink)' : 'transparent' }}>{m.toUpperCase()}</span>
      })}
    </span>
  )
}

function PathList({ big }: { big?: boolean }) {
  const { visited, obj } = useCoreState()
  const openKey = useArchive(s => s.openKey)
  return (
    <>
      {obj.path.map(([label, key]) => {
        const seen = !!visited[key]
        return (
          <button key={key} type="button" onClick={() => openKey(key)}
            style={big
              ? { display: 'flex', gap: 12, alignItems: 'center', minHeight: 48, background: 'transparent', border: 0, borderBottom: '1px solid var(--line)', color: 'var(--ink)', cursor: 'pointer', textAlign: 'left', fontSize: 20, opacity: seen ? .6 : 1 }
              : { display: 'flex', gap: 10, alignItems: 'center', padding: '3px 0', background: 'transparent', border: 0, color: 'var(--ink)', cursor: 'pointer', textAlign: 'left', fontSize: 16, opacity: seen ? .6 : 1 }}>
            <span className="mono" aria-hidden="true" style={{ width: big ? 16 : 14, height: big ? 16 : 14, border: '1.5px solid var(--ink)', display: 'grid', placeItems: 'center', fontSize: big ? 11 : 10, lineHeight: 1 }}>{seen ? '✓' : ''}</span>
            <span style={{ textDecoration: seen ? 'line-through' : 'none' }}>{label}</span>
            {seen && <span className="sr-only">(visited)</span>}
          </button>
        )
      })}
    </>
  )
}

function DeskHeader() {
  const { visited, done, doneText, mat } = useCoreState()
  const seed = useArchive(s => s.seed)
  const sound = useArchive(s => s.sound)
  const { logoClick, toggleSound, inspect, goFast } = useArchive.getState()
  const ref = useRef<HTMLElement>(null)
  useHeaderHeight(ref)
  return (
    <header ref={ref} className="mono" style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: 'var(--bg)', backgroundImage: 'var(--tex)', backgroundSize: 'var(--tex-size)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px 18px', padding: '12px 28px', borderBottom: '1px solid var(--line)', fontSize: 10, letterSpacing: '.12em' }}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={logoClick} className="stencil" title="Back to the Core" style={{ background: 'transparent', border: 0, padding: 0, color: 'inherit', cursor: 'pointer', fontWeight: 800, fontSize: 20, letterSpacing: '.08em' }}>AMITTAL.DEV</button>
        <span className="hdr-seed" style={{ color: 'var(--muted)' }}>SEED <span style={{ color: 'var(--accent)' }}>{seed}</span></span>
        <Materials current={mat} pad="3px 7px" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="hdr-records-label" title="Each tick is one thing to find: a drawer, a project, a broken pipeline, a decision. Your report in Drawer 07 is built from these." style={{ color: 'var(--muted)', whiteSpace: 'nowrap', cursor: 'help' }}>RECORDS RECOVERED</span>
        <span role="img" aria-label={`${done} of ${TARGETS.length} records recovered`} title="Records recovered. Each tick is one thing to find; your report in Drawer 07 is built from these." style={{ display: 'flex', gap: 3 }}>
          {TARGETS.map(t => <span key={t} style={{ width: 7, height: 16, background: visited[t] ? 'var(--accent)' : 'var(--line)', transition: 'background .5s' }} />)}
        </span>
        <span aria-hidden="true" style={{ whiteSpace: 'nowrap' }}>{doneText}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="hbtn" onClick={toggleSound}>{sound ? 'SOUND · ON' : 'SOUND · OFF'}</button>
        <button type="button" className="hbtn" onClick={inspect}>HOW THIS WORKS</button>
        <button type="button" className="hbtn" onClick={goFast}>ESC · EXIT</button>
      </div>
    </header>
  )
}

function MobileHeader() {
  const { visited, done, doneText, mat } = useCoreState()
  const view = useArchive(s => s.view)
  const seed = useArchive(s => s.seed)
  const sound = useArchive(s => s.sound)
  const menuOpen = useArchive(s => s.menuOpen)
  const { logoClick, toggleMenu, go, toggleSound, inspect, goFast } = useArchive.getState()
  const { obj } = useCoreState()
  const ref = useRef<HTMLElement>(null)
  const strip = useRef<HTMLElement>(null)
  useHeaderHeight(ref)
  // Keep the current drawer's tab in view inside the strip.
  useEffect(() => {
    const nav = strip.current, on = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (nav && on) nav.scrollLeft = on.offsetLeft - nav.clientWidth / 2 + on.offsetWidth / 2
  }, [view])
  const menuBtn = { minHeight: 48, padding: '0 16px', textAlign: 'left', border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', fontSize: 11, letterSpacing: '.12em' } as const
  const surface = { backgroundColor: 'var(--bg)', backgroundImage: 'var(--tex)', backgroundSize: 'var(--tex-size)', borderBottom: '1px solid var(--line)' } as const
  return (
    <>
    <header ref={ref} style={{ position: 'sticky', top: 0, zIndex: 20, ...surface }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px' }}>
        <button type="button" onClick={logoClick} className="stencil" title="Back to the Core" style={{ background: 'transparent', border: 0, padding: 0, color: 'inherit', cursor: 'pointer', fontWeight: 800, fontSize: 20, letterSpacing: '.08em' }}>AMITTAL.DEV</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 150 }}>
          <div role="img" aria-label={`${done} of ${TARGETS.length} records recovered`} style={{ flex: 1, height: 4, background: 'var(--line)' }}><div style={{ height: 4, width: Math.round(done / TARGETS.length * 100) + '%', background: 'var(--accent)', transition: 'width .5s' }} /></div>
          <span className="mono" aria-hidden="true" style={{ fontSize: 10 }}>{doneText}</span>
        </div>
        <button type="button" onClick={toggleMenu} aria-expanded={menuOpen} className="mono" style={{ minHeight: 40, padding: '0 14px', border: '1px solid var(--ink)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', fontSize: 10, letterSpacing: '.12em' }}>MENU</button>
      </div>
    </header>
      <nav ref={strip} aria-label="Drawers" style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 16px', scrollbarWidth: 'none', ...surface }}>
        {NAV.map(([, label, v]) => {
          const active = view === v || (v === 'lab' && view === 'project')
          return (
            <button key={v} type="button" onClick={() => go(v)} aria-current={active ? 'page' : undefined} className="stencil"
              style={{ flex: 'none', minHeight: 40, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid ' + (active ? 'var(--ink)' : 'var(--line)'), background: active ? 'var(--ink)' : 'transparent', color: active ? 'var(--bg)' : 'var(--ink)', cursor: 'pointer', fontWeight: 700, fontSize: 17, letterSpacing: '.08em', whiteSpace: 'nowrap' }}>
              <span style={{ width: 6, height: 6, background: v === 'hub' ? 'transparent' : visited[v] ? 'var(--accent)' : 'var(--line)' }} />{label}
            </button>
          )
        })}
      </nav>
      {menuOpen && (
        <div role="dialog" aria-modal="true" aria-label="Menu" style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: 'var(--bg)', color: 'var(--ink)', overflowY: 'auto', padding: '14px 18px 32px', display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span className="mono" style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--muted)' }}>SEED <span style={{ color: 'var(--accent)' }}>{seed}</span></span>
            <button type="button" onClick={toggleMenu} autoFocus className="mono" style={{ minHeight: 44, padding: '0 16px', border: '1px solid var(--ink)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', fontSize: 10, letterSpacing: '.12em' }}>CLOSE ✕</button>
          </div>
          <div className="mono" style={{ display: 'flex', fontSize: 10, letterSpacing: '.12em' }}><Materials current={mat} pad="5px 9px" /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="label" style={{ paddingBottom: 6 }}>YOUR PATH · {obj.short}</div>
            <PathList big />
          </div>
          <div className="mono" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" onClick={toggleSound} style={menuBtn}>{sound ? 'SOUND · ON' : 'SOUND · OFF'}</button>
            <MotionToggle style={menuBtn} />
            <button type="button" onClick={inspect} style={menuBtn}>HOW THIS WORKS</button>
            <button type="button" onClick={goFast} style={menuBtn}>EXIT TO FAST ACCESS</button>
          </div>
        </div>
      )}
    </>
  )
}

function Sidebar() {
  const { view, visited, obj } = useCoreState()
  const go = useArchive(s => s.go)
  return (
    <div style={{ flex: '0 0 232px', borderRight: '1px solid var(--line)', padding: '26px 20px', display: 'flex', flexDirection: 'column', gap: 34, position: 'sticky', top: 'var(--hdr-h, 57px)', alignSelf: 'flex-start', maxHeight: 'calc(100vh - var(--hdr-h, 57px))', overflowY: 'auto', scrollbarWidth: 'none' }}>
      <nav aria-label="Drawers" style={{ display: 'flex', flexDirection: 'column' }}>
        {NAV.map(([num, label, v]) => {
          const active = view === v || (v === 'lab' && view === 'project')
          return (
            <button key={v} type="button" onClick={() => go(v)} aria-current={active ? 'page' : undefined}
              style={{ display: 'grid', gridTemplateColumns: '28px 1fr 10px', alignItems: 'center', padding: '9px 8px', background: active ? 'var(--panel)' : 'transparent', border: 0, borderBottom: '1px solid var(--line)', color: 'var(--ink)', cursor: 'pointer', textAlign: 'left' }}>
              <span className="mono" style={{ fontSize: 9, color: 'var(--muted)' }}>{num}</span>
              <span className="stencil" style={{ fontWeight: 700, fontSize: 19, letterSpacing: '.08em' }}>{label}</span>
              <span style={{ width: 7, height: 7, background: v === 'hub' ? 'transparent' : visited[v] ? 'var(--accent)' : 'var(--line)' }} />
            </button>
          )
        })}
      </nav>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: '.14em', color: 'var(--muted)' }}>YOUR PATH · {obj.short}</div>
        <PathList />
      </div>
      <MotionToggle className="hbtn" style={{ alignSelf: 'flex-start' }} />
    </div>
  )
}

/** The next stop on the visitor's path, at the foot of every drawer. */
function NextStep() {
  const { view, visited, obj } = useCoreState()
  const projectId = useArchive(s => s.projectId)
  const openKey = useArchive(s => s.openKey)
  const here = view === 'project' ? 'p:' + projectId : view
  const at = obj.path.findIndex(([, k]) => k === here)
  // On the path: the stop after this one. Off it: the first stop not yet seen.
  const next = (at >= 0 ? obj.path.slice(at + 1) : obj.path.filter(([, k]) => !visited[k]))[0]
  if (!next) return null
  return (
    <nav aria-label="Next on your path" style={{ borderTop: '1px solid var(--line)', paddingTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
      <button type="button" onClick={() => openKey(next[1])} className="mono"
        style={{ fontSize: 10, letterSpacing: '.12em', lineHeight: 1.6, padding: '12px 16px', background: 'transparent', border: '1px solid var(--ink)', color: 'var(--ink)', cursor: 'pointer', textAlign: 'right' }}>
        <span style={{ color: 'var(--muted)' }}>NEXT ON YOUR PATH · </span>{next[0].toUpperCase()} →
      </button>
    </nav>
  )
}

export function Core() {
  const sidebar = useSidebarLayout()
  const view = useArchive(s => s.view)
  const View = VIEWS[view] || Hub
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <a href="#main" className="skip-link">SKIP TO CONTENT</a>
      {sidebar ? <DeskHeader /> : <MobileHeader />}
      <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
        {sidebar && <Sidebar />}
        <main id="main" tabIndex={-1} style={{ flex: '1 1 0', minWidth: 0, padding: 'clamp(22px,5vw,44px) clamp(16px,5vw,48px) 90px', outline: 'none' }}>
          <div style={{ maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 32 }}>
            <SceneNotice />
            <View />
            <MisfiledNote />
            <NextStep />
          </div>
        </main>
      </div>
    </div>
  )
}
