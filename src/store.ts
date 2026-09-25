import { create } from 'zustand'
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware'
import {
  EGGS, MATERIAL, PROJECTS, RESEARCH, SECRETS,
  type Category, type Secret, type View,
} from './data/content'
import { setDroneMaterial, startDrone, stopDrone } from './lib/audio'
import { isReducedMotion, type MotionPref } from './lib/motion'
import { newSeed } from './lib/seed'

export type Screen = 'entrance' | 'objective' | 'core' | 'fast'
export interface Toast { kicker?: string; code: string; title: string; body: string }
export interface QueryResult { id: string; matched: string[] }

interface Persisted {
  screen: Screen
  seed: string | null
  revoked: string | null
  objective: string
  view: View
  visited: Record<string, true>
  interest: Partial<Record<Category, number>>
  projectId: string | null
  depth: 1 | 2 | 3
  capId: string | null
  log: number
  found: boolean
  eggs: Record<string, true>
  negative: boolean
  motion: MotionPref
  /** The screen Fast Access was opened from, so leaving it goes back there. */
  fastFrom: Screen | null
}

interface Transient {
  removed: number | null
  nodeId: string | null
  openWhy: number | null
  openFail: number | null
  openRes: number | null
  layer: number
  cabHover: number | null
  menuOpen: boolean
  toast: Toast | null
  glitch: 0 | 1 | 2
  sound: boolean
  query: string
  results: QueryResult[] | null
  secret: Secret | null
  logo: number
  traceList: boolean
}

interface Actions {
  visit(key: string, cat?: Category | null, weight?: number): void
  go(view: View): void
  openProject(id: string): void
  openKey(key: string): void
  inspect(): void
  issueKey(): void
  unlocked(): void
  pickObjective(id: string): void
  goFast(): void
  leaveFast(): void
  egg(id: string): void
  note(t: Toast): void
  dismissToast(): void
  lockdown(fromLogo: boolean): void
  logoClick(): void
  toggleStage(i: number): void
  restore(): void
  setDepth(d: 1 | 2 | 3): void
  toggleWhy(i: number): void
  toggleFail(i: number): void
  toggleRes(i: number): void
  pickCap(id: string, cat: Category): void
  setNode(id: string | null): void
  setLayer(i: number): void
  setCabHover(i: number | null): void
  setQuery(q: string): void
  runQuery(): void
  findMisfiled(): void
  toggleSound(): void
  toggleMenu(): void
  toggleNegative(): void
  setMotion(m: MotionPref): void
  setTraceList(on: boolean): void
}

export type ArchiveState = Persisted & Transient & Actions

let toastTimer: ReturnType<typeof setTimeout> | undefined
let logoAt = 0
/** Logo clicks closer together than this count as pulls on the handle. */
const PULL_GAP = 800
/** Which stages of each pipeline this visitor has pulled at least once, for the demolition egg. */
const demolished: Record<string, Record<number, true>> = {}
/** The inspect glitch sequence, cancelled by any other navigation. */
let glitchTimers: ReturnType<typeof setTimeout>[] = []

const top = () => window.scrollTo(0, 0)

const STOP_WORDS = new Set(('a an and any about all are built build by can did do does for from have has how i in into involving ' +
  'is it me my of on or project projects show that the to use used using what which with work you your').split(' '))
const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
/** A query word matches a token that starts with it, or a token of 3+ letters it starts with ("llms" finds "LLM"). */
const wordMatches = (w: string, text: string) => tokens(text).some(t => t.startsWith(w) || (t.length >= 3 && w.startsWith(t)))

/** Writes to localStorage only when a persisted field changed, so hover, typing and toasts cost nothing. */
function changedOnlyStorage<S extends object>(): PersistStorage<S> {
  let last: StorageValue<S> | null = null
  const same = (a: StorageValue<S>, b: StorageValue<S>) =>
    a.version === b.version && (Object.keys(b.state) as (keyof S)[]).every(k => Object.is(a.state[k], b.state[k]))
  return {
    getItem: name => {
      try { const raw = localStorage.getItem(name); return raw ? JSON.parse(raw) : null } catch { return null }
    },
    setItem: (name, value) => {
      if (last && same(last, value)) return
      last = value
      try { localStorage.setItem(name, JSON.stringify(value)) } catch { /* storage full or blocked */ }
    },
    removeItem: name => {
      try { localStorage.removeItem(name) } catch { /* storage blocked */ }
    },
  }
}

export const useArchive = create<ArchiveState>()(persist((set, get) => {
  /** Any navigation cancels a glitch that is still on its way to the Inspect page. */
  const cancelGlitch = () => {
    glitchTimers.forEach(clearTimeout)
    glitchTimers = []
    if (get().glitch) set({ glitch: 0 })
  }

  return {
  screen: 'entrance', seed: null, revoked: null, objective: 'hiring', view: 'hub',
  visited: {}, interest: {}, projectId: null, depth: 1, capId: null, log: 0,
  found: false, eggs: {}, negative: false, motion: 'system', fastFrom: null,

  removed: null, nodeId: null, openWhy: null, openFail: null, openRes: null, layer: 0,
  cabHover: null, menuOpen: false, toast: null, glitch: 0, sound: false,
  query: '', results: null, secret: null, logo: 0, traceList: false,

  visit(key, cat, weight = 1) {
    set(s => {
      const interest = { ...s.interest }
      if (cat) interest[cat] = (interest[cat] || 0) + weight
      return { visited: { ...s.visited, [key]: true }, interest, log: s.log + 1 }
    })
  },

  go(view) {
    cancelGlitch()
    set({ screen: 'core', view, removed: null, openWhy: null, openFail: null, menuOpen: false })
    top()
    setDroneMaterial(MATERIAL[view])
    if (['identity', 'capabilities', 'trace', 'lab', 'report', 'resume', 'research'].includes(view))
      get().visit(view, view === 'research' ? 'research' : null)
  },

  openProject(id) {
    const p = PROJECTS.find(x => x.id === id)
    if (!p) return
    cancelGlitch()
    set({ screen: 'core', view: 'project', projectId: id, depth: 1, removed: null, openWhy: null, openFail: null, menuOpen: false })
    top()
    setDroneMaterial(MATERIAL.project)
    get().visit('p:' + id, p.cat, 2)
  },

  openKey(key) {
    if (key.startsWith('p:')) return get().openProject(key.slice(2))
    if (key === 'inspect') return get().inspect()
    get().go(key as View)
  },

  inspect() {
    if (glitchTimers.length) return // already on its way
    const land = () => {
      glitchTimers = []
      set({ glitch: 0, screen: 'core', view: 'inspect', menuOpen: false })
      top()
      setDroneMaterial(MATERIAL.inspect)
      get().visit('inspect', 'interface', 2)
    }
    // The inversion flash is exactly what reduced motion asks us not to do.
    if (isReducedMotion()) return land()
    set({ glitch: 1 })
    glitchTimers = [
      setTimeout(() => set({ glitch: 2 }), 140),
      setTimeout(() => set({ glitch: 1 }), 260),
      setTimeout(land, 420),
    ]
  },

  issueKey() { set({ seed: newSeed(), revoked: null }) },
  unlocked() { set({ screen: 'objective' }) },
  pickObjective(id) { cancelGlitch(); set({ objective: id, screen: 'core', view: 'hub' }); top() },
  // Fast Access is the no-frills page, so the drone stops there.
  goFast() {
    cancelGlitch()
    stopDrone()
    const from = get().screen
    set({ screen: 'fast', fastFrom: from === 'fast' ? get().fastFrom : from, menuOpen: false, sound: false })
    top()
  },
  leaveFast() {
    cancelGlitch()
    const s = get()
    set({ screen: s.seed ? (s.fastFrom && s.fastFrom !== 'fast' ? s.fastFrom : 'core') : 'entrance' })
    top()
  },

  egg(id) {
    if (get().eggs[id]) return
    const e = EGGS.find(x => x.id === id)
    if (!e) return
    set(s => ({ eggs: { ...s.eggs, [id]: true }, toast: e }))
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => set({ toast: null }), 5200)
  },

  note(t) {
    set({ toast: t })
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => set({ toast: null }), 2600)
  },

  dismissToast() {
    clearTimeout(toastTimer)
    set({ toast: null })
  },

  lockdown(fromLogo) {
    const s = get()
    cancelGlitch()
    stopDrone()
    set({
      seed: null, revoked: s.seed || s.revoked || null, logo: 0, visited: {}, interest: {}, log: 0,
      screen: 'entrance', view: 'hub', results: null, query: '', secret: null, found: false, sound: false,
      menuOpen: false, nodeId: null, capId: null, layer: 0, cabHover: null,
    })
    top()
    if (!fromLogo) return
    if (s.eggs.lockdown) get().note({ kicker: 'VAULT RESEALED', code: 'LOCK', title: 'KEY REVOKED', body: 'Your old key no longer opens this archive. Issue a new one.' })
    else get().egg('lockdown')
  },

  // The logo takes you home like any logo. Only rapid clicks count as pulls on the
  // handle: five in a row open Drawer 99, ten reseal the vault, with a warning on each pull after five.
  logoClick() {
    const now = Date.now()
    const n = (now - logoAt < PULL_GAP ? get().logo : 0) + 1
    logoAt = now
    if (n >= 10) return get().lockdown(true)
    set({ logo: n })
    if (n < 5) get().go('hub')
    else if (n === 5) { get().egg('colophon'); get().go('colophon') }
    else get().note({ kicker: 'WARNING · HANDLE', code: '0' + (10 - n), title: (10 - n) + ' MORE AND IT LOCKS', body: 'Keep pulling and the vault reseals. Your current key will stop working.' })
  },

  toggleStage(i) {
    const s = get(), proj = PROJECTS.find(p => p.id === s.projectId) || PROJECTS[0]
    if (s.removed === i) return set({ removed: null })
    const pulled: Record<number, true> = { ...demolished[proj.id], [i]: true as const }
    demolished[proj.id] = pulled
    set({ removed: i })
    get().visit('break', proj.cat)
    if (Object.keys(pulled).length === proj.pipeline.length) get().egg('demolition')
  },
  restore() { set({ removed: null }) },

  setDepth(d) {
    set({ depth: d, removed: null })
    if (d === 3) {
      const p = PROJECTS.find(x => x.id === get().projectId)
      get().visit('depth3', p?.cat)
    }
  },
  toggleWhy(i) {
    set(s => ({ openWhy: s.openWhy === i ? null : i }))
    get().visit('why', PROJECTS.find(x => x.id === get().projectId)?.cat)
  },
  toggleFail(i) {
    set(s => ({ openFail: s.openFail === i ? null : i }))
    get().visit('fail', PROJECTS.find(x => x.id === get().projectId)?.cat)
  },
  toggleRes(i) {
    set(s => ({ openRes: s.openRes === i ? null : i }))
    const r = RESEARCH[i]
    if (r) get().visit('res:' + r.id, 'research')
  },
  pickCap(id, cat) { set({ capId: id }); get().visit('cap:' + id, cat) },
  setNode(id) { set({ nodeId: id }) },
  setLayer(i) { set({ layer: i }) },
  setCabHover(i) { if (get().cabHover !== i) set({ cabHover: i }) },

  setQuery(q) { set({ query: q }) },
  runQuery() {
    const raw = get().query.trim().toLowerCase()
    if (!raw) return set({ secret: null, results: null })
    const hit = SECRETS.find(x => x.re.test(raw))
    if (hit) { set({ secret: hit, results: null }); get().egg(hit.egg || 'query'); return }
    set({ secret: null })
    // Filler like "show me projects in" is dropped; a request with nothing left finds nothing.
    const words = tokens(raw).filter(w => w.length > 1 && !STOP_WORDS.has(w))
    const results = words.length === 0 ? [] : PROJECTS.map(p => {
      const matched = p.tags.filter(t => words.some(w => wordMatches(w, t)))
      const nameHit = words.some(w => wordMatches(w, p.name) || wordMatches(w, p.l1))
      return { id: p.id, matched, score: matched.length * 2 + (nameHit ? 1 : 0) }
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).map(({ id, matched }) => ({ id, matched }))
    set({ results })
    // A keyword search is not evidence of interest in AI, so it counts toward nothing.
    get().visit('query')
  },

  findMisfiled() { set({ found: true }); get().visit('misfiled', 'interface'); get().egg('misfiled') },

  toggleSound() {
    const s = get()
    if (s.sound) { stopDrone(); set({ sound: false }); return }
    startDrone(s.seed || '0000000000000000', s.screen === 'core' ? MATERIAL[s.view] : 'paper')
    set({ sound: true })
  },
  toggleMenu() { set(s => ({ menuOpen: !s.menuOpen })) },
  toggleNegative() { set(s => ({ negative: !s.negative })) },
  setMotion(m) { set({ motion: m }) },
  setTraceList(on) { set({ traceList: on }) },
  }
}, {
  name: 'amittal-archive-v5',
  storage: changedOnlyStorage<Persisted>(),
  partialize: (s): Persisted => ({
    screen: s.screen, seed: s.seed, revoked: s.revoked, objective: s.objective, view: s.view,
    visited: s.visited, interest: s.interest, projectId: s.projectId, depth: s.depth, capId: s.capId,
    log: s.log, found: s.found, eggs: s.eggs, negative: s.negative, motion: s.motion, fastFrom: s.fastFrom,
  }),
}))
