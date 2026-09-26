// Everything the archive says lives here. Nothing else in the app needs editing to change it.

export type Category = 'systems' | 'ai' | 'research' | 'interface'
export type Material = 'paper' | 'draft' | 'film'
export type View =
  | 'hub' | 'identity' | 'capabilities' | 'resume' | 'trace' | 'lab'
  | 'project' | 'research' | 'report' | 'inspect' | 'colophon'

export interface Decision { q: string; alt: string; whyNot: string[]; decision: string }
export interface Failure { problem: string; symptom: string; investigation: string; solution: string; result: string }
export interface Project {
  id: string
  name: string
  tag: string
  cat: Category
  year: string
  tags: string[]
  /** Public source. Left out when the code is private. */
  repo?: string
  /** A running version, when there is one. */
  live?: string
  /** Shown instead of a source link when the code isn't public. */
  sourceNote?: string
  l1: string
  l2: string
  pipeline: string[]
  /** Custom error output when stage i is pulled out. Stages without one get a generic mismatch. */
  breaks: Record<number, string[]>
  why: Decision[]
  fails: Failure[]
}

export const LINKS = {
  email: 'me@amittal.dev',
  resumePdf: '/Armaan_Mittal_Resume.pdf',
  github: 'https://github.com/armaanmittalweb',
  githubLabel: 'github.com/armaanmittalweb',
  linkedin: 'https://www.linkedin.com/in/armaanmittal/',
  codechef: 'https://www.codechef.com/users/armaanmittal',
}

export const PROFILE = {
  name: 'Armaan Mittal',
  line: 'Software engineer building multi-agent systems, low-latency backends and applied NLP research.',
  facts: [
    { k: 'CURRENTLY', v: 'Software Engineer (Implementation) at Engagely.ai, since June 2026' },
    { k: 'BEFORE', v: 'Research Intern at Samsung R&D Institute Bangalore, 2025' },
    { k: 'STUDY', v: 'BE, Electronics and Computer Engineering, minor in Conversational AI · Thapar Institute of Engineering & Technology, 2022–2026' },
    { k: 'BASE', v: 'India' },
    { k: 'OUTSIDE WORK', v: 'Competitive programming on CodeChef, and teaching data structures and algorithms: 3,000+ students through the Creative Computing Society.' },
  ],
}

export interface ResumeRow { t: string; d?: string; s: string }
export const RESUME: { h: string; rows: ResumeRow[] }[] = [
  { h: 'EXPERIENCE', rows: [
    { t: 'Software Engineer (Implementation) · Engagely.ai', d: 'JUN 2026 – NOW', s: 'Multi-agent orchestration with tool-calling and RAG on a multi-tenant SaaS platform (Python, FastAPI, Celery, Redis), deployed for enterprise clients including Cipla and ART. Load testing at 1,000 virtual users, SSO/OIDC, and TTS/STT (XTTS-v2) in production.' },
    { t: 'Research Intern · Samsung R&D Institute Bangalore', d: 'FEB – NOV 2025', s: 'Low-latency NLP for Bixby in 12 languages: gibberish detection and PII masking at 93.4% multilabel accuracy, exposed through an MCP server and client. End-to-end latency down 15% through quantization and cache-aware preprocessing.' },
    { t: 'Student Researcher & ELC Intern · TIET Patiala', d: 'JUL 2025', s: 'Speech reconstruction from 66-channel EEG: reproducible training scripts for Conformer, MAE and Siamese components. Inference cut from 74 s to 2 s with pruning and streaming chunking.' },
  ] },
  { h: 'EDUCATION', rows: [
    { t: 'Thapar Institute of Engineering & Technology, Patiala', d: '2022 – 2026', s: 'BE, Electronics and Computer Engineering, with a minor in Conversational AI.' },
  ] },
  { h: 'PUBLICATIONS', rows: [
    { t: 'Scalable Multilingual Content Validation: A Dataset-Free Approach to Gibberish Detection', d: 'ASCML 2026', s: 'Accepted.' },
    { t: 'PRISM-Home: Policy-Routed, Interpretable, State-Grounded Messaging', d: 'IN REVIEW', s: 'Under review at Expert Systems With Applications (Elsevier).' },
  ] },
  { h: 'AWARDS', rows: [
    { t: 'Amazon Summer School', d: '2024', s: 'Selected for the national AI/ML programme.' },
    { t: 'Meta Pragati Hackathon', s: 'National finalist.' },
    { t: 'CodeChef', s: 'Ranked 362 and 535 out of 20,000+ in rated contests.' },
  ] },
  { h: 'LEADERSHIP', rows: [
    { t: 'Head, Competitive Programming Contest · Saturnalia', s: 'Organized and ran a national-level programming contest with 300 participants.' },
    { t: 'Coding Mentor & Core Member · Creative Computing Society', d: '2023 – 2024', s: 'Taught data structures and algorithms to 3,000+ students through recorded modules and live sessions.' },
  ] },
  { h: 'SKILLS', rows: [
    { t: 'Languages', s: 'C++, Python, Java, Go, SQL, Bash' },
    { t: 'Systems & agents', s: 'Multi-agent orchestration, tool-calling, Model Context Protocol (MCP), Claude Code, OS internals, memory and concurrency models' },
    { t: 'Backend & infrastructure', s: 'MySQL, PostgreSQL, MongoDB, distributed and low-latency systems, Linux, Git, CI/CD, Docker, Kubernetes' },
  ] },
]

export const COLOPHON = [
  { k: 'TYPE', v: 'Big Shoulders Stencil, Newsreader, Martian Mono' },
  { k: 'MATERIALS', v: 'Steel, paper, drafting film, microfilm' },
  { k: 'BUILD', v: 'React, Vite and three.js, compiled to static files' },
  { k: 'SOUND', v: 'Synthesized in your browser with the Web Audio API. There are no audio files.' },
  { k: 'FIRST COMMIT', v: '21 September 2026' },
  { k: 'SOURCE', v: 'github.com/armaanmittalweb/amittal.dev' },
]

export const PROJECTS: Project[] = [
  { id: 'farmsaathi', name: 'FarmSaathi', tag: 'Voice farm assistant on local models', cat: 'ai', year: '2026',
    tags: ['RAG', 'LLM', 'Speech', 'NLP', 'Multilingual', 'Computer vision', 'FastAPI', 'MongoDB', 'React'],
    repo: 'https://github.com/armaanmittalweb/FarmSathi',
    l1: 'A Hindi, English and Punjabi farming assistant with voice chat over RAG, leaf-photo disease detection and crop advice, all on local open-weight models.',
    l2: "A spoken question goes through the Express backend to a persistent FastAPI model service, where faster-whisper transcribes it and multilingual-e5 pulls farming passages and the farmer's profile from ChromaDB. Qwen2.5-3B, running on llama.cpp, answers in English or Hindi; Punjabi answers are written in English and translated with NLLB-200, and MMS-TTS speaks the reply. The same service hosts a MobileNetV2 leaf-disease classifier and a random-forest crop recommender. It began as a four-person team project in 2025 and was rebuilt around the model service in 2026.",
    pipeline: ['Voice input', 'Whisper STT', 'RAG retrieval', 'Qwen LLM', 'NLLB translation', 'MMS-TTS'],
    breaks: {
      1: ['EXPECTED  transcript {text, language} from /transcribe', 'RECEIVED  raw audio upload', 'No message text (or transcribable audio) provided.', 'CHAT REQUEST REJECTED (400)'],
      3: ['EXPECTED  qwen2.5-3b-instruct-q4_k_m.gguf in memory', 'RECEIVED  no model weights', 'LLM weights not found', 'MODEL SERVICE 503'],
    },
    why: [
      { q: 'Why a persistent model service instead of a Python process per request?', alt: 'Spawning Python for every message', whyNot: ['Model weights reloaded on every message', 'Would not scale past one concurrent user'], decision: 'PERSISTENT FASTAPI SERVICE' },
      { q: 'Why translate Punjabi instead of generating it?', alt: 'Asking the 3B model to answer in Punjabi', whyNot: ['A 3B model writes weak Punjabi', 'NLLB-200 covers Punjabi out of the box'], decision: 'ENGLISH FIRST, THEN NLLB' },
    ],
    fails: [{ problem: 'The disease model was an empty file', symptom: 'The committed model was an 800-byte HDF5 stub, so plant analysis had nothing to load.', investigation: 'The notebook had trained the model, but its final save cell errored on a later re-run, and a bare .h5 kept no class order.', solution: 'One training script that trains, evaluates and saves the model with its class names; the service turns an unloadable model into a clear 503.', result: 'An 11 MB MobileNetV2 model is committed, reporting about 90% validation accuracy.' }] },
  { id: 'latentbook', name: 'LatentBook', tag: 'Low-latency order book and market-data simulator', cat: 'systems', year: '2026',
    tags: ['C++', 'Low latency', 'Order book', 'Lock-free', 'Concurrency', 'Google Benchmark', 'MCP', 'Claude Code'],
    sourceNote: 'SOURCE · PRIVATE REPOSITORY',
    l1: 'A C++ limit order-book engine that matches orders by price-time priority against simulated live market-data feeds.',
    l2: 'Simulated market-data feeds hand orders through lock-free ring buffers to a matching engine that fills them by price, then by time of arrival. The book is laid out for cache locality so tail latency stays predictable, p50 and p99 latency are profiled under concurrent order flow, and correctness is checked with property-based and stress tests. Benchmark generation, latency-regression detection and test scaffolding run as agent workflows built on Claude Code and custom MCP tools.',
    pipeline: ['Market-data feed', 'Lock-free ring buffer', 'Matching engine', 'Order book', 'Executions'],
    breaks: {},
    why: [
      { q: 'Why lock-free ring buffers between the feed and the engine?', alt: 'A mutex-guarded queue', whyNot: ['Lock contention shows up in the p99, not the p50', 'A blocked feed thread stalls every order behind it'], decision: 'LOCK-FREE RING BUFFERS' },
      { q: 'Why build the benchmark and test tooling as agent workflows?', alt: 'Hand-written harnesses', whyNot: ['Every change needs a benchmark run and a regression check', 'Test scaffolding is repetitive to write by hand'], decision: 'CLAUDE CODE + CUSTOM MCP TOOLS' },
    ],
    fails: [] },
  { id: 'fieldnotes', name: 'Fieldnotes', tag: 'Cited answers across expert-call transcripts', cat: 'ai', year: '2026',
    tags: ['RAG', 'LLM', 'Embeddings', 'Vector search', 'MongoDB', 'APIs', 'Cloudflare Workers'],
    repo: 'https://github.com/armaanmittalweb/Some-Random-RAG',
    live: 'https://ragforeshaan.amittal.dev',
    l1: 'A source-grounded question-answering tool over expert-call transcripts that cites the excerpts behind every claim.',
    l2: 'Each transcript is split into one chunk per timestamped speaker turn, tagged with expert, market and time, embedded with Gemini and stored in MongoDB Atlas. A question is embedded and matched with Atlas vector search, falling back to keyword overlap, and the top ten turns go to Gemini as numbered excerpts with a rule that every claim cites one. The answer is shown beside its evidence trail; the live build runs on a Cloudflare Worker that walks a chain of four models.',
    pipeline: ['Transcripts', 'Turn chunking', 'Gemini embeddings', 'Atlas vector search', 'Cited prompt', 'Model fallback', 'Evidence trail'],
    breaks: { 2: ['EXPECTED  queryVector number[768]', 'RECEIVED  raw question string', '$vectorSearch index needs 768-dim vectors', 'RETRIEVAL ABORTED'] },
    why: [
      { q: 'Why chunk by speaker turn?', alt: 'Fixed-size text windows', whyNot: ['Timestamps must survive into citations', 'A turn is the unit a quote comes from'], decision: 'ONE CHUNK PER TURN' },
      { q: 'Why a chain of models?', alt: 'One Gemini model', whyNot: ['A rate limit or server error would fail the answer', 'Each model gets its own timeout'], decision: 'FOUR-MODEL FALLBACK CHAIN' },
    ],
    fails: [{ problem: 'The serverless port dropped the citations', symptom: 'On the live build the evidence trail showed excerpts with blank timestamps, and answers were not tied to numbered sources.', investigation: 'The Worker rewrite kept only text and score from the vector search, joined excerpts without numbers and used a prompt without the cite-every-claim rule. The local API did all three.', solution: 'The frontend maps missing fields to placeholders so the trail still renders.', result: 'Open: the numbered context and citation prompt still need porting to the Worker.' }] },
  { id: 'openingos', name: 'OpeningOS', tag: 'Local-first chess opening repertoire trainer', cat: 'interface', year: '2026',
    tags: ['Chess', 'PWA', 'IndexedDB', 'Spaced repetition', 'Graph model', 'Fastify', 'PostgreSQL', 'Playwright'],
    repo: 'https://github.com/armaanmittalweb/OpeningOS',
    live: 'https://armaanmittalweb.github.io/OpeningOS/',
    l1: 'A local-first web app for building chess opening repertoires, drilling them with spaced repetition, and checking real games against your preparation.',
    l2: 'Each repertoire line is replayed with chess.js into a graph of positions keyed by normalized FEN, so move orders that transpose land on the same node. Every move on your side becomes a practice card scheduled by an FSRS-style memory model, and imported games are matched against every active line to find where you or your opponent left the preparation. State lives in the browser, mirrored to IndexedDB, with optional sync to a Fastify and Postgres backend.',
    pipeline: ['Line input', 'Move replay', 'Position graph', 'Practice cards', 'FSRS scheduler', 'Game review'],
    breaks: {
      1: ['EXPECTED  FEN string per ply', 'RECEIVED  moves as SAN strings', 'No position key for transposition lookup', 'GRAPH BUILD ABORTED'],
      4: ['EXPECTED  card state {stability, difficulty, due}', 'RECEIVED  card with no due timestamp', 'isDue() is true for every card', 'EVERY CARD DUE EVERY SESSION'],
    },
    why: [
      { q: 'Why key positions by FEN instead of move order?', alt: 'A move tree per line', whyNot: ['Transpositions split into duplicate nodes', 'Games that reach the preparation by another order go unmatched'], decision: 'NORMALIZED-FEN POSITION GRAPH' },
      { q: 'Why local-first instead of a server-backed app?', alt: 'The server as the source of truth', whyNot: ['Drills have to work offline', 'The frontend is hosted as static files'], decision: 'LOCAL-FIRST, SYNC OPTIONAL' },
    ],
    fails: [{ problem: 'The tab froze after the new app shell shipped', symptom: 'The browser became unresponsive as soon as the shell mounted.', investigation: 'Two shell functions called each other, and an observer on the whole app subtree re-fired on DOM the shell had just added, rerunning a document-wide text pass.', solution: 'Broke the recursion, scoped and throttled the text pass, then replaced the observers and polling with a hook on navigation.', result: 'Fixed in two commits the next day, with a smoke test that fails if the recursion returns.' }] },
  { id: 'edusched', name: 'EduSched', tag: 'Class rescheduling with clash checks', cat: 'systems', year: '2025',
    tags: ['React', 'Node.js', 'Express', 'MySQL', 'SQL', 'JWT', 'Scheduling'],
    repo: 'https://github.com/armaanmittalweb/TimeTable-Management-for-College',
    l1: 'A college timetable app where professors cancel or move a class and students see the change, with room and clash checks.',
    l2: "The regular timetable lives in MySQL. Cancelling or postponing never edits it: the change is written to an overlay table with an expiry date, and every timetable read joins that overlay for the student's batch or the professor's courses. To postpone, the API lists the rooms free in the chosen slot, then re-checks the professor's and the room's bookings inside a transaction before saving the change.",
    pipeline: ['JWT login', 'Base timetable', 'Change overlay', 'Free-room query', 'Clash checks', 'Commit change'],
    breaks: {
      0: ['EXPECTED  Authorization: Bearer <JWT>', 'RECEIVED  no token', "401 { error: 'Access token required' }", 'TIMETABLE REQUEST REJECTED'],
      3: ['EXPECTED  classrooms[] free for {date, startTime, endTime}', 'RECEIVED  empty room list', 'No rooms available for the selected time slot.', 'POSTPONE ABORTED'],
    },
    why: [
      { q: 'Why an overlay table instead of editing the timetable?', alt: 'Updating timetable rows in place', whyNot: ['Changes are meant to last one week', 'The regular schedule stays untouched'], decision: 'CHANGE OVERLAY TABLE' },
      { q: 'Why re-check clashes on submit?', alt: 'Trusting the room list the client showed', whyNot: ['The room list ignores professor clashes', 'A slot can fill between listing and submitting'], decision: 'CHECKS INSIDE A TRANSACTION' },
    ],
    fails: [] },
]

export const RESEARCH = [
  { id: 'R-01', title: 'Dataset-free gibberish detection across languages', status: 'ACCEPTED · ASCML 2026', rows: [
    ['PAPER', 'Scalable Multilingual Content Validation: A Dataset-Free Approach to Gibberish Detection'],
    ['QUESTION', 'Can gibberish be told apart from real text in many languages without a labelled dataset for each one?'],
    ['RELATED WORK', 'Gibberish detection and PII masking for Bixby in 12 languages at Samsung R&D Institute Bangalore, at 93.4% multilabel accuracy.'],
  ] },
  { id: 'R-02', title: 'PRISM-Home', status: 'UNDER REVIEW · ESWA', rows: [
    ['PAPER', 'PRISM-Home: Policy-Routed, Interpretable, State-Grounded Messaging'],
    ['VENUE', 'Expert Systems With Applications (Elsevier)'],
    ['STATUS', 'Under review.'],
  ] },
  { id: 'R-03', title: 'Speech reconstruction from EEG', status: 'TIET PATIALA · 2025', rows: [
    ['QUESTION', 'Can speech be reconstructed from brain signals recorded on 66 EEG channels?'],
    ['METHOD', 'Reproducible training scripts implementing Conformer, masked autoencoder (MAE) and Siamese components.'],
    ['RESULT', 'Inference cut from 74 s to 2 s with pruning and streaming chunking for multimodal fusion.'],
  ] },
]

// The six layers of the exploded vault on the Inspect page. Each names a part of
// the real stack; keep this list true to package.json.
export const LAYERS = [
  { k: 'PROCEDURAL', v: 'Seeded PRNG · mulberry32', part: 'CORE',
    why: 'The core is coloured by your seed. The 64-bit seed is folded to 32 bits (its two halves XORed) and fed to mulberry32, which decides every variation you see.' },
  { k: 'AUDIO', v: 'Web Audio API', part: 'GASKET',
    why: 'Every sound is made in code as you act, with no audio files: the lock, the dial and the door are scheduled on the audio clock to land on the frame you see. A drone tuned from your seed stays off until you turn it on; its filter opens as the material changes from paper to film.' },
  { k: 'FRONTEND', v: 'React 19 · Vite', part: 'DOOR',
    why: 'Every screen and drawer is a React component. Vite compiles the site to static files, and the fast-access page loads no 3D code at all.' },
  { k: 'STATE', v: 'Zustand', part: 'DIAL',
    why: 'One store holds the seed, what you opened and what you seemed to care about. It is saved to this browser only and sent nowhere.' },
  { k: 'MOTION', v: 'CSS transitions', part: 'WHEEL',
    why: 'No animation library. The unlock runs on Web Animations and the 3D door from one shared start time, drawers use CSS transitions, and each 3D view draws only while something moves. Reduced motion switches the movement off.' },
  { k: 'RENDERING', v: 'three.js r160', part: 'KEYHOLE',
    why: 'Objects you handle are 3D, built as web components that load after the page is usable. Anything you read stays in the DOM.' },
]

export const CABINET: [num: string, label: string, key: string, mat: Material, desc: string][] = [
  ['01', 'IDENTITY', 'identity', 'paper', 'Who I am, where I work from, the portrait.'],
  ['02', 'CAPABILITIES', 'capabilities', 'paper', 'Skills, each tied to the work that uses it.'],
  ['03', 'RESUME', 'resume', 'paper', 'Roles, dates and education. One page.'],
  ['04', 'TRACE', 'trace', 'draft', 'How the work grew, year by year.'],
  ['05', 'THE LAB', 'lab', 'draft', 'Projects to open, take apart and break.'],
  ['06', 'RESEARCH', 'research', 'film', 'Questions, methods and findings.'],
  ['07', 'TRANSMISSION', 'report', 'film', 'What you looked at, read back to you.'],
]

export const CAT_LABEL: Record<Category, string> = { systems: 'SYSTEMS', ai: 'AI', research: 'RESEARCH', interface: 'INTERFACE' }

export interface Capability {
  id: string; name: string; title: string; tech: string
  /** Lab projects that use it. */
  projects: string[]
  /** Work outside the Lab that proves it, and the drawer that describes it. */
  at?: [label: string, view: View][]
}
export const CAPS: { group: string; cat: Category; items: Capability[] }[] = [
  { group: 'AI SYSTEMS', cat: 'ai', items: [
    { id: 'agents', name: 'MULTI-AGENT SYSTEMS', title: 'Multi-agent systems', projects: [], at: [['Engagely.ai', 'resume']], tech: 'Role-specialized agents, a central controller, tool-calling' },
    { id: 'rag', name: 'RAG', title: 'RAG', projects: ['fieldnotes', 'farmsaathi'], at: [['Engagely.ai', 'resume']], tech: 'Gemini embeddings, MongoDB Atlas Vector Search, ChromaDB, multilingual-e5' },
    { id: 'llm', name: 'LLM APPLICATIONS', title: 'LLM applications', projects: ['fieldnotes', 'farmsaathi'], tech: 'Gemini, Qwen2.5 on llama.cpp, Azure OpenAI, citation prompts, model fallback' },
    { id: 'mcp', name: 'MCP & TOOLING', title: 'MCP and agentic tooling', projects: ['latentbook'], at: [['Samsung R&D', 'resume']], tech: 'MCP servers and clients, Claude Code' },
  ] },
  { group: 'LANGUAGE & RESEARCH', cat: 'research', items: [
    { id: 'nlp', name: 'MULTILINGUAL NLP', title: 'Multilingual NLP', projects: ['farmsaathi'], at: [['Samsung R&D', 'resume'], ['ASCML 2026 paper', 'research']], tech: 'Gibberish detection, PII masking, NLLB-200 translation' },
    { id: 'speech', name: 'SPEECH', title: 'Speech recognition and synthesis', projects: ['farmsaathi'], at: [['Engagely.ai', 'resume']], tech: 'faster-whisper, MMS-TTS, XTTS-v2' },
    { id: 'eeg', name: 'EEG RESEARCH', title: 'EEG research', projects: [], at: [['TIET research', 'research']], tech: 'Conformer, MAE and Siamese components, pruning, streaming chunking' },
  ] },
  { group: 'SYSTEMS', cat: 'systems', items: [
    { id: 'lowlat', name: 'LOW-LATENCY C++', title: 'Low-latency C++', projects: ['latentbook'], tech: 'Lock-free ring buffers, cache-aware layout, Google Benchmark' },
    { id: 'api', name: 'APIS', title: 'APIs', projects: ['farmsaathi', 'fieldnotes', 'openingos', 'edusched'], at: [['Engagely.ai', 'resume']], tech: 'FastAPI, Express, Fastify, Cloudflare Workers' },
    { id: 'db', name: 'DATABASES', title: 'Databases', projects: ['edusched', 'openingos', 'fieldnotes', 'farmsaathi'], tech: 'MySQL, PostgreSQL, MongoDB, ChromaDB, IndexedDB' },
    { id: 'infra', name: 'INFRASTRUCTURE', title: 'Infrastructure', projects: ['fieldnotes', 'farmsaathi'], at: [['Samsung R&D', 'resume'], ['Engagely.ai', 'resume']], tech: 'Docker, Kubernetes, CI/CD, Celery, RabbitMQ, Redis' },
    { id: 'web', name: 'WEB APPS', title: 'Web apps', projects: ['openingos', 'edusched', 'fieldnotes'], tech: 'React, local-first PWAs, IndexedDB' },
  ] },
]

export interface TraceNode {
  id: string; label: string; year: string; x: number; y: number
  /** The visited-key that inks this node in. */
  key: string
  note: string
  view?: View
  project?: string
}

export const NODES: TraceNode[] = [
  { id: 'n1', label: 'THAPAR', year: '2022', x: 320, y: 330, key: 'identity', note: 'Electronics and Computer Engineering, with a minor in Conversational AI.', view: 'identity' },
  { id: 'n2', label: 'DSA', year: '2023', x: 130, y: 260, key: 'resume', note: 'Competitive programming, and teaching data structures and algorithms to 3,000+ students.', view: 'resume' },
  { id: 'n3', label: 'EDUSCHED', year: '2025', x: 510, y: 250, key: 'p:edusched', note: 'A full-stack scheduling app: an overlay table and clash checks in MySQL.', project: 'edusched' },
  { id: 'n4', label: 'MULTILINGUAL NLP', year: '2025', x: 90, y: 150, key: 'research', note: 'Gibberish detection and PII masking for Bixby in 12 languages, and a paper at ASCML 2026.', view: 'research' },
  { id: 'n5', label: 'FARMSAATHI', year: '2026', x: 300, y: 170, key: 'p:farmsaathi', note: 'Speech, RAG and translation on local models, in three languages.', project: 'farmsaathi' },
  { id: 'n6', label: 'FIELDNOTES', year: '2026', x: 540, y: 130, key: 'p:fieldnotes', note: 'Retrieval with a citation for every claim.', project: 'fieldnotes' },
  { id: 'n7', label: 'AGENTS', year: '2026', x: 200, y: 50, key: 'capabilities', note: 'Multi-agent orchestration with tool-calling and RAG at Engagely.ai.', view: 'capabilities' },
  { id: 'n8', label: 'LATENTBOOK', year: '2026', x: 450, y: 40, key: 'p:latentbook', note: 'A C++ order book built for predictable tail latency.', project: 'latentbook' },
]
export const EDGES: [string, string][] = [
  ['n1', 'n2'], ['n1', 'n3'], ['n2', 'n4'], ['n2', 'n8'], ['n3', 'n5'], ['n3', 'n6'],
  ['n4', 'n5'], ['n4', 'n7'], ['n6', 'n7'], ['n5', 'n7'],
]

/** Things to find. Each one is a tick in the header and a line in the report. */
export const TARGETS = [
  'identity', 'capabilities', 'resume', 'trace', 'lab', 'research',
  ...PROJECTS.map(p => 'p:' + p.id),
  'break', 'why', 'fail', 'depth3', 'query', 'inspect',
]

export const OBJECTIVES = [
  { id: 'hiring', label: 'UNDERSTAND THE ENGINEER', short: 'THE ENGINEER',
    desc: 'Who I am, what I have done and how to reach me. The shortest path.',
    path: [['Identity', 'identity'], ['Resume', 'resume'], ['The Lab', 'lab'], ['Transmission', 'report']] },
  { id: 'engineering', label: 'SEE THE WORK', short: 'THE WORK',
    desc: 'Systems, architecture and the decisions behind them.',
    path: [['Capabilities', 'capabilities'], ['LatentBook', 'p:latentbook'], ['Inspect system', 'inspect'], ['Transmission', 'report']] },
  { id: 'research', label: 'READ THE RESEARCH', short: 'THE RESEARCH',
    desc: 'Multilingual NLP, speech from EEG, and the papers behind them.',
    path: [['Research', 'research'], ['FarmSaathi', 'p:farmsaathi'], ['Trace', 'trace'], ['Transmission', 'report']] },
  { id: 'curiosity', label: 'BREAK THE SYSTEM', short: 'THE SYSTEM',
    desc: 'Take projects apart, wander, and find out how this site works.',
    path: [['The Lab', 'lab'], ['Trace', 'trace'], ['Inspect system', 'inspect'], ['Transmission', 'report']] },
]

export const MATERIAL: Record<View, Material> = {
  hub: 'paper', identity: 'paper', capabilities: 'paper', resume: 'paper',
  trace: 'draft', lab: 'draft', project: 'draft',
  research: 'film', report: 'film', inspect: 'film', colophon: 'film',
}

export const NAV: [num: string, label: string, view: View][] = [
  ['00', 'CORE', 'hub'], ['01', 'IDENTITY', 'identity'], ['02', 'CAPABILITIES', 'capabilities'], ['03', 'RESUME', 'resume'],
  ['04', 'TRACE', 'trace'], ['05', 'THE LAB', 'lab'], ['06', 'RESEARCH', 'research'], ['07', 'TRANSMISSION', 'report'],
]

export interface Egg { id: string; code: string; title: string; body: string; hint: string }
export const EGGS: Egg[] = [
  { id: 'lamp', code: 'EGG-01', title: 'LAMP TEST', body: 'The vault lamp was tested five times. It works.', hint: 'The vault has a light. Lights can be tested.' },
  { id: 'tag', code: 'EGG-02', title: 'IF FOUND', body: 'The back of the key tag has a return address.', hint: 'Every tag has two sides.' },
  { id: 'misfiled', code: 'EGG-03', title: 'MISFILED RECORD', body: 'Your seed hid a record in one of the paper drawers.', hint: 'Something is in the wrong drawer.' },
  { id: 'query', code: 'EGG-04', title: 'OFF-INDEX REQUEST', body: 'The archive answered a question it was not built for.', hint: 'Ask the request form who I am. Or about coffee.' },
  { id: 'sudo', code: 'EGG-05', title: 'NO ROOT', body: 'Nice try. This archive has no root user.', hint: 'Ask for more permissions.' },
  { id: 'demolition', code: 'EGG-06', title: 'DEMOLITION CREW', body: 'You removed every stage of one pipeline.', hint: 'Break every part of one machine.' },
  { id: 'konami', code: 'EGG-07', title: 'NEGATIVE', body: 'The archive is now printed in negative. Enter the code again to develop it.', hint: '↑ ↑ ↓ ↓ ← → ← → …' },
  { id: 'colophon', code: 'EGG-08', title: 'DRAWER 99', body: 'A drawer that is not in the index.', hint: 'The name in the header is a handle. Pull it five times.' },
  { id: 'idle', code: 'EGG-09', title: 'THE ARCHIVIST DOZED OFF', body: 'Forty seconds without a sound. Move to wake them.', hint: 'Sit still for a while.' },
  { id: 'tab', code: 'EGG-10', title: 'YOU CAME BACK', body: 'The tab title noticed you left.', hint: 'Leave, then return.' },
  { id: 'console', code: 'EGG-11', title: 'SOURCE DRAWER', body: 'You knocked from the developer console.', hint: 'Engineers check the console.' },
  { id: 'lockdown', code: 'EGG-12', title: 'LOCKDOWN', body: 'Ten pulls on the handle. Your key was revoked and the vault resealed.', hint: 'Drawer 99 is not the last thing the handle does.' },
]

export interface Secret { re: RegExp; title: string; body: string; egg?: string; to?: View }
export const SECRETS: Secret[] = [
  { re: /^sudo/, title: 'PERMISSION DENIED', body: 'Nice try. This archive has no root user.', egg: 'sudo' },
  { re: /who are you|who is armaan|^about/, title: 'REQUEST ROUTED', body: 'This archive is maintained by one person. Their file is in Drawer 01.', to: 'identity' },
  { re: /coffee|\btea\b/, title: '418 · I AM A TEAPOT', body: 'The archive refuses to brew coffee. Tea is available on request.' },
  { re: /^42$|meaning of life/, title: 'ANSWER FOUND', body: '42. The question is still missing from the index.' },
  { re: /hire|job|recruit/, title: 'PRIORITY REQUEST', body: 'Fast track approved. The record is in Drawer 03.', to: 'resume' },
]
