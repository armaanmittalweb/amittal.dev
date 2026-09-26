import { EDGES, MATERIAL, NODES, PROJECTS, type TraceNode } from '../../data/content'
import { derive } from '../../lib/seed'
import { useArchive } from '../../store'
import { useSceneAvailable } from '../../lib/scene'
import { Archive3D } from '../Scene'
import { Stage, StageHint } from '../Stage'
import { DrawerHead, OutlineButton } from '../ui'

const neighbours = (id: string) => EDGES.flatMap(([a, b]) => a === id ? [b] : b === id ? [a] : [])
  .flatMap(n => NODES.filter(x => x.id === n).map(x => x.label))

function useNodeActions() {
  const { openProject, go } = useArchive.getState()
  const target = (n: TraceNode) => (n.project && PROJECTS.find(p => p.id === n.project)?.name) || n.view || 'hub'
  const goLabel = (n: TraceNode) => 'OPEN ' + target(n).toUpperCase()
  const open = (n: TraceNode) => n.project ? openProject(n.project) : go(n.view || 'hub')
  return { goLabel, open }
}

/** The same network as text: every node, in order, with what it connects to. */
function TraceList() {
  const visited = useArchive(s => s.visited)
  const { goLabel, open } = useNodeActions()
  const nodes = [...NODES].sort((a, b) => a.year.localeCompare(b.year))
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1.5px solid var(--ink)' }}>
      {nodes.map(n => {
        const lit = !!visited[n.key]
        return (
          <li key={n.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '10px 16px', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="mono" style={{ fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)' }}>
                {n.year} · <span style={{ color: lit ? 'var(--accent)' : 'var(--muted)' }}>{lit ? 'INKED' : 'NOT YET INKED'}</span>
              </span>
              <span className="stencil" style={{ fontWeight: 700, fontSize: 24, letterSpacing: '.05em' }}>{n.label}</span>
              <span style={{ fontSize: 17 }}>{n.note}</span>
              <span className="mono" style={{ fontSize: 10, letterSpacing: '.08em', color: 'var(--muted)' }}>LINKED TO · {neighbours(n.id).join(' · ')}</span>
            </div>
            <OutlineButton onClick={() => open(n)}>{goLabel(n)} →</OutlineButton>
          </li>
        )
      })}
    </ol>
  )
}

/** What the selected node is, docked against the graph so reading it needs no scrolling. */
function NodePanel({ node, lit, onOpen, goLabel }: { node?: TraceNode; lit: boolean; onOpen: (n: TraceNode) => void; goLabel: (n: TraceNode) => string }) {
  return (
    <div aria-live="polite" style={{ padding: 'clamp(14px,3vw,22px)', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 120, justifyContent: node ? 'flex-start' : 'center' }}>
      {node ? (
        <>
          <span className="mono" style={{ fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)' }}>
            {node.year} · <span style={{ color: lit ? 'var(--accent)' : 'var(--muted)' }}>{lit ? 'INKED' : 'NOT YET INKED'}</span>
          </span>
          <h2 className="stencil" style={{ fontWeight: 800, fontSize: 'clamp(26px,4vw,34px)', letterSpacing: '.04em', lineHeight: 1 }}>{node.label}</h2>
          <p style={{ fontSize: 18, lineHeight: 1.4 }}>{node.note}</p>
          <span className="mono" style={{ fontSize: 10, letterSpacing: '.08em', color: 'var(--muted)' }}>LINKED TO · {neighbours(node.id).join(' · ')}</span>
          <OutlineButton onClick={() => onOpen(node)} style={{ alignSelf: 'flex-start', marginTop: 4 }}>{goLabel(node)} →</OutlineButton>
        </>
      ) : (
        <p style={{ fontSize: 17, fontStyle: 'italic', color: 'var(--muted)' }}>Tap a node, or its name, to read what it is and where it leads.</p>
      )}
    </div>
  )
}

export function Trace() {
  const seed = useArchive(s => s.seed) || '0000000000000000'
  const visited = useArchive(s => s.visited)
  const nodeId = useArchive(s => s.nodeId)
  const sceneOk = useSceneAvailable()
  const listView = useArchive(s => s.traceList) || !sceneOk
  const setTraceList = useArchive(s => s.setTraceList)
  const { goLabel, open } = useNodeActions()
  const lit = (n: TraceNode) => !!visited[n.key]
  const node = NODES.find(n => n.id === nodeId)

  const tab = (on: boolean) => ({ padding: '8px 14px', background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--bg)' : 'var(--ink)', border: 0, cursor: 'pointer', fontSize: 10, letterSpacing: '.12em' })

  return (
    <div data-screen-label="07 Trace" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <DrawerHead kicker="DRAWER 04 · TRACE · 2022–2026" title="TRACE"
        lead={`The work as a network. Nodes are inked in as you explore what they represent. ${NODES.filter(lit).length} of ${NODES.length} inked.`}
        leadStyle={{ maxWidth: 'none' }} />
      {sceneOk && (
        <div role="group" aria-label="Trace view" className="mono" style={{ display: 'flex', alignSelf: 'flex-start', border: '1px solid var(--ink)' }}>
          <button type="button" aria-pressed={!listView} onClick={() => setTraceList(false)} className="mono" style={{ ...tab(!listView), borderRight: '1px solid var(--ink)' }}>GRAPH</button>
          <button type="button" aria-pressed={listView} onClick={() => setTraceList(true)} className="mono" style={tab(listView)}>LIST</button>
        </div>
      )}
      {listView ? <TraceList /> : (
        <Stage label="Trace graph" panel={<NodePanel node={node} lit={node ? lit(node) : false} onOpen={open} goLabel={goLabel} />}
          hStack="clamp(280px, calc(var(--avail) - 190px), 520px)" hSide="clamp(320px, calc(var(--avail) - 40px), 560px)"
          view={<Archive3D mode="graph" mat={MATERIAL.trace} hue={derive(seed).hue}
            data={{ nodes: NODES.map(n => ({ id: n.id, label: n.label, year: n.year, x: n.x, y: n.y, lit: lit(n) })), edges: EDGES, sel: nodeId }} />}
          overlay={<StageHint short="TAP A NODE · DRAG TO ORBIT">DRAG TO ORBIT · TAP A NODE OR ITS NAME</StageHint>} />
      )}
    </div>
  )
}
