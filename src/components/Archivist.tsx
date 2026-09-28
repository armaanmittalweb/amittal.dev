import { useState } from 'react'
import type { Tone } from '../lib/search'
import type { Card } from '../lib/search'
import { useArchive } from '../store'

// Requests worth trying, by what the visitor came for. Shuffled per visit.
const EXAMPLES: Record<Tone, string[]> = {
  hiring: ['where does he work', 'resume', 'how do I contact him', 'projects with RAG', 'C++ low latency', 'education', 'is he open to new roles'],
  engineering: ['lock-free', 'RAG pipeline', 'FastAPI', 'how was this site built', 'vector search', 'C++ latency', 'system design'],
  research: ['papers', 'EEG', 'multilingual NLP', 'gibberish detection', 'speech', 'PRISM-Home', 'Samsung'],
  curiosity: ['easter eggs', 'tell me a joke', 'chess', 'are you an AI', 'coffee', 'how was this site built', 'sudo'],
}
const shuffled = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }

/** Loads the engine as soon as the visitor shows interest, so the first answer is instant. */
const warm = () => {
  void import('../lib/search').then(m => ('requestIdleCallback' in window ? requestIdleCallback : setTimeout)(() => m.warmUp()))
}

/** One result: opens the drawer, project, paper or link it points to. */
function Result({ card }: { card: Card }) {
  const { openProject, go, pickCap } = useArchive.getState()
  const a = card.action
  const body = (
    <>
      <span className="mono" style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--muted)' }}>{card.tag}</span>
      <span className="stencil" style={{ fontWeight: 700, fontSize: 22, letterSpacing: '.04em', lineHeight: 1.05 }}>{card.title} {a.type === 'link' ? '↗' : '→'}</span>
      <span style={{ fontSize: 16, lineHeight: 1.4, color: 'var(--muted)', textWrap: 'pretty' }}>{card.sub}</span>
      {card.chips && (
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingTop: 4 }}>
          {card.chips.map(t => {
            const hit = card.hits?.includes(t)
            return <span key={t} className="mono" style={{ fontSize: 9, padding: '3px 6px', border: '1px solid ' + (hit ? 'var(--ink)' : 'var(--line)'), background: hit ? 'var(--ink)' : 'transparent', color: hit ? 'var(--bg)' : 'var(--muted)' }}>{t}</span>
          })}
        </span>
      )}
    </>
  )
  const style = { display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left', padding: '14px 0', background: 'transparent', border: 0, borderTop: '1px solid var(--line)', color: 'var(--ink)', cursor: 'pointer', textDecoration: 'none', width: '100%' } as const
  if (a.type === 'link') {
    const external = /^https?:/.test(a.href)
    return <a href={a.href} className="hover-glow" style={style} {...(external ? { target: '_blank', rel: 'noopener' } : {})}>{body}</a>
  }
  const open = () => {
    if (a.type === 'project') openProject(a.id)
    else if (a.type === 'view') go(a.view)
    else if (a.type === 'research') { useArchive.setState({ openRes: a.i }); go('research') }
    else { pickCap(a.id, a.cat); go('capabilities') }
  }
  return <button type="button" onClick={open} className="hover-glow" style={style}>{body}</button>
}

/** The archive's search: ask it anything; it always answers. */
export function Archivist() {
  const query = useArchive(s => s.query)
  const answer = useArchive(s => s.answer)
  const objective = useArchive(s => s.objective) as Tone
  const { setQuery, runQuery } = useArchive.getState()
  const [tries] = useState(() => shuffled(EXAMPLES[objective] ?? EXAMPLES.hiring).slice(0, 4))
  const ask = (q: string) => { setQuery(q); runQuery() }

  return (
    <form role="search" onSubmit={e => { e.preventDefault(); runQuery() }} style={{ border: '1.5px solid var(--ink)', display: 'flex', flexDirection: 'column' }}>
      <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 16px', borderBottom: '1.5px solid var(--ink)', fontSize: 10, letterSpacing: '.14em' }}>
        <span>ARCHIVE INDEX · ASK THE ARCHIVIST</span><span style={{ color: 'var(--muted)' }}>ANY QUESTION</span>
      </div>
      <div style={{ display: 'flex' }}>
        <input value={query} onChange={e => setQuery(e.target.value)} onFocus={warm} onPointerEnter={warm} autoComplete="off" spellCheck={false} maxLength={200}
          aria-label="Ask the archive" placeholder="Projects, skills, papers, how to reach him…"
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, color: 'var(--ink)', padding: '18px 16px', fontFamily: "'Newsreader',serif", fontStyle: 'italic', fontSize: 22, outline: 'none' }} />
        <button type="submit" className="stencil" style={{ fontWeight: 700, fontSize: 20, letterSpacing: '.12em', padding: '0 22px', background: 'var(--ink)', border: 0, color: 'var(--bg)', cursor: 'pointer', whiteSpace: 'nowrap' }}>ASK</button>
      </div>
      <div aria-live="polite">
        {answer && (
          <div key={answer.line + answer.quip} className="answer reveal-in" style={{ borderTop: '1.5px solid var(--ink)', padding: '14px 16px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="label">ARCHIVIST · {answer.heard}</span>
            <p style={{ fontSize: 19, lineHeight: 1.45, textWrap: 'pretty' }}>{answer.line}</p>
            <p style={{ fontSize: 16, lineHeight: 1.4, fontStyle: 'italic', color: 'var(--muted)', textWrap: 'pretty' }}>{answer.quip}</p>
            {answer.cards.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 4 }}>{answer.cards.map(c => <Result key={c.key} card={c} />)}</div>}
          </div>
        )}
      </div>
      <div className="mono" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '10px 16px 12px', borderTop: '1px solid var(--line)', fontSize: 9, letterSpacing: '.12em', color: 'var(--muted)' }}>
        <span>TRY</span>
        {tries.map(t => (
          <button key={t} type="button" onClick={() => ask(t)} onPointerEnter={warm} className="hover-shade"
            style={{ font: 'inherit', letterSpacing: '.06em', padding: '6px 9px', minHeight: 30, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink)', cursor: 'pointer', textTransform: 'uppercase' }}>{t}</button>
        ))}
      </div>
    </form>
  )
}
