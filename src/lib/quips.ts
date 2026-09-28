// The archivist's voice: one line of dry humour under every answer. Each pool is drawn
// like a shuffled deck, so a visitor doesn't hear the same line twice until the deck runs out.

export const QUIPS = {
  greeting: [
    'Hello. You are the first visitor today to say hi to a search box. Noted in the log.',
    'Hi. The archivist looks up from the index and nods.',
    'Hey. Small talk is free; so is the index.',
    'Namaste. The drawers are unlocked and the kettle is warm.',
    'Hello to you too. Now, what are we digging up?',
    'Greeting received with 0 ms latency.',
    'Hi. That is the easiest query I have had all day.',
    'Welcome in. Mind the cables.',
  ],
  thanks: [
    'Anytime. The archivist accepts payment in GitHub stars.',
    'You are welcome. That is what the index is for.',
    'Glad it helped. Logging this as a successful retrieval.',
    'No problem. Latency: negligible. Satisfaction: hopefully high.',
    'Happy to help. The drawers are quietly proud.',
  ],
  contact: [
    'Email is the fastest route. It even has a return address.',
    'Replies are written by a human, typos included.',
    'Carrier pigeons were considered and rejected for latency reasons.',
    'The inbox is watched more closely than the p99.',
    'Messages are read in order of arrival. No priority queue, no bribes.',
  ],
  hire: [
    'This is the query the archive was built for.',
    'The recruiter fast lane: fewer drawers, same truth.',
    'Everything below is verifiable. The references are in the commits.',
    'Priority request. The archivist sat up a little straighter.',
    'Short path, no scenic route. Everything else can wait.',
  ],
  resume: [
    'One page, trimmed like a hot loop.',
    'Fits on one page, unlike most stack traces.',
    'Available as a PDF, the resume in its natural habitat.',
    'No keyword stuffing. Just the keywords.',
  ],
  location: [
    'Remote-friendly, as long as the Wi-Fi is.',
    'Close to good chai and ambitious traffic.',
    'Latency to anywhere in the world: one email.',
    'Timezone IST, fluent in async.',
  ],
  education: [
    'Four years of engineering and several thousand lines of competitive programming.',
    'The degree is in Electronics and Computer Engineering. The minor is in talking to machines.',
    'Graduated with a working knowledge of caffeine and C++.',
    'Thapar taught the theory. The incident logs taught the rest.',
  ],
  grades: [
    'Grades are not in the archive. The projects are, and they compile.',
    'The transcript is filed elsewhere. The commit history is right here.',
  ],
  work: [
    'Currently teaching agents to cooperate. Mostly they do.',
    'Day job: multi-agent systems. Night job: this website, apparently.',
    'Production traffic, enterprise clients and a load test at 1,000 virtual users. Normal Tuesday.',
  ],
  about: [
    'Short version: engineer. Long version: open any drawer.',
    'One person, several drawers, no ghostwriters.',
    'Part engineer, part archivist of his own work.',
    'Builds agents by day and very elaborate portfolios by night.',
  ],
  skills: [
    'Languages spoken: C++, Python, Java, Go, SQL and Bash. Also English and Hindi.',
    'Each skill is cross-referenced to work that proves it. No bar charts claiming 87% Python.',
    'Strongest skill: shipping. Close second: this search box, hopefully.',
    'Skills listed only if a project can back them up in court.',
  ],
  projects: [
    'Five working drawings. None of them is a todo app.',
    'Every project here can be taken apart. Some of them fight back.',
    'Pick one. They all come with an incident log.',
    'Built, broken, fixed and written up. In that order.',
  ],
  research: [
    'Science, with the error bars left in.',
    'At least one of these is waiting on reviewers. Be kind, reviewers.',
    'Hypotheses tested, limitations admitted.',
    'Peer review is the original distributed consensus problem.',
  ],
  site: [
    'Built with React, three.js and an unreasonable amount of care.',
    'No templates were harmed. Everything here was built by hand.',
    'Yes, the sound is synthesized live. No, there are no audio files.',
    'This search box is part of the project, so ask it hard questions.',
  ],
  eggs: [
    'There are twelve. Finding them is the point; the Inspect page keeps score.',
    'The archivist can neither confirm nor deny the existence of Drawer 99.',
    'Hint: engineers check the console.',
    'Some doors open when you knock. Some open when you pull the handle five times.',
  ],
  joke: [
    'There are 10 kinds of people: those who read binary and those who ask the search box.',
    'A SQL query walks into a bar, sees two tables and asks: may I join you?',
    'I would tell you a UDP joke, but you might not get it.',
    'Why do programmers prefer dark mode? Because light attracts bugs.',
    'Knock knock. Race condition. Who is there?',
    'There are two hard problems in computer science: cache invalidation, naming things and off-by-one errors.',
    'A RAG system walks into a library and cites every book it did not read. Not this one: it cites its sources.',
    'Why did the order book leave the mutex? Too much contention.',
    'An LLM, a regex and a human walk into a bar. The regex matches the bartender.',
    'My code has no bugs, only undocumented features, filed under Known Failures.',
    'To understand recursion, first understand recursion.',
    'The cloud is just someone else\'s computer. This archive is just someone\'s computer, carefully arranged.',
  ],
  personal: [
    'That file is sealed. The archive keeps professional records only.',
    'Classified. Try asking about something that compiles.',
    'Personal questions are routed to /dev/null, politely.',
    'Nice try. The archive has privacy settings, and they are on.',
  ],
  money: [
    'Compensation is a conversation, not a search result. Email is good at conversations.',
    'The archive does not store numbers with currency symbols. Only latencies.',
  ],
  age: [
    'Old enough to have firm opinions on tabs versus spaces.',
    'Age is a private field. The commit history is public.',
  ],
  rude: [
    'The archive has been called worse by compilers.',
    'Noted. The index remains unoffended and unindexed.',
    'Strong words. Try strong queries: RAG, C++, latency.',
    'Logged with severity: meh.',
  ],
  meta: [
    'Artisanal, locally sourced search. Zero API calls were made.',
    'It is not AI. It is a very determined for-loop with a thesaurus.',
    'Runs offline, answers instantly, and never hallucinates a project.',
  ],
  empty: [
    'The index came back empty. Either a very original question or a typo.',
    'Nothing filed under that. The archivist checked twice, including the misfiled drawer.',
    'No records match. The archive is thorough, not omniscient.',
    '404 in the index, 200 in spirit. Here is the closest thing on file.',
    'Not in the drawers yet. Perhaps in a future commit.',
    'Nothing found, which is also a result. Here is what is nearby.',
    'That one is not built yet. Sounds like a good idea for the next project, though.',
  ],
  ai: [
    'Retrieval-augmented, citation-backed and hallucination-averse.',
    'Models were fine-tuned, prompts were argued with, results were logged.',
    'Every AI claim here has a pipeline you can break.',
    'Local models, real latency budgets, no magic.',
  ],
  systems: [
    'Measured in microseconds, argued about in milliseconds.',
    'Lock-free where it matters, locked down where it counts.',
    'Latency budgets were set and, mostly, respected.',
    'Transactions committed, clashes checked, nothing double-booked.',
  ],
  interface: [
    'Designed for humans, tested by Playwright.',
    'Local-first, which means it works on the train.',
    'State lives in your browser, like a good houseguest.',
  ],
  career: [
    'Real roles, real dates, no inflation.',
    'The dates are accurate. The coffee counts are not recorded.',
  ],
  found: [
    'Found it. The index earns its keep.',
    'Filed, cross-referenced and ready.',
    'Retrieved in under a millisecond. The archivist is showing off.',
    'Here is what the drawers say.',
    'Pulled from the cabinet, dusted off, handed over.',
  ],
  explorer: [
    'You came to break things. Start with a pipeline: it breaks beautifully.',
    'Pro tip: the logo is also a handle.',
    'The archive rewards curiosity. And persistence. Mostly persistence.',
  ],
} as const

export type QuipPool = keyof typeof QUIPS

const BAGS_KEY = 'archivist-decks'
let bags: Record<string, number[]> | null = null

function loadBags() {
  if (bags) return bags
  try { bags = JSON.parse(sessionStorage.getItem(BAGS_KEY) || '{}') } catch { bags = {} }
  return bags!
}

/** The next line from a pool: a shuffled deck per pool, kept for the visit. */
export function quip(pool: QuipPool) {
  const lines = QUIPS[pool], b = loadBags()
  if (!b[pool]?.length) {
    const deck = lines.map((_, i) => i)
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]] }
    b[pool] = deck
  }
  const line = lines[b[pool].pop()!]
  try { sessionStorage.setItem(BAGS_KEY, JSON.stringify(b)) } catch { /* private mode: the deck just lives in memory */ }
  return line
}
