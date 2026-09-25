import { CAT_LABEL, LINKS, MATERIAL, PROJECTS, TARGETS, type Category } from '../../data/content'
import { derive } from '../../lib/seed'
import { useArchive } from '../../store'
import { useSceneAvailable } from '../../lib/scene'
import { Archive3D } from '../Scene'

const stat = (n: number) => String(n).padStart(2, '0')

/** Without WebGL the seed is drawn as a flat 8×8 grid of its bits. */
function SeedGrid({ seed }: { seed: string }) {
  const bits = [...seed].flatMap(ch => parseInt(ch, 16).toString(2).padStart(4, '0').split(''))
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,18px)', gap: 5 }}>
        {bits.map((b, i) => <span key={i} style={{ width: 18, height: 18, background: b === '1' ? 'var(--accent)' : 'var(--line)' }} />)}
      </div>
    </div>
  )
}

export function Report() {
  const seed = useArchive(s => s.seed) || '0000000000000000'
  const visited = useArchive(s => s.visited)
  const interest = useArchive(s => s.interest)
  const found = useArchive(s => s.found)
  const { go, inspect } = useArchive.getState()
  const sceneOk = useSceneAvailable()

  const done = TARGETS.filter(t => visited[t]).length
  const pct = Math.round(done / TARGETS.length * 100)
  const counts = (['systems', 'ai', 'research', 'interface'] as Category[]).map(c => ({ c, n: interest[c] || 0 }))
  const maxN = Math.max(1, ...counts.map(x => x.n))
  const top = [...counts].sort((a, b) => b.n - a.n)[0]
  const projCount = PROJECTS.filter(p => visited['p:' + p.id]).length
  const sections = ['identity', 'capabilities', 'resume', 'trace', 'lab', 'research', 'report', 'inspect'].filter(k => visited[k]).length
  const stats = [
    ['SECTIONS EXPLORED', stat(sections)],
    ['PROJECTS INSPECTED', stat(projCount) + ' / ' + stat(PROJECTS.length)],
    ['RECORDS RECOVERED', stat(done) + ' / ' + TARGETS.length],
    ['PIPELINES BROKEN', visited.break ? 'YES' : 'NO'],
    ['DECISIONS OPENED', visited.why ? 'YES' : 'NO'],
    ['FAILURES READ', visited.fail ? 'YES' : 'NO'],
    ['MISFILED RECORD', found ? 'FOUND' : 'NOT FOUND'],
  ]
  const cta = { fontWeight: 700, fontSize: 20, letterSpacing: '.12em', padding: '10px 22px' } as const

  return (
    <div data-screen-label="11 Final core" style={{ display: 'flex', flexDirection: 'column', gap: 38 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="kicker">DRAWER 07 · TRANSMISSION · SESSION REPORT</div>
        <h1 className="stencil" style={{ fontWeight: 800, fontSize: 'clamp(40px,11vw,80px)', lineHeight: .88 }}>
          {pct >= 90 ? 'ARCHIVE RECONSTRUCTED.' : pct >= 50 ? 'YOU SAW MOST OF THE SYSTEM.' : 'YOU SAW PART OF THE SYSTEM.'}
        </h1>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 40 }}>
        <dl className="mono" style={{ margin: 0, display: 'flex', flexDirection: 'column', fontSize: 11, letterSpacing: '.08em' }}>
          {stats.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <dt style={{ color: 'var(--muted)' }}>{k}</dt><dd className="stencil" style={{ margin: 0, fontWeight: 700, fontSize: 24 }}>{v}</dd>
            </div>
          ))}
        </dl>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="label">ARCHIVE ANALYSIS · WHAT YOU INSPECTED</div>
          {counts.map(x => (
            <div key={x.c} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 30px', gap: 12, alignItems: 'center' }}>
              <span className="stencil" style={{ fontWeight: 700, fontSize: 19, letterSpacing: '.08em' }}>{CAT_LABEL[x.c]}</span>
              <div aria-hidden="true" style={{ height: 10, border: '1px solid var(--line)' }}><div style={{ height: 8, width: Math.round(x.n / maxN * 100) + '%', background: x === top && x.n > 0 ? 'var(--accent)' : 'var(--muted)', transition: 'width .8s' }} /></div>
              <span className="mono" style={{ fontSize: 11, textAlign: 'right' }}>{x.n}</span>
            </div>
          ))}
          <p style={{ fontSize: 20, lineHeight: 1.45, fontStyle: 'italic', textWrap: 'pretty', paddingTop: 6 }}>
            {top.n > 0 ? `You spent most of your time on the ${CAT_LABEL[top.c].toLowerCase()} side of my work.` : 'No interactions recorded yet. Open a project in the Lab to begin.'}
          </p>
        </div>
      </div>
      <div style={{ border: '1px solid var(--line)', padding: 'clamp(28px,6vw,52px) clamp(16px,4vw,32px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '.2em', color: 'var(--muted)' }}>SESSION RESOLVED</div>
        <div className="mono" style={{ fontSize: 'clamp(16px, 5.4vw, 26px)', letterSpacing: '.1em', color: 'var(--accent)', maxWidth: '100%', overflowWrap: 'anywhere' }}>{seed}</div>
        <div style={{ position: 'relative', width: '100%', maxWidth: 460, height: 'clamp(220px,34vh,300px)' }}>
          {sceneOk
            ? <Archive3D mode="seed" mat={MATERIAL.report} hue={derive(seed).hue} data={{ bits: [...seed].map(ch => parseInt(ch, 16).toString(2).padStart(4, '0')).join(''), hex: seed }} />
            : <SeedGrid seed={seed} />}
        </div>
        <p style={{ fontSize: 18, fontStyle: 'italic', color: 'var(--muted)', maxWidth: 520 }}>Every variation you saw, from the lab order to the drone you heard, was derived from this one number.</p>
        <h2 className="stencil" style={{ fontWeight: 800, fontSize: 'clamp(28px,7vw,46px)', lineHeight: 1, paddingTop: 14 }}>YOU'VE SEEN THE SYSTEM.<br />BUT YOU HAVEN'T SEEN<br />WHAT I'LL BUILD NEXT.</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, paddingTop: 10 }}>
          <a href={'mailto:' + LINKS.email} className="stencil" style={{ ...cta, padding: '10px 26px', background: 'var(--accent)', color: 'var(--bg)', textDecoration: 'none' }}>CONNECT</a>
          <button type="button" onClick={() => go('resume')} className="stencil" style={{ ...cta, border: '1px solid var(--ink)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer' }}>VIEW RESUME</button>
          <a href={LINKS.github} className="stencil" style={{ ...cta, border: '1px solid var(--ink)', color: 'var(--ink)', textDecoration: 'none' }}>GITHUB</a>
          <button type="button" onClick={inspect} className="stencil" style={{ ...cta, border: '1px dashed var(--muted)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>INSPECT SYSTEM</button>
        </div>
      </div>
    </div>
  )
}
