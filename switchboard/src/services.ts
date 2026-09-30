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
}

export const SERVICES: Service[] = [
  { id: 'archive', name: 'amittal.dev', hosts: ['Vercel'], check: { url: 'https://www.amittal.dev/' } },
  { id: 'edusched', name: 'EduSched', hosts: ['Vercel', 'Workers', 'Neon'], check: { binding: 'EDUSCHED', path: '/api/health' } },
  { id: 'safespace', name: 'SafeSpace', hosts: ['Vercel', 'In-browser'], check: { url: 'https://safespace.amittal.dev/' } },
  { id: 'openingos', name: 'OpeningOS', hosts: ['Vercel', 'Workers', 'Neon'], check: { url: 'https://openingos.amittal.dev/' } },
  { id: 'latentbook', name: 'LatentBook', hosts: ['Vercel', 'Durable Object'], check: { url: 'https://latentbook.amittal.dev/' } },
  { id: 'farmsaathi', name: 'FarmSaathi', hosts: ['Vercel', 'HF Space', 'Atlas'], check: { url: 'https://farmsaathi.amittal.dev/' } },
]

export const liveIds = (live: string | undefined) => new Set((live ?? '').split(',').map(s => s.trim()).filter(Boolean))
