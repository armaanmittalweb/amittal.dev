// The Lab's teletype: a small shell over the archive. Its filesystem is generated from
// content.ts, so everything it prints is something the site already says, and its
// commands drive the same store actions as the buttons (pull a stage, open a drawer).
import { CABINET, EGGS, LINKS, OBJECTIVES, PROJECTS, TARGETS, type Project, type View } from '../data/content'
import { useArchive } from '../store'
import { pipelineStatus } from './pipeline'

export type Ink = 'cmd' | 'dim' | 'acc' | 'err'
export interface Line { t: string; k?: Ink }
export interface Result { lines: Line[]; clear?: boolean; close?: boolean; cwd?: string | null }

export const FILES = ['README', 'pipeline', 'decisions', 'incidents', 'stack'] as const
const DRAWERS = [...CABINET.map(c => c[2]), 'inspect'] as const

/** [name, usage, what it does]: help, man and tab completion all read this. */
export const COMMANDS: [string, string, string][] = [
  ['help', 'help', 'List the commands'],
  ['ls', 'ls [-l] [drawing]', 'List the Lab, or the files of one drawing'],
  ['cd', 'cd <drawing> | cd ..', 'Step into a drawing, or back out to /lab'],
  ['pwd', 'pwd', 'Print where you are'],
  ['tree', 'tree', 'The whole Lab at once'],
  ['cat', 'cat <file>', 'Print README, pipeline, decisions, incidents or stack'],
  ['open', 'open [drawing|drawer]', 'Move the archive to a drawing, or to a drawer like resume'],
  ['pipeline', 'pipeline', 'Draw this drawing’s pipeline'],
  ['pull', 'pull <n>', 'Pull stage n out of the open drawing and watch it fail'],
  ['refit', 'refit', 'Put every stage back'],
  ['why', 'why', 'The engineering decisions'],
  ['incidents', 'incidents', 'The incident log'],
  ['git', 'git log', 'The latest commits of this drawing, from GitHub'],
  ['ask', 'ask <question>', 'Ask the archive, like the request form on the Core'],
  ['whoami', 'whoami', 'Your seed, objective and records'],
  ['hire', 'hire', 'How to reach me'],
  ['sound', 'sound on|off', 'Switch the archive’s sound'],
  ['history', 'history', 'The commands you have run'],
  ['man', 'man <command>', 'How one command works'],
  ['clear', 'clear', 'Tear off the printed paper'],
  ['exit', 'exit', 'Close the teletype'],
]
const NAMES = COMMANDS.map(c => c[0])

const S = useArchive.getState
const find = (id: string | null) => PROJECTS.find(p => p.id === id) ?? null
const say = (t: string, k?: Ink): Line => ({ t, k })
const out = (...lines: Line[]): Result => ({ lines })
const err = (t: string, hint?: string): Result => out(say(t, 'err'), ...(hint ? [say(hint, 'dim')] : []))

export const promptFor = (cwd: string | null) => (cwd ? 'lab/' + cwd : 'lab') + ' $'

/** A path as typed (`fieldnotes`, `../loomcore`, `/lab/x`, `..`, `~`) to a drawing id, null for /lab, or undefined if it isn't there. */
function resolve(arg: string, cwd: string | null): string | null | undefined {
  let p = arg.trim().toLowerCase().replace(/\/+$/, '')
  if (p === '' || p === '~' || p === '/' || p === '/lab' || p === 'lab') return null
  if (p === '..') return null
  if (p === '.') return cwd
  p = p.replace(/^(\.\.\/)+/, '').replace(/^\/?lab\//, '')
  const hit = PROJECTS.find(x => x.id === p || x.name.toLowerCase() === p)
  return hit ? hit.id : undefined
}

function lev(a: string, b: string) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => [i, ...Array(a.length).fill(0)])
  for (let j = 1; j <= a.length; j++) d[0][j] = j
  for (let i = 1; i <= b.length; i++) for (let j = 1; j <= a.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1))
  return d[b.length][a.length]
}

/* ---------- files ---------- */

function readme(p: Project | null): Line[] {
  if (!p) return [
    say('THE LAB · ' + PROJECTS.length + ' WORKING DRAWINGS', 'acc'),
    say('Each directory is a project. cd into one to read its files, open it to see the drawing.'),
    say('Try: cd ' + PROJECTS[0].id + ', then cat README.', 'dim'),
  ]
  return [say(p.name.toUpperCase() + ' · ' + p.tag, 'acc'), say(p.l1), say(''), say(p.l2, 'dim')]
}

function pipeline(p: Project): Line[] {
  const s = S(), live = s.view === 'project' && s.projectId === p.id ? s.removed : null
  const status = pipelineStatus(p, live)
  return [
    ...p.pipeline.map((name, i) => say(
      (i === 0 ? '┌ ' : i === p.pipeline.length - 1 ? '└ ' : '├ ') + 'S' + String(i + 1).padStart(2, '0') + '  ' + name.toUpperCase() + (live === i ? '   ✕ PULLED' : ''),
      live === i ? 'err' : live !== null && i > live ? 'dim' : undefined)),
    say(''),
    say(status.head, status.ok ? 'acc' : 'err'),
    ...status.lines.map(l => say('  ' + l, status.ok ? undefined : 'dim')),
  ]
}

function decisions(p: Project): Line[] {
  S().visit('why', p.cat)
  return p.why.flatMap((w, i) => [
    say((i + 1) + '. ' + w.q),
    say('   instead of  ' + w.alt, 'dim'),
    ...w.whyNot.map(x => say('   why not     ' + x, 'dim')),
    say('   decision    ' + w.decision, 'acc'),
  ])
}

function incidents(p: Project): Line[] {
  if (!p.fails.length) return [say(p.sourceNote ? 'The incident log is filed with the private source.' : 'No incidents filed.', 'dim')]
  S().visit('fail', p.cat)
  return p.fails.flatMap((f, i) => [
    say('INCIDENT ' + String(i + 1).padStart(2, '0') + ' · ' + f.problem.toUpperCase(), 'acc'),
    say('  symptom        ' + f.symptom),
    say('  investigation  ' + f.investigation, 'dim'),
    say('  solution       ' + f.solution),
    say('  result         ' + f.result, f.result.startsWith('Open') ? 'err' : undefined),
  ])
}

function stack(p: Project): Line[] {
  return [
    say(p.tags.join(' · ')),
    say(p.repo ? 'source  ' + p.repo : p.sourceNote ? p.sourceNote.toLowerCase() : 'source  not public', 'dim'),
    ...(p.live ? [say('live    ' + p.live, 'dim')] : []),
  ]
}

function cat(file: string, p: Project | null): Result {
  const f = file.toLowerCase().replace(/\.(md|txt)$/, '')
  if (f === 'readme') return out(...readme(p))
  if (!p) return err('cat: ' + file + ': no such file in /lab', 'The Lab itself only has a README. cd into a drawing for the rest.')
  if (f === 'pipeline') return out(...pipeline(p))
  if (f === 'decisions') return out(...decisions(p))
  if (f === 'incidents') return out(...incidents(p))
  if (f === 'stack') return out(...stack(p))
  return err('cat: ' + (file || '(nothing)') + ': no such file', 'Files here: ' + FILES.join('  '))
}

/* ---------- git ---------- */

const gitCache = new Map<string, Line[]>()

async function gitLog(p: Project | null): Promise<Result> {
  const url = p ? p.repo : 'https://github.com/armaanmittalweb/amittal.dev'
  if (!url) return err('git: ' + (p?.sourceNote ? 'this source lives in a private repository.' : 'no public repository.'))
  const repo = url.match(/github\.com\/([^/]+\/[^/#?]+)/)?.[1]
  if (!repo) return err('git: not a GitHub repository.')
  const cached = gitCache.get(repo)
  if (cached) return out(...cached)
  try {
    const res = await fetch('https://api.github.com/repos/' + repo + '/commits?per_page=6', { headers: { Accept: 'application/vnd.github+json' } })
    if (!res.ok) return err('git: GitHub answered ' + res.status + (res.status === 403 ? ' (rate limited, try again in a while).' : '.'))
    const list = await res.json() as { sha: string; commit: { message: string; author: { date: string } } }[]
    const lines = [
      say(repo, 'dim'),
      ...list.map(c => say(c.sha.slice(0, 7) + '  ' + c.commit.author.date.slice(0, 10) + '  ' + c.commit.message.split('\n')[0])),
    ]
    gitCache.set(repo, lines)
    return out(...lines)
  } catch {
    return err('git: GitHub could not be reached.')
  }
}

/* ---------- the shell ---------- */

/** Runs one command line. `cwd` is a drawing id, or null for /lab. */
export async function run(input: string, cwd: string | null, history: string[]): Promise<Result> {
  const line = input.trim()
  if (!line) return out()
  const [cmd0, ...args] = line.split(/\s+/)
  const cmd = cmd0.toLowerCase(), arg = args.join(' ')
  const here = find(cwd)
  const s = S()

  // Things people try in any terminal.
  if (cmd === 'rm' && /(^|\s)-\w*r\w*f|\s\/(\s|$)|^\/$|\*/.test(' ' + arg)) {
    s.egg('fireproof')
    return err("rm: cannot remove '/': the archive is fireproof.")
  }
  if ([':q', ':q!', ':wq', 'exit', 'logout', 'quit'].includes(cmd)) return { lines: [], close: true }
  if (cmd === 'sudo') { s.egg('sudo'); return out(say('NO ROOT', 'acc'), say('This archive has no root user. Nice try.')) }
  if (cmd === 'ssh') return err('ssh: connect to host amittal.dev port 22: Connection refused.', 'The front door is email. Type hire.')
  if (['vim', 'vi', 'nano', 'emacs'].includes(cmd)) return err(cmd + ': this teletype has no screen to edit on. It only prints.')
  if (cmd === 'make' && /coffee|tea|chai/.test(arg)) return run('ask ' + arg, cwd, history)
  if (cmd === 'echo') return out(say(arg))

  switch (cmd) {
    case 'help':
      return out(...COMMANDS.map(([, usage, what]) => say(usage.padEnd(24) + what)), say(''), say('Tab completes. ↑ and ↓ walk your history. ` or Esc closes.', 'dim'))
    case 'man': {
      const c = COMMANDS.find(x => x[0] === arg.toLowerCase())
      return c ? out(say(c[1], 'acc'), say(c[2])) : err('man: ' + (arg ? 'no entry for ' + arg : 'which command?'), 'Type help for the list.')
    }
    case 'pwd': return out(say(cwd ? '/lab/' + cwd : '/lab'))
    case 'ls': {
      // Like ls: names only; -l for the long form.
      const long = args.includes('-l') || args.includes('-la') || args.includes('-al')
      const path = args.filter(a => !a.startsWith('-')).join(' ')
      const target = path ? resolve(path, cwd) : cwd
      if (target === undefined) return err('ls: ' + path + ': no such drawing')
      if (target === null) return long
        ? out(...PROJECTS.flatMap(p => [say(p.id + '  ' + p.year + (p.live ? '  live' : p.repo ? '' : '  private')), say('  ' + p.tag, 'dim')]), say('README', 'dim'))
        : out(say(['README', ...PROJECTS.map(p => p.id)].join('   ')))
      return out(say(FILES.join('   ')))
    }
    case 'tree':
      return out(say('/lab'), ...PROJECTS.flatMap((p, i) => {
        const last = i === PROJECTS.length - 1
        return [say((last ? '└── ' : '├── ') + p.id), ...FILES.map((f, j) => say((last ? '    ' : '│   ') + (j === FILES.length - 1 ? '└── ' : '├── ') + f, 'dim'))]
      }))
    case 'cd': {
      const target = resolve(arg, cwd)
      if (target === undefined) return err('cd: ' + arg + ': no such drawing', 'ls shows what is here.')
      return { lines: [], cwd: target }
    }
    case 'cat':
      return cat(arg, here)
    case 'pipeline':
      return here ? out(...pipeline(here)) : err('pipeline: step into a drawing first.', 'cd ' + PROJECTS[0].id)
    case 'why':
      return here ? out(...decisions(here)) : err('why: step into a drawing first.')
    case 'incidents':
      return here ? out(...incidents(here)) : err('incidents: step into a drawing first.')
    case 'pull': {
      if (!here) return err('pull: step into a drawing first.')
      if (!(s.view === 'project' && s.projectId === here.id)) return err('pull: open the drawing first, so you can watch it break.', 'Type open, then pull ' + (arg || '1') + '.')
      const n = Number(arg)
      if (!Number.isInteger(n) || n < 1 || n > here.pipeline.length) return err('pull: give a stage number from 1 to ' + here.pipeline.length + '.')
      if (s.removed !== n - 1) s.toggleStage(n - 1)
      return out(...pipeline(here))
    }
    case 'refit':
      if (s.removed === null) return out(say('Nothing is pulled.', 'dim'))
      s.restore()
      return out(say('Every stage is back in its seat.', 'acc'))
    case 'open': {
      const key = arg.toLowerCase()
      if (!key) {
        if (here) { s.openProject(here.id); return out(say('Opening ' + here.name + '.', 'dim')) }
        s.go('lab'); return out(say('Opening the Lab.', 'dim'))
      }
      const target = resolve(key, cwd)
      if (target) { s.openProject(target); return out(say('Opening ' + find(target)!.name + '.', 'dim')) }
      const drawer = (DRAWERS as readonly string[]).find(d => d === key || d.startsWith(key))
      if (drawer === 'inspect') { s.inspect(); return out(say('Opening the system.', 'dim')) }
      if (drawer) { s.go(drawer as View); return out(say('Opening ' + drawer + '.', 'dim')) }
      return err('open: nothing called ' + arg + '.', 'Drawings: ' + PROJECTS.map(p => p.id).join(', ') + '. Drawers: ' + DRAWERS.join(', ') + '.')
    }
    case 'git':
      return args[0] === 'log' ? gitLog(here) : err('git: only git log is wired up here.')
    case 'ask': {
      if (!arg) return err('ask: ask something, like: ask c++ latency')
      const { ask } = await import('./search')
      const a = ask(arg, s.objective as Parameters<typeof ask>[1])
      s.visit('query')
      if (a.egg) s.egg(a.egg)
      return out(say(a.heard, 'dim'), say(a.line), ...a.cards.slice(0, 4).map(c => say('  · ' + c.title + '  ' + c.tag.toLowerCase(), 'dim')))
    }
    case 'whoami': {
      const o = OBJECTIVES.find(x => x.id === s.objective) || OBJECTIVES[0], seed = s.seed || '0000000000000000'
      return out(
        say('visitor   seed ' + seed.match(/.{4}/g)!.join(' ')),
        say('objective ' + o.label.toLowerCase()),
        say('records   ' + TARGETS.filter(t => s.visited[t]).length + ' of ' + TARGETS.length + ' recovered'),
        say('eggs      ' + Object.keys(s.eggs).length + ' of ' + EGGS.length + ' found', 'dim'),
      )
    }
    case 'hire':
      return out(say(LINKS.email, 'acc'), say(LINKS.linkedin.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '') + ' · ' + LINKS.githubLabel, 'dim'))
    case 'sound': {
      const want = arg.toLowerCase()
      if (want !== 'on' && want !== 'off') return out(say('sound is ' + (s.sound ? 'on' : 'off') + '. Type sound on or sound off.', 'dim'))
      if ((want === 'on') !== s.sound) s.toggleSound()
      return out(say('Sound ' + want + '.', 'dim'))
    }
    case 'history':
      return out(...history.map((h, i) => say(String(i + 1).padStart(3) + '  ' + h, 'dim')))
    case 'clear':
      return { lines: [], clear: true }
  }

  const near = NAMES.map(n => [n, lev(cmd, n)] as const).sort((a, b) => a[1] - b[1])[0]
  return err('command not found: ' + cmd, near && near[1] <= 2 ? 'Did you mean ' + near[0] + '?' : 'Type help for the list.')
}

/** Candidates for the word being typed: commands first, then drawings or files depending on the command. */
export function complete(input: string, cwd: string | null): string[] {
  const parts = input.split(' ')
  const last = parts[parts.length - 1].toLowerCase()
  const pool = parts.length === 1 ? NAMES
    : ['cd', 'ls', 'open'].includes(parts[0]) ? [...PROJECTS.map(p => p.id), ...(parts[0] === 'open' ? DRAWERS : []), ...(parts[0] === 'cd' && cwd ? ['..'] : [])]
      : parts[0] === 'cat' ? [...(cwd ? FILES : ['README'])]
        : parts[0] === 'man' ? NAMES
          : parts[0] === 'git' ? ['log']
            : parts[0] === 'sound' ? ['on', 'off'] : []
  return pool.filter(c => c.toLowerCase().startsWith(last))
}
