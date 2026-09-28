// The archive's search. Everything runs in the browser over the site's own content:
//   1. intents: questions people actually ask (contact, hiring, where, who, skills…)
//      get a direct answer;
//   2. retrieval: every record on the site (projects, papers, roles, skills, drawers, the
//      site itself) is indexed; words are stemmed, expanded with synonyms, and matched
//      with typo tolerance, then ranked by how rare and how prominent each match is;
//   3. a line from the archivist on top. Nothing is ever just "no results".
// Loaded on demand (see Hub), so it costs the first page load nothing.
import {
  CABINET, CAPS, LAYERS, LINKS, PROFILE, PROJECTS, RESEARCH, RESUME,
  type Category, type View,
} from '../data/content'
import { QUIPS, quip, type QuipPool } from './quips'

export type Action =
  | { type: 'project'; id: string }
  | { type: 'view'; view: View }
  | { type: 'research'; i: number }
  | { type: 'cap'; id: string; cat: Category }
  | { type: 'link'; href: string }

export interface Card { key: string; tag: string; title: string; sub: string; action: Action; chips?: string[]; hits?: string[] }
export interface Answer {
  /** A short label for what was understood, shown above the answer. */
  heard: string
  line: string
  quip: string
  cards: Card[]
  /** An easter egg this answer finds. */
  egg?: string
}
export type Tone = 'hiring' | 'engineering' | 'research' | 'curiosity'

/* ---------- words ---------- */

const STOP = new Set(('a an and any about all am are as at be been built build by can could did do does doing done for from get give got had has have he his how i if in into involving is it its just know let list me more most my of on or our please pls project projects show some something tell that the their them there these they this those to use used uses using want was we were what when where which who why will with work works would you your yours armaan armaans mittal site website archive').split(' '))

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/c\+\+/g, ' cpp ').replace(/c#/g, ' csharp ').replace(/\bnode\.?js\b/g, ' nodejs ').replace(/\.js\b/g, 'js')
  .replace(/\bk8s\b/g, ' kubernetes ').replace(/\bp99\b/g, ' latency ').replace(/\block[- ]?free\b/g, ' lockfree ')

// Multi-word things people type, folded into words the index knows.
const PHRASES: [RegExp, string][] = [
  [/\bmachine learning\b|\bdeep learning\b/g, ' ml '], [/\bcomputer vision\b/g, ' vision '], [/\blarge language models?\b/g, ' llm '],
  [/\bretrieval[- ]augmented( generation)?\b/g, ' rag '], [/\bnatural language( processing)?\b/g, ' nlp '], [/\bvector (search|database|db)\b/g, ' vector '],
  [/\bmulti[- ]?agents?\b/g, ' multi-agent agent '], [/\blow[- ]latency\b/g, ' latency '], [/\bhigh[- ]frequency( trading)?\b/g, ' hft '],
  [/\bspeech[- ]to[- ]text\b/g, ' stt '], [/\btext[- ]to[- ]speech\b/g, ' tts '], [/\bdata structures?( and algorithms)?\b/g, ' dsa '],
  [/\bbrain[- ]computer\b/g, ' eeg '], [/\bsystem design\b/g, ' backend architecture '], [/\bfull[- ]?stack\b/g, ' backend frontend '],
]
const fold = (s: string) => PHRASES.reduce((t, [re, w]) => t.replace(re, w), norm(s))

export function stem(t: string) {
  if (t.length <= 3 || /\d/.test(t)) return t
  if (t.endsWith('ies') && t.length > 4) return t.slice(0, -3) + 'y'
  if (t.endsWith('sses')) return t.slice(0, -2)
  if (t.endsWith('s') && !/(ss|us|is|os)$/.test(t)) t = t.slice(0, -1)
  if (t.endsWith('ing') && t.length > 5) t = t.slice(0, -3)
  else if (t.endsWith('ed') && t.length > 4 && !t.endsWith('eed')) t = t.slice(0, -2)
  return t
}

const words = (s: string) => fold(s).split(/[^a-z0-9-]+/).flatMap(w => w.includes('-') ? [w.replace(/-/g, ''), ...w.split('-')] : [w]).filter(w => w.length > 1 || /\d/.test(w))
const terms = (s: string) => words(s).map(stem)

// What people type, and what the archive calls it. Expansions count for a little less than the word itself.
const SYNONYMS: Record<string, string> = {
  ml: 'ai model training llm', ai: 'llm rag agent nlp model machine learning', artificial: 'ai', intelligence: 'ai',
  llm: 'language model gemini qwen claude openai', gpt: 'llm openai', chatgpt: 'llm openai', genai: 'llm rag ai', gen: 'llm',
  agent: 'agents multi-agent tool-calling mcp orchestration', agentic: 'agent mcp tool', bot: 'agent llm', chatbot: 'agent llm rag',
  rag: 'retrieval vector embeddings', retrieval: 'rag', vector: 'rag embeddings', semantic: 'embeddings rag', embedding: 'rag vector',
  nlp: 'language multilingual text', language: 'nlp multilingual', translation: 'nllb multilingual', multilingual: 'nlp translation',
  voice: 'speech tts stt whisper', audio: 'speech', speech: 'voice whisper tts', tts: 'speech', stt: 'speech whisper', whisper: 'speech',
  vision: 'computer vision image', image: 'vision leaf', cnn: 'mobilenetv2 vision',
  eeg: 'brain signals', brain: 'eeg', neuro: 'eeg', bci: 'eeg',
  backend: 'api server fastapi express fastify database', server: 'backend api', api: 'apis fastapi express fastify', rest: 'api',
  frontend: 'react web interface', ui: 'interface react web', web: 'react frontend', react: 'frontend web',
  database: 'mysql postgresql mongodb sql', db: 'database', sql: 'mysql postgresql', postgres: 'postgresql', mongo: 'mongodb', nosql: 'mongodb',
  cpp: 'c++ low latency', latency: 'low-latency performance', fast: 'low latency performance', performance: 'latency benchmark', realtime: 'latency',
  hft: 'order book latency trading', trading: 'order book market', finance: 'order book market', stock: 'order book market', exchange: 'order book matching',
  concurrency: 'lockfree thread', thread: 'concurrency', lockfree: 'concurrency ring buffer',
  chess: 'openingos opening repertoire', farm: 'farmsaathi farming crop', farming: 'farmsaathi agriculture', agriculture: 'farmsaathi farming', crop: 'farmsaathi', plant: 'leaf disease farmsaathi',
  timetable: 'edusched schedule', schedule: 'edusched timetable', college: 'education thapar', university: 'education thapar', school: 'education', degree: 'education', study: 'education',
  transcript: 'fieldnotes', citation: 'fieldnotes cite', cite: 'citation', interview: 'expert-call transcript',
  cloud: 'infrastructure docker kubernetes', devops: 'infrastructure ci cd docker', docker: 'infrastructure', kubernetes: 'infrastructure', deploy: 'infrastructure',
  job: 'experience role', career: 'experience role', experience: 'role', intern: 'internship', internship: 'intern', company: 'engagely samsung',
  paper: 'publication research', publication: 'paper research', published: 'publication', thesis: 'research', science: 'research',
  competitive: 'codechef programming', cp: 'competitive programming codechef', dsa: 'data structures algorithms', leetcode: 'competitive programming',
  award: 'awards amazon meta', hackathon: 'meta pragati', teach: 'mentor', mentor: 'teaching', lead: 'leadership',
  python: 'fastapi', golang: 'go', mobile: 'pwa', offline: 'local-first', pwa: 'local-first',
  animation: 'motion three', threejs: 'three', three: '3d rendering', sound: 'audio web', site: 'react vite three',
}

/* ---------- the index ---------- */

interface Field { set: Set<string>; w: number }
interface Doc { card: Card; fields: Field[]; prose: string[]; tags?: string[]; kind: QuipPool; type: 'project' | 'research' | 'career' | 'other' }

const trim = (s: string, n = 150) => s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)) + '…'
// Field weights are square-rooted so a word written in a project's body still beats a mere synonym in a title.
const field = (s: string, w: number): Field => ({ set: new Set(terms(s)), w: Math.sqrt(w) })
const sentences = (...parts: string[]) => parts.flatMap(p => p.split(/(?<=[.!?])\s+/)).map(x => x.trim()).filter(x => x.length > 15)

function buildDocs(): Doc[] {
  const docs: Doc[] = []
  const add = (card: Card, kind: QuipPool, parts: [string, number][], prose: string[], tags?: string[], type: Doc['type'] = 'other') =>
    docs.push({ card, kind, tags, type, prose, fields: parts.map(([s, w]) => field(s, w)) })

  for (const p of PROJECTS) {
    add({ key: 'p:' + p.id, tag: 'PROJECT · ' + p.year, title: p.name, sub: p.l1, chips: p.tags, action: { type: 'project', id: p.id } },
      p.cat === 'research' ? 'research' : p.cat, [
        [p.name, 6], [p.tag + ' ' + p.tags.join(' '), 3.5], [p.l1, 2],
        [p.l2 + ' ' + p.pipeline.join(' ') + ' ' + p.why.map(w => w.q + ' ' + w.decision).join(' ') + ' ' + p.fails.map(f => f.problem + ' ' + f.symptom).join(' '), 1],
      ], sentences(p.l1, p.l2, ...p.why.map(w => w.q), ...p.fails.map(f => f.symptom)), p.tags, 'project')
  }
  RESEARCH.forEach((r, i) => {
    const rows = r.rows.map(x => x[1]).join(' ')
    add({ key: 'r:' + r.id, tag: 'RESEARCH · ' + r.status, title: r.title, sub: trim(r.rows.find(x => x[0] === 'QUESTION')?.[1] || r.rows[0][1]), action: { type: 'research', i } },
      'research', [[r.title + ' ' + r.id, 5], [r.status + ' paper research', 2.5], [rows, 1.5]], sentences(...r.rows.map(x => x[1])), undefined, 'research')
  })
  for (const sec of RESUME) {
    for (const row of sec.rows) {
      const kind: QuipPool = sec.h === 'PUBLICATIONS' ? 'research' : sec.h === 'SKILLS' ? 'skills' : 'career'
      const action: Action = sec.h === 'PUBLICATIONS' ? { type: 'view', view: 'research' } : { type: 'view', view: 'resume' }
      add({ key: 'cv:' + row.t, tag: sec.h + (row.d ? ' · ' + row.d : ''), title: row.t, sub: trim(row.s), action },
        kind, [[row.t, 4.5], [sec.h + ' ' + (row.d || ''), 2], [row.s, 1.5]], sentences(row.s), undefined, sec.h === 'PUBLICATIONS' ? 'research' : 'career')
    }
  }
  for (const g of CAPS) for (const c of g.items) {
    add({ key: 'cap:' + c.id, tag: 'CAPABILITY · ' + g.group, title: c.title, sub: c.tech, action: { type: 'cap', id: c.id, cat: g.cat } },
      g.cat === 'research' ? 'research' : g.cat === 'interface' ? 'interface' : g.cat, [[c.title + ' ' + c.name, 5], [c.tech, 2.5], [g.group, 1]], [])
  }
  for (const [num, label, view, , desc] of CABINET) {
    add({ key: 'd:' + view, tag: 'DRAWER ' + num, title: label, sub: desc, action: { type: 'view', view: view as View } }, 'found', [[label, 4], [desc, 1.5]], [])
  }
  add({ key: 'd:identity-facts', tag: 'IDENTITY', title: PROFILE.name, sub: PROFILE.line, action: { type: 'view', view: 'identity' } },
    'about', [[PROFILE.name + ' profile bio about', 4], [PROFILE.line + ' ' + PROFILE.facts.map(f => f.v).join(' '), 1.5]], sentences(PROFILE.line, ...PROFILE.facts.map(f => f.v + '.')))
  add({ key: 'd:inspect', tag: 'DRAWER · HOW THIS WORKS', title: 'Inspect the system', sub: 'The stack behind this site: ' + LAYERS.map(l => l.v).join(', ') + '.', action: { type: 'view', view: 'inspect' } },
    'site', [['inspect system how this site works stack built', 3.5], [LAYERS.map(l => l.k + ' ' + l.v + ' ' + l.why).join(' '), 1.2]], sentences(...LAYERS.map(l => l.why)))
  add({ key: 'l:github', tag: 'LINK', title: 'GitHub', sub: LINKS.githubLabel, action: { type: 'link', href: LINKS.github } }, 'found', [['github code source repositories repos', 4]], [])
  add({ key: 'l:linkedin', tag: 'LINK', title: 'LinkedIn', sub: 'linkedin.com/in/armaanmittal', action: { type: 'link', href: LINKS.linkedin } }, 'found', [['linkedin profile network', 4]], [])
  add({ key: 'l:codechef', tag: 'LINK', title: 'CodeChef', sub: 'Rated contests, ranked 362 and 535 of 20,000+', action: { type: 'link', href: LINKS.codechef } }, 'found', [['codechef competitive programming contests rating', 4]], [])
  return docs
}

let docs: Doc[] | null = null
let df: Map<string, number> | null = null
let vocab: string[] = []

function index() {
  if (docs) return docs
  docs = buildDocs()
  df = new Map()
  for (const d of docs) {
    const seen = new Set<string>()
    for (const f of d.fields) f.set.forEach(t => seen.add(t))
    seen.forEach(t => df!.set(t, (df!.get(t) || 0) + 1))
  }
  vocab = [...df.keys()]
  return docs
}
const idf = (t: string) => Math.log(1 + docs!.length / ((df!.get(t) || 0) + .5))

/** Edit distance, stopping early once it passes `max`. */
function within(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return false
  // Optimal string alignment: insertions, deletions, substitutions and swapped neighbours.
  let pp: number[] = [], prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], pp[j - 2] + 1)
      best = Math.min(best, cur[j])
    }
    if (best > max) return false
    pp = prev; prev = cur
  }
  return prev[b.length] <= max
}

/** Every indexed word a query word stands for, with how much it counts. */
function variants(raw: string): Map<string, number> {
  const out = new Map<string, number>()
  const put = (t: string, w: number) => { if (w > (out.get(t) || 0)) out.set(t, w) }
  const t = stem(raw)
  put(t, 1)
  for (const s of terms(SYNONYMS[raw] || SYNONYMS[t] || '')) put(s, .45)
  for (const v of vocab) {
    if (v === t) continue
    if (t.length >= 3 && v.startsWith(t)) put(v, .8)
    else if (t.length >= 4 && within(t, v, t.length >= 7 ? 2 : 1)) put(v, .65)
  }
  return out
}

interface Hit { doc: Doc; score: number; matched: Set<string>; covered: number }

function retrieve(q: string): Hit[] {
  index()
  const all = words(q), qs = [...new Set(all.filter(w => !STOP.has(w)))]
  if (!qs.length) return []
  const wants: Doc['type'] | null = all.some(w => /^projects?$|^built$|^apps?$/.test(w)) ? 'project'
    : all.some(w => /^(papers?|publications?|research)$/.test(w)) ? 'research'
      : all.some(w => /^(roles?|jobs?|experience|worked|internships?)$/.test(w)) ? 'career' : null
  const groups = qs.map(variants)
  const hits: Hit[] = []
  for (const doc of docs!) {
    let score = 0, covered = 0
    const matched = new Set<string>()
    for (const g of groups) {
      let best = 0
      for (const [t, w] of g) for (const f of doc.fields) {
        if (!f.set.has(t)) continue
        const s = w * f.w * idf(t)
        if (s > best) best = s
        matched.add(t)
      }
      if (best > 0) { covered++; score += best }
    }
    if (!score) continue
    // Documents that answer every word of the question beat ones that answer one word loudly.
    score *= .45 + .55 * covered / groups.length
    if (norm(doc.card.title).includes(norm(q.trim()))) score *= 1.6
    if (wants && doc.type === wants) score *= 2
    hits.push({ doc, score, matched, covered })
  }
  hits.sort((a, b) => b.score - a.score)
  const top = hits[0]?.score || 0, most = Math.max(0, ...hits.map(h => h.covered))
  // With several words, keep the records that answer (nearly) all of them.
  const enough = groups.length >= 3 ? most - 1 : most
  return hits.filter(h => h.score >= top * .42 && h.covered >= enough).slice(0, 6)
}

/** The sentence of a record that best shows why it matched. */
function snippet(doc: Doc, matched: Set<string>) {
  let best = doc.card.sub, bestN = 0
  for (const s of doc.prose) {
    const n = terms(s).filter(t => matched.has(t)).length
    if (n > bestN) { best = s; bestN = n }
  }
  return trim(best, 170)
}

/* ---------- intents ---------- */

const CARD = {
  email: { key: 'l:email', tag: 'EMAIL', title: LINKS.email, sub: 'The fastest way to reach Armaan.', action: { type: 'link', href: 'mailto:' + LINKS.email } },
  pdf: { key: 'l:pdf', tag: 'PDF', title: 'Resume (PDF)', sub: 'One page: roles, education, publications, skills.', action: { type: 'link', href: LINKS.resumePdf } },
  resume: { key: 'd:resume', tag: 'DRAWER 03', title: 'Resume', sub: 'Roles, dates and education. One page.', action: { type: 'view', view: 'resume' } },
  identity: { key: 'd:identity', tag: 'DRAWER 01', title: 'Identity', sub: PROFILE.line, action: { type: 'view', view: 'identity' } },
  linkedin: { key: 'l:linkedin', tag: 'LINK', title: 'LinkedIn', sub: 'linkedin.com/in/armaanmittal', action: { type: 'link', href: LINKS.linkedin } },
  github: { key: 'l:github', tag: 'LINK', title: 'GitHub', sub: LINKS.githubLabel, action: { type: 'link', href: LINKS.github } },
  lab: { key: 'd:lab', tag: 'DRAWER 05', title: 'The Lab', sub: 'Every project, to open, take apart and break.', action: { type: 'view', view: 'lab' } },
  research: { key: 'd:research', tag: 'DRAWER 06', title: 'Research', sub: 'Questions, methods and findings.', action: { type: 'view', view: 'research' } },
  caps: { key: 'd:capabilities', tag: 'DRAWER 02', title: 'Capabilities', sub: 'Skills, each tied to the work that uses it.', action: { type: 'view', view: 'capabilities' } },
  codechef: { key: 'l:codechef', tag: 'LINK', title: 'CodeChef', sub: 'Rated contests: ranked 362 and 535 of 20,000+.', action: { type: 'link', href: LINKS.codechef } },
  inspect: { key: 'd:inspect', tag: 'DRAWER · HOW THIS WORKS', title: 'Inspect the system', sub: 'The stack behind this site, layer by layer.', action: { type: 'view', view: 'inspect' } },
} satisfies Record<string, Card>
const projectCards = () => PROJECTS.map(p => ({ key: 'p:' + p.id, tag: 'PROJECT · ' + p.year, title: p.name, sub: p.l1, chips: p.tags, action: { type: 'project', id: p.id } as Action }))
const researchCards = () => RESEARCH.map((r, i) => ({ key: 'r:' + r.id, tag: 'RESEARCH · ' + r.status, title: r.title, sub: r.rows[0][1], action: { type: 'research', i } as Action }))
const current = RESUME[0].rows[0], before = RESUME[0].rows[1], school = RESUME[1].rows[0]
const MONTHS: Record<string, string> = { JAN: 'January', FEB: 'February', MAR: 'March', APR: 'April', MAY: 'May', JUN: 'June', JUL: 'July', AUG: 'August', SEP: 'September', OCT: 'October', NOV: 'November', DEC: 'December' }
/** 'JUN 2026 – NOW' → 'June 2026'. */
const since = (d = '') => d.split(' – ')[0].replace(/^([A-Z]{3})\b/, m => MONTHS[m] || m)
const role = (t: string) => t.replace(' · ', ' at ')

/** Which link was named, so it comes first. Set per request in ask(). */
let asked = ''
const linkAsked = (c: Card) => asked.includes(c.title.toLowerCase().replace(/\s/g, ''))

interface Intent { re: RegExp; heard: string; pool: QuipPool; line: () => string; cards?: () => Card[]; egg?: string; search?: boolean }

// Checked in order; the first that matches answers. `search: true` also appends matching records.
const INTENTS: Intent[] = [
  { re: /^(sudo|su|root)\b/, heard: 'PERMISSION REQUEST', pool: 'rude', line: () => 'Permission denied. This archive has no root user.', egg: 'sudo' },
  { re: /\b(coffee|tea|chai)\b/, heard: 'BEVERAGE REQUEST', pool: 'joke', line: () => '418 · I am a teapot. The archive refuses to brew coffee; chai is available on request.', egg: 'query' },
  { re: /^42$|meaning of life|answer to (life|everything)/, heard: 'THE BIG QUESTION', pool: 'joke', line: () => '42. The question is still missing from the index.', egg: 'query' },
  { re: /\b(fuck|shit|stupid|idiot|dumb|sucks|useless|trash|wtf|bitch|bastard)\b/, heard: 'FEEDBACK, UNFILTERED', pool: 'rude', line: () => 'Feedback received. The search box is doing its best.', cards: () => [CARD.lab, CARD.resume] },
  { re: /\b(joke|funny|make me laugh|humou?r)\b/, heard: 'A JOKE', pool: 'joke', line: () => quip('joke'), egg: 'query' },
  { re: /^(hi+|hello+|hey+|yo|sup|hola|namaste|good (morning|afternoon|evening)|greetings)\b/, heard: 'A GREETING', pool: 'greeting', line: () => 'Hello. Ask about projects, papers, skills or how to get in touch.', cards: () => [CARD.identity, CARD.lab] },
  { re: /\b(thanks?|thank you|thx|ty|cheers|awesome|nice|cool|great|amazing|love (it|this))\b/, heard: 'KIND WORDS', pool: 'thanks', line: () => 'Glad the archive was useful.' },
  { re: /\b(are you|is this) (an? )?(ai|bot|robot|chatgpt|gpt|llm|human|real)\b|how does (this|the) search|search (engine|box) (work|built)/, heard: 'THE SEARCH ITSELF', pool: 'meta', line: () => 'No language model here: a hand-built index, stemming, a synonym list and typo tolerance, all running in your browser. Plus a drawer of jokes.', cards: () => [CARD.inspect] },
  { re: /\b(phone|mobile number|call you|whatsapp|number)\b/, heard: 'CONTACT', pool: 'contact', line: () => `No phone number on file. Email scales better: ${LINKS.email}.`, cards: () => [CARD.email, CARD.linkedin] },
  { re: /\b(contact|email|e-mail|mail|reach|get in touch|talk to|connect|message|dm)\b/, heard: 'CONTACT', pool: 'contact', line: () => `Write to ${LINKS.email}. LinkedIn and GitHub are below.`, cards: () => [CARD.email, CARD.linkedin, CARD.github] },
  { re: /\b(linkedin|github|git hub|codechef|socials?|links?|handles?|twitter|instagram)\b/, heard: 'LINKS', pool: 'contact', line: () => 'GitHub for code, LinkedIn for the career, CodeChef for the contests. Email beats all three.',
    cards: () => { const order = [CARD.github, CARD.linkedin, CARD.codechef, CARD.email]; return order.sort((a, b) => +linkAsked(b) - +linkAsked(a)) } },
  { re: /\b(salary|ctc|pay|package|compensation|stipend|lpa|rate)\b/, heard: 'COMPENSATION', pool: 'money', line: () => 'Not on file. That conversation happens over email.', cards: () => [CARD.email] },
  { re: /\b(age|how old|birthday|born)\b/, heard: 'A PERSONAL FILE', pool: 'age', line: () => 'Not on file. The archive keeps work, not birthdays.', cards: () => [CARD.identity] },
  { re: /\b(girlfriend|boyfriend|married|single|relationship|dating|crush|wife|husband|love life)\b/, heard: 'A PERSONAL FILE', pool: 'personal', line: () => 'That file is not in this archive.', cards: () => [CARD.identity] },
  { re: /\b(favou?rite|hobby|hobbies|free time|weekend|fun fact)\b/, heard: 'OFF THE CLOCK', pool: 'about', line: () => 'Outside work: competitive programming on CodeChef, and teaching data structures and algorithms to 3,000+ students.', cards: () => [CARD.identity] },
  { re: /\b(hire|hiring|recruit|available|availability|open to|opportunit|vacanc|looking for (a )?(job|role|work)|notice period|join)\b/, heard: 'HIRING', pool: 'hire', line: () => `Currently ${role(current.t)}, since ${since(current.d)}. For roles and timing, email ${LINKS.email}.`, cards: () => [CARD.pdf, CARD.email, CARD.resume, CARD.lab] },
  { re: /\b(resume|resum|cv|biodata|curriculum)\b/, heard: 'THE RESUME', pool: 'resume', line: () => 'One page, as a drawer or a PDF.', cards: () => [CARD.pdf, CARD.resume] },
  { re: /\b(gpa|cgpa|grades?|marks|percentage|rank in college)\b/, heard: 'GRADES', pool: 'grades', line: () => `${school.s} ${school.t}, ${school.d}.`, cards: () => [CARD.resume] },
  { re: /\b(where|which) .*(live|based|from|located|stay|city|country)\b|\b(location|based in|hometown|timezone|time zone)\b/, heard: 'LOCATION', pool: 'location', line: () => 'Based in India (IST, UTC+5:30). Studied at Thapar, Patiala; interned in Bangalore.', cards: () => [CARD.identity] },
  { re: /\b(education|degree|college|university|studied|study|graduat|bachelor|thapar|major|minor)\b/, heard: 'EDUCATION', pool: 'education', line: () => `${school.s.replace(/\.$/, '')}, ${school.t}, ${school.d}.`, cards: () => [CARD.resume], search: true },
  { re: /\b(where|what) (do|does) (you|he) work|current(ly)? (job|role|company|work)|\bemployer\b|what do you do|day job/, heard: 'CURRENT WORK', pool: 'work', line: () => `${role(current.t)}, since ${since(current.d)}. Before that: ${role(before.t)} (2025).`, cards: () => [CARD.resume, CARD.caps] },
  { re: /^(who (are|is) (you|he|armaan|this)|about( (you|him|armaan))?|tell me about (yourself|him|armaan)|introduce( yourself)?|bio|profile|whoami)\??$/, heard: 'WHO THIS IS', pool: 'about', line: () => `${PROFILE.name}: ${PROFILE.line.charAt(0).toLowerCase() + PROFILE.line.slice(1)}`, cards: () => [CARD.identity, CARD.resume, CARD.lab] , egg: 'query' },
  { re: /\b(easter ?eggs?|secrets?|hidden|cheat codes?|konami|egg)\b/, heard: 'EASTER EGGS', pool: 'eggs', line: () => 'Twelve are filed. The Inspect page keeps count and gives hints.', cards: () => [CARD.inspect] },
  { re: /how (is|was) (this|the) (site|website|portfolio) (built|made)|(tech|stack) (behind|of|for) (this|the) (site|website)|\bsource code\b|this (site|website)|\bhow .*this site\b/, heard: 'THIS SITE', pool: 'site', line: () => `This site runs on ${LAYERS.map(l => l.v).join(', ')}. The Inspect page takes it apart.`, cards: () => [CARD.inspect, CARD.github] },
  { re: /^(skills?|tech ?stack|stack|technologies|tools|languages|what can (you|he) (do|build)|what are you good at|strengths?|expertise)\??$/, heard: 'SKILLS', pool: 'skills', line: () => RESUME[5].rows.map(r => `${r.t}: ${r.s}`).join('. ') + '.', cards: () => [CARD.caps, CARD.resume] },
  { re: /^((all|your|his|show( me)?( all)?( your| his)?) )?(projects?|portfolio|work|things (you|he) built|what (have you|has he) built)\??$/, heard: 'THE PROJECTS', pool: 'projects', line: () => `${PROJECTS.length} working drawings: ${PROJECTS.map(p => p.name).join(', ')}.`, cards: projectCards },
  { re: /^((all|your|his) )?(research|papers?|publications?)\??$/, heard: 'THE RESEARCH', pool: 'research', line: () => `${RESEARCH.length} records: one paper accepted at ASCML 2026, one under review at ESWA, and EEG speech research.`, cards: researchCards },
  { re: /\b(latest|newest|recent|current project|working on)\b/, heard: 'THE LATEST', pool: 'projects', line: () => 'The newest drawings are from 2026: ' + PROJECTS.filter(p => p.year === '2026').map(p => p.name).join(', ') + '.', cards: () => projectCards().filter(c => c.tag.endsWith('2026')) },
  { re: /^(help|\?|what can i (ask|search|do)|how does this work|options|commands)\??$/, heard: 'HELP', pool: 'meta', line: () => 'Ask like you would ask a person: "projects with RAG", "where does he work", "C++ low latency", "how do I contact him".', cards: () => [CARD.lab, CARD.resume, CARD.caps] },
]

/* ---------- answering ---------- */

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`

function lineFor(hits: Hit[], q: string, tone: Tone) {
  const top = hits[0].doc.card, n = hits.length
  const others = hits.slice(1, 3).map(h => h.doc.card.title)
  const more = others.length ? `, then ${others.join(' and ')}` : ''
  switch (tone) {
    case 'hiring': return `Short answer: ${top.title}. ${trim(snippet(hits[0].doc, hits[0].matched), 130)}`
    case 'engineering': return `Best match: ${top.title}${more}. ${hits[0].doc.tags ? 'Stack: ' + hits[0].doc.tags.slice(0, 5).join(', ') + '.' : ''}`.trim()
    case 'research': return `${plural(n, 'record')} on “${q.trim()}”. Most relevant: ${top.title}${more}.`
    default: return `${plural(n, 'record')} answer “${q.trim()}”. Best match: ${top.title}${more}.`
  }
}

/** Answers a request typed into the archive. Always returns something worth reading. */
export function ask(input: string, tone: Tone = 'hiring'): Answer {
  const q = input.trim().slice(0, 200), lower = norm(q).replace(/\s+/g, ' ').trim()
  const toneQuip = (pool: QuipPool) => tone === 'curiosity' && Math.random() < .3 ? quip('explorer') : quip(pool)

  asked = lower.replace(/\s/g, '')
  const intent = INTENTS.find(i => i.re.test(lower))
  if (intent) {
    const cards = intent.cards?.() ?? []
    if (intent.search) for (const h of retrieve(q)) if (!cards.some(c => c.key === h.doc.card.key)) cards.push({ ...h.doc.card, sub: snippet(h.doc, h.matched) })
    const line = intent.line()
    // The joke intent's line is itself a joke; its quip comes from another deck.
    return { heard: intent.heard, line, quip: intent.pool === 'joke' && intent.heard === 'A JOKE' ? quip('found') : toneQuip(intent.pool), cards: cards.slice(0, 6), egg: intent.egg }
  }

  const hits = retrieve(q)
  if (!hits.length) {
    // Nothing filed: the closest words in the index, and the drawers that are always worth opening.
    const near = suggestionsFor(lower)
    return {
      heard: 'NOT IN THE INDEX', line: near.length ? `Nothing filed under “${q}”. Did you mean ${near.map(w => `“${w}”`).join(' or ')}?` : `Nothing filed under “${q}”. Try a project, a skill, a paper or a question.`,
      quip: toneQuip('empty'), cards: [CARD.lab, CARD.caps, CARD.resume],
    }
  }
  const cards = hits.map(h => {
    const hitsTags = h.doc.tags?.filter(t => terms(t).some(x => h.matched.has(x)))
    return { ...h.doc.card, sub: snippet(h.doc, h.matched), hits: hitsTags }
  })
  const kind = hits[0].doc.kind
  return { heard: 'FROM THE INDEX', line: lineFor(hits, q, tone), quip: toneQuip(kind in QUIPS ? kind : 'found'), cards }
}

/** Index words close to what was typed, for "did you mean". */
function suggestionsFor(lower: string) {
  index()
  const out: string[] = []
  for (const w of words(lower)) {
    if (w.length < 4 || STOP.has(w)) continue
    const best = vocab.find(v => v.length > 3 && within(stem(w), v, 2))
    if (best && !out.includes(best)) out.push(best)
  }
  return out.slice(0, 2)
}

/** Builds the index ahead of the first request (the search box calls this when it gets focus). */
export function warmUp() { index() }
