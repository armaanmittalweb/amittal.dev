import type { Meter } from './api'

export const num = (x: number) => Math.round(x).toLocaleString('en')

export function compact(x: number) {
  if (x >= 1e6) return (x / 1e6).toFixed(x >= 1e7 ? 0 : 1) + 'M'
  if (x >= 1e4) return Math.round(x / 1e3) + 'k'
  return num(x)
}

export function bytes(b: number) {
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (b >= 1024 && i < units.length - 1) {
    b /= 1024
    i++
  }
  return `${b >= 10 || i === 0 ? Math.round(b) : b.toFixed(1)} ${units[i]}`
}

export function amount(v: number, unit: Meter['unit']) {
  if (unit === 'bytes') return bytes(v)
  if (unit === 'hours') return `${v < 10 ? v.toFixed(1) : Math.round(v)} h`
  if (unit === 'usd') return `$${v < 100 ? v.toFixed(2) : Math.round(v)}`
  return compact(v)
}

export const ratio = (m: Pick<Meter, 'used' | 'limit'>) => (m.limit > 0 ? m.used / m.limit : 0)

export function pctText(p: number) {
  if (p > 0 && p < 0.01) return '<1%'
  return `${Math.round(p * 100)}%`
}

export function level(p: number): 'ok' | 'warn' | 'critical' {
  return p >= 0.9 ? 'critical' : p >= 0.7 ? 'warn' : 'ok'
}

export function ago(ms: number, now = Date.now()) {
  const s = Math.max(0, (now - ms) / 1000)
  if (s < 45) return 'just now'
  if (s < 90) return '1 min ago'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}

export function clock(ms: number) {
  return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function shortDay(day: string) {
  return new Date(day + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function weekday(day: string) {
  return new Date(day + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
}

let regions: Intl.DisplayNames | null = null
export function countryName(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return 'Unknown'
  try {
    regions ??= new Intl.DisplayNames(['en'], { type: 'region' })
    return regions.of(code) ?? code
  } catch {
    return code
  }
}
