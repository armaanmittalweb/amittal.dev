// Everything the archive says lives here. Bracketed values are placeholders
// waiting for the content pass; nothing else in the app needs editing to fill them.

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
  l1: string
  l2: string
  pipeline: string[]
  /** Custom error output when stage i is pulled out. Stages without one get a generic mismatch. */
  breaks: Record<number, string[]>
  why: Decision[]
  fails: Failure[]
}

export const LINKS = {
  email: 'hello@amittal.dev',
  // Fill these in during the content pass. '#' renders as a dead link until then.
  resumePdf: '#',
  github: '#',
  githubLabel: 'github.com/[handle]',
  linkedin: '#',
}

export const PROFILE = {
  name: 'Armaan Mittal',
  line: 'Engineer working across intelligent systems, backend infrastructure and applied research.',
  facts: [
    { k: 'BASE', v: 'Patiala, India' },
    { k: 'STUDY', v: 'Thapar Institute of Engineering & Technology' },
    { k: 'CURRENTLY', v: 'Open to internships and full-time roles' },
    { k: 'OUTSIDE WORK', v: '[What you do when you are not building]' },
  ],
}

export const RESUME = [
  { h: 'EXPERIENCE', rows: [
    { t: '[Role] · [Company]', d: '2025', s: '[One line on what you built and its measurable result.]' },
    { t: 'Research Assistant · [Lab]', d: '2024', s: 'EEG decoding experiments that led to NeuroSpeak.' },
  ] },
  { h: 'EDUCATION', rows: [
    { t: 'Thapar Institute of Engineering & Technology', d: '—2026', s: '[Degree, programme]' },
  ] },
  { h: 'AWARDS', rows: [
    { t: '[Award or recognition]', d: '[Year]', s: '[One line of context.]' },
  ] },
]

export const COLOPHON = [
  { k: 'TYPE', v: 'Big Shoulders Stencil, Newsreader, Martian Mono' },
  { k: 'MATERIALS', v: 'Steel, paper, drafting film, microfilm' },
  { k: 'BUILD', v: 'React, Vite and three.js, compiled to static files' },
  { k: 'BUILT IN', v: '[City] · [Month Year]' },
  { k: 'TIME', v: '[Number] evenings' },
  { k: 'FIRST COMMIT', v: '[Date]' },
  { k: 'THANKS', v: '[Names]' },
]

export const PROJECTS: Project[] = [
  { id: 'neurospeak', name: 'NeuroSpeak', tag: 'EEG signals to text to speech', cat: 'research', year: '2024',
    tags: ['EEG', 'Signal processing', 'Transformers', 'NLP', 'Speech', 'Research', 'PyTorch'],
    l1: 'A research pipeline that decodes EEG signals into text, then synthesizes speech from that text.',
    l2: 'Multi-channel EEG is filtered and cut into epochs, converted to band-power features, and passed to a transformer encoder that predicts tokens. Tokens are decoded into text, and a TTS stage turns the text into audio.',
    pipeline: ['EEG input', 'Preprocessing', 'Feature extraction', 'Transformer model', 'Text decoding', 'Speech synthesis'],
    breaks: { 2: ['EXPECTED  feature tensor [batch, bands, channels]', 'RECEIVED  raw epochs [batch, samples, channels]', 'Mismatch detected', 'MODEL EXECUTION ABORTED'] },
    why: [
      { q: 'Why a transformer over an LSTM?', alt: 'LSTM and CNN baselines', whyNot: ['Dependencies span many epochs', 'Attention maps show which channels matter'], decision: 'TRANSFORMER ENCODER' },
      { q: 'Why go through text instead of EEG straight to audio?', alt: 'Direct EEG-to-speech', whyNot: ['No paired EEG and audio at scale', 'Text can be checked between stages'], decision: 'TWO STAGES · TEXT, THEN TTS' },
    ],
    fails: [{ problem: 'Model overfit to training subjects', symptom: 'Validation accuracy plateaued while training accuracy kept rising.', investigation: 'Epochs from the same subject appeared in both splits.', solution: 'Subject-wise splits, stronger dropout, noise augmentation.', result: 'Lower but honest accuracy that held on unseen subjects.' }] },
  { id: 'mlv', name: 'Multilingual Validation', tag: 'Language detection and classification', cat: 'ai', year: '2025',
    tags: ['NLP', 'Language detection', 'Classification', 'Multilingual', 'Transformers', 'Python', 'APIs'],
    l1: 'A service that detects the language of incoming text and validates it with a per-language classifier.',
    l2: 'Text is routed through a language detector, tokenized for the detected language, and scored by a classifier. Results are returned as a validation report through an API.',
    pipeline: ['Input text', 'Language detection', 'Tokenization', 'Classifier', 'Validation report'], breaks: {},
    why: [{ q: 'Why detect language before classifying?', alt: 'One multilingual classifier', whyNot: ['Thresholds differ per language', 'Errors were hard to attribute'], decision: 'DETECT, THEN ROUTE' }],
    fails: [{ problem: 'Code-mixed sentences were misdetected', symptom: 'Hinglish inputs were routed to the English model.', investigation: 'Detector confidence dropped sharply on mixed scripts.', solution: 'Added a mixed-language class with its own fallback.', result: 'Silent misroutes dropped.' }] },
  { id: 'rag', name: 'Archive Search', tag: 'Retrieval-augmented question answering', cat: 'systems', year: '2025',
    tags: ['RAG', 'LLM', 'Embeddings', 'Vector search', 'APIs', 'MongoDB', 'Data pipelines'],
    l1: 'A question-answering system that retrieves relevant documents and answers with cited sources.',
    l2: 'Documents are chunked by structure, embedded, and stored in a vector index. A query retrieves the closest chunks, which are passed to an LLM that answers and cites them.',
    pipeline: ['Documents', 'Chunking', 'Embeddings', 'Vector store', 'Retriever', 'LLM', 'Answer'], breaks: {},
    why: [
      { q: 'Why RAG?', alt: 'Fine-tuning', whyNot: ['Dataset size', 'Update frequency', 'Inference requirements'], decision: 'RAG' },
      { q: 'Why MongoDB over MySQL?', alt: 'MySQL', whyNot: ['Document-shaped metadata', 'Schema changed often'], decision: 'MONGODB' },
    ],
    fails: [{ problem: 'Answers cited the wrong document', symptom: 'Plausible answers with incorrect sources.', investigation: 'Chunks split mid-table and lost their headers.', solution: 'Structure-aware chunking with overlap.', result: 'Citations matched sources on spot checks.' }] },
]

export const RESEARCH = [
  { id: 'R-01', title: 'Decoding imagined speech from EEG', status: 'MANUSCRIPT IN PREPARATION', rows: [
    ['QUESTION', 'Can a transformer map band-power EEG features to a small vocabulary of words?'],
    ['METHOD', 'Subject-wise splits, band-power features, transformer encoder.'],
    ['FINDING', 'Above-chance decoding on unseen subjects for a limited vocabulary.'],
  ] },
  { id: 'R-02', title: 'Subject-independent EEG features', status: 'EXPERIMENT LOG', rows: [
    ['QUESTION', 'Which features transfer across subjects without recalibration?'],
    ['METHOD', 'Compared raw, spectral and covariance features.'],
    ['FINDING', 'Spectral features transferred best in this setup.'],
  ] },
]

// The six layers of the exploded vault on the Inspect page. Each names a part of
// the real stack; keep this list true to package.json.
export const LAYERS = [
  { k: 'PROCEDURAL', v: 'Seeded PRNG · mulberry32', part: 'CORE',
    why: 'The core is coloured by your seed. The 64-bit seed is folded to 32 bits (its two halves XORed) and fed to mulberry32, which decides every variation you see.' },
  { k: 'AUDIO', v: 'Web Audio API', part: 'GASKET',
    why: 'A drone tuned from your seed, off until you turn it on. Its filter opens as the material changes from paper to film.' },
  { k: 'FRONTEND', v: 'React 19 · Vite', part: 'DOOR',
    why: 'Every screen and drawer is a React component. Vite compiles the site to static files, and the fast-access page loads no 3D code at all.' },
  { k: 'STATE', v: 'Zustand', part: 'DIAL',
    why: 'One store holds the seed, what you opened and what you seemed to care about. It is saved to this browser only and sent nowhere.' },
  { k: 'MOTION', v: 'CSS transitions', part: 'WHEEL',
    why: 'No animation library. The unlock and drawer motion are CSS transitions plus one render loop per 3D view, and reduced motion switches them off.' },
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

export const CAPS: { group: string; cat: Category; items: { id: string; name: string; title: string; projects: string[]; tech: string }[] }[] = [
  { group: 'INTELLIGENT SYSTEMS', cat: 'ai', items: [
    { id: 'rag', name: 'RAG', title: 'RAG', projects: ['rag'], tech: 'Python, embeddings, vector search' },
    { id: 'nlp', name: 'NLP', title: 'NLP', projects: ['mlv', 'neurospeak'], tech: 'Transformers, tokenizers, Python' },
    { id: 'llm', name: 'LLM APPLICATIONS', title: 'LLM applications', projects: ['rag'], tech: 'LLM APIs, prompt design' },
    { id: 'multi', name: 'MULTILINGUAL AI', title: 'Multilingual AI', projects: ['mlv'], tech: 'Language ID, PyTorch, Transformers' },
  ] },
  { group: 'BACKEND SYSTEMS', cat: 'systems', items: [
    { id: 'api', name: 'APIS', title: 'APIs', projects: ['rag', 'mlv'], tech: 'REST, Python, Node' },
    { id: 'pipe', name: 'DATA PIPELINES', title: 'Data pipelines', projects: ['neurospeak', 'rag'], tech: 'Python, batch processing' },
    { id: 'db', name: 'DATABASES', title: 'Databases', projects: ['rag'], tech: 'MongoDB, MySQL' },
  ] },
  { group: 'RESEARCH', cat: 'research', items: [
    { id: 'sig', name: 'SIGNAL PROCESSING', title: 'Signal processing', projects: ['neurospeak'], tech: 'NumPy, SciPy, MNE' },
    { id: 'eeg', name: 'EEG', title: 'EEG', projects: ['neurospeak'], tech: 'MNE, PyTorch' },
    { id: 'tf', name: 'TRANSFORMERS', title: 'Transformers', projects: ['neurospeak', 'mlv'], tech: 'PyTorch, Hugging Face' },
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
  { id: 'n1', label: 'FIRST SYSTEMS', year: '2023', x: 150, y: 300, key: 'identity', note: 'Early systems work and foundations.', view: 'identity' },
  { id: 'n2', label: 'BACKEND', year: '2023', x: 420, y: 300, key: 'p:rag', note: 'APIs, databases and data pipelines.', project: 'rag' },
  { id: 'n3', label: 'EEG', year: '2024', x: 90, y: 160, key: 'research', note: 'Signal processing research that became NeuroSpeak.', view: 'research' },
  { id: 'n4', label: 'NLP', year: '2024', x: 550, y: 160, key: 'p:mlv', note: 'Language detection and multilingual classification.', project: 'mlv' },
  { id: 'n5', label: 'AI', year: '2025', x: 320, y: 52, key: 'capabilities', note: 'Where the research and systems threads meet.', view: 'capabilities' },
  { id: 'n6', label: 'NEUROSPEAK', year: '2025', x: 320, y: 190, key: 'p:neurospeak', note: 'Research and systems in one pipeline.', project: 'neurospeak' },
]
export const EDGES: [string, string][] = [['n1', 'n2'], ['n1', 'n3'], ['n2', 'n4'], ['n3', 'n5'], ['n4', 'n5'], ['n5', 'n6'], ['n2', 'n6'], ['n3', 'n6']]

/** Things to find. Each one is a tick in the header and a line in the report. */
export const TARGETS = ['identity', 'capabilities', 'resume', 'trace', 'lab', 'research', 'p:neurospeak', 'p:mlv', 'p:rag', 'break', 'why', 'fail', 'depth3', 'query', 'inspect']

export const OBJECTIVES = [
  { id: 'hiring', label: 'UNDERSTAND THE ENGINEER', short: 'THE ENGINEER',
    desc: 'Who I am, what I have done and how to reach me. The shortest path.',
    path: [['Identity', 'identity'], ['Resume', 'resume'], ['The Lab', 'lab'], ['Transmission', 'report']] },
  { id: 'engineering', label: 'SEE THE WORK', short: 'THE WORK',
    desc: 'Systems, architecture and the decisions behind them.',
    path: [['Capabilities', 'capabilities'], ['Archive Search', 'p:rag'], ['Inspect system', 'inspect'], ['Transmission', 'report']] },
  { id: 'research', label: 'READ THE RESEARCH', short: 'THE RESEARCH',
    desc: 'Signal processing, EEG and the experiments behind NeuroSpeak.',
    path: [['Research', 'research'], ['NeuroSpeak', 'p:neurospeak'], ['Trace', 'trace'], ['Transmission', 'report']] },
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
