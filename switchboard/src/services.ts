// Everything the Lab watches. A service is only checked once its id is listed in the LIVE
// var (wrangler.jsonc); until then it is reported as planned, never as down.

export type Check =
  | { url: string }
  /** A Worker reached through a service binding, so the check never leaves Cloudflare. */
  | { binding: 'EDUSCHED'; path: string }

export interface Service {
  id: string
  name: string
  /** Where it runs, as the Lab's status strip prints it. */
  hosts: string[]
  check: Check
  /** The site's public address: where visitors land and where its page-view beacon comes from. */
  origin: string
}

// Checks must not touch a database: a Neon compute that is queried every 5 minutes never scales to zero
// and would use up the free plan's compute hours. EduSched's /api/test answers without the database.
export const SERVICES: Service[] = [
  { id: 'archive', name: 'amittal.dev', hosts: ['Vercel'], check: { url: 'https://www.amittal.dev/' }, origin: 'https://www.amittal.dev' },
  { id: 'edusched', name: 'EduSched', hosts: ['Vercel', 'Workers', 'Neon'], check: { binding: 'EDUSCHED', path: '/api/test' }, origin: 'https://edusched.amittal.dev' },
  { id: 'safespace', name: 'SafeSpace', hosts: ['Vercel', 'Workers', 'D1'], check: { url: 'https://safespace.amittal.dev/' }, origin: 'https://safespace.amittal.dev' },
  { id: 'openingos', name: 'OpeningOS', hosts: ['Vercel', 'Workers', 'Neon'], check: { url: 'https://openingos.amittal.dev/' }, origin: 'https://openingos.amittal.dev' },
  { id: 'loomcore', name: 'Loomcore', hosts: ['Vercel', 'Workers', 'Modal'], check: { url: 'https://loomcore.amittal.dev/' }, origin: 'https://loomcore.amittal.dev' },
  { id: 'farmsaathi', name: 'FarmSaathi', hosts: ['Vercel', 'Workers', 'D1', 'Modal'], check: { url: 'https://farmsaathi.amittal.dev/' }, origin: 'https://farmsaathi.amittal.dev' },
  // The page is a static asset, so the check never wakes a room.
  { id: 'games', name: 'Game Night', hosts: ['Workers', 'Durable Objects'], check: { url: 'https://games.amittal.dev/' }, origin: 'https://games.amittal.dev' },
]

export const liveIds = (live: string | undefined) => new Set((live ?? '').split(',').map(s => s.trim()).filter(Boolean))
