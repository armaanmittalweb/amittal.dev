import type { CSSProperties, ReactNode } from 'react'
import { EGGS, LINKS, OBJECTIVES, PROFILE, PROJECTS, RESEARCH } from '../data/content'
import { useArchive } from '../store'

const box: CSSProperties = { border: '1.5px solid var(--ink)', padding: 'clamp(16px,3vw,22px)', display: 'flex', flexDirection: 'column', gap: 14 }
const btn: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'left', padding: '10px 12px', border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', textDecoration: 'none', minWidth: 0 }
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,210px),1fr))', gap: 8 }

function Head({ kicker, children }: { kicker: string; children: ReactNode }) {
  const changeObjective = useArchive(s => s.changeObjective)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: 10, letterSpacing: '.14em', color: 'var(--accent)' }}>
        <span>{kicker}</span>
        <button type="button" onClick={changeObjective} style={{ font: 'inherit', letterSpacing: 'inherit', background: 'transparent', border: 0, padding: 0, color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>CHANGE WHAT I CAME FOR</button>
      </div>
      <p style={{ fontSize: 'clamp(18px,2vw + 8px,22px)', lineHeight: 1.4, textWrap: 'pretty' }}>{children}</p>
    </div>
  )
}

const Tile = ({ tag, title, onClick, href }: { tag: string; title: string; onClick?: () => void; href?: string }) => {
  const inner = <><span className="mono" style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--muted)' }}>{tag}</span><span className="stencil" style={{ fontWeight: 700, fontSize: 19, letterSpacing: '.04em' }}>{title}</span></>
  return href
    ? <a href={href} className="hover-shade" style={btn} {...(/^https?:/.test(href) ? { target: '_blank', rel: 'noopener' } : {})}>{inner}</a>
    : <button type="button" onClick={onClick} className="hover-shade" style={btn}>{inner}</button>
}

/** What the Core leads with, chosen by what the visitor came for. */
export function Brief() {
  const objective = useArchive(s => s.objective)
  const eggs = useArchive(s => s.eggs)
  const { go, openProject } = useArchive.getState()
  const o = OBJECTIVES.find(x => x.id === objective) || OBJECTIVES[0]
  const fact = (k: string) => PROFILE.facts.find(f => f.k === k)?.v ?? ''

  if (o.id === 'hiring') return (
    <section aria-label="The short version" className="rise" style={box}>
      <Head kicker="FOR YOU · THE SHORT VERSION">{PROFILE.line}</Head>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: '10px 24px' }}>
        {['CURRENTLY', 'BEFORE', 'STUDY'].map(k => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <dt className="mono" style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--muted)' }}>{k}</dt>
            <dd style={{ margin: 0, fontSize: 16, lineHeight: 1.4 }}>{fact(k)}</dd>
          </div>
        ))}
      </dl>
      <div style={grid}>
        <Tile tag="PDF · ONE PAGE" title="RESUME ↗" href={LINKS.resumePdf} />
        <Tile tag="EMAIL" title={LINKS.email.toUpperCase()} href={'mailto:' + LINKS.email} />
        <Tile tag="CAREER" title="LINKEDIN ↗" href={LINKS.linkedin} />
        <Tile tag="CODE" title="GITHUB ↗" href={LINKS.github} />
      </div>
    </section>
  )

  if (o.id === 'engineering') {
    const picks = ['latentbook', 'farmsaathi', 'openingos'].flatMap(id => PROJECTS.filter(p => p.id === id))
    return (
      <section aria-label="Where to start" className="rise" style={box}>
        <Head kicker="FOR YOU · WHERE TO START">Every project opens at its decisions and incident logs. Start with the one that interests you most, or break a pipeline.</Head>
        <div style={grid}>{picks.map(p => <Tile key={p.id} tag={p.tag.toUpperCase()} title={p.name.toUpperCase() + ' →'} onClick={() => openProject(p.id)} />)}</div>
      </section>
    )
  }

  if (o.id === 'research') return (
    <section aria-label="On file" className="rise" style={box}>
      <Head kicker="FOR YOU · ON FILE">{RESEARCH.length} research records: an accepted paper, one under review, and speech reconstructed from EEG.</Head>
      <div style={grid}>
        {RESEARCH.map((r, i) => <Tile key={r.id} tag={r.status} title={r.title.toUpperCase() + ' →'} onClick={() => { useArchive.setState({ openRes: i }); go('research') }} />)}
      </div>
    </section>
  )

  const found = Object.keys(eggs).length, next = EGGS.find(e => !eggs[e.id])
  return (
    <section aria-label="Things to break" className="rise" style={box}>
      <Head kicker={`FOR YOU · EASTER EGGS ${String(found).padStart(2, '0')}/${EGGS.length}`}>
        {next ? <>Next hint: <em>{next.hint}</em></> : 'Every egg found. You have read the whole archive, including the parts it did not mean to show.'}
      </Head>
      <div style={grid}>
        <Tile tag="TAKE IT APART" title="INSPECT SYSTEM →" onClick={() => useArchive.getState().inspect()} />
        <Tile tag="BREAK A PIPELINE" title="THE LAB →" onClick={() => go('lab')} />
      </div>
    </section>
  )
}
