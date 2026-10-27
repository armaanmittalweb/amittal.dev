// AdSense's own figures for the Ads tab: what Google says the site earned, by day and by ad unit. Read with the
// AdSense Management API (v2), signed in once with an OAuth refresh token kept as secrets:
//   ADSENSE_CLIENT_ID, ADSENSE_CLIENT_SECRET   an OAuth client (Google Cloud console, "Desktop app" type)
//   ADSENSE_REFRESH_TOKEN                      from signing in once with the adsense.readonly scope
//   ADSENSE_ACCOUNT                            pub-1234567890123456
// Without them the tab shows Game Night's own counts and an estimate, and says what is missing.
import type { Bindings } from '../app'

type Fetch = typeof fetch

export interface AdsenseDay { day: string; earnings: number; impressions: number; clicks: number; pageViews: number; rpm: number }
export interface AdsenseUnit { unit: string; earnings: number; impressions: number; clicks: number }
export type Adsense =
  | { connected: false; missing: string[] }
  | { connected: true; currency: string; days: AdsenseDay[]; units: AdsenseUnit[]; total: { earnings: number; impressions: number; clicks: number; pageViews: number } }
  | { connected: true; error: string }

const SECRETS = ['ADSENSE_CLIENT_ID', 'ADSENSE_CLIENT_SECRET', 'ADSENSE_REFRESH_TOKEN', 'ADSENSE_ACCOUNT'] as const

async function token(env: Bindings, f: Fetch) {
  const res = await f('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.ADSENSE_CLIENT_ID!, client_secret: env.ADSENSE_CLIENT_SECRET!, refresh_token: env.ADSENSE_REFRESH_TOKEN!, grant_type: 'refresh_token' }),
  })
  if (!res.ok) throw new Error(`Google sign-in answered ${res.status}`)
  return ((await res.json()) as { access_token: string }).access_token
}

interface Report { headers: { name: string; currencyCode?: string }[]; rows?: { cells: { value: string }[] }[] }

/** One report: `dims` rows (DATE, AD_UNIT_NAME), with the given metrics, for the days from `from` to `to` (YYYY-MM-DD). */
async function report(env: Bindings, f: Fetch, auth: string, from: string, to: string, dims: string[], metrics: string[]) {
  const [fy, fm, fd] = from.split('-'), [ty, tm, td] = to.split('-')
  const q = new URLSearchParams({
    dateRange: 'CUSTOM', 'startDate.year': fy, 'startDate.month': String(+fm), 'startDate.day': String(+fd),
    'endDate.year': ty, 'endDate.month': String(+tm), 'endDate.day': String(+td), reportingTimeZone: 'ACCOUNT_TIME_ZONE',
  })
  for (const d of dims) q.append('dimensions', d)
  for (const m of metrics) q.append('metrics', m)
  const account = env.ADSENSE_ACCOUNT!.replace(/^(accounts\/)?/, 'accounts/')
  const res = await f(`https://adsense.googleapis.com/v2/${account}/reports:generate?${q}`, { headers: { authorization: `Bearer ${auth}` } })
  if (!res.ok) throw new Error(`AdSense answered ${res.status}`)
  return (await res.json()) as Report
}

const num = (s: string | undefined) => Number(s ?? 0) || 0

/** AdSense's earnings for the days from `from` to `to`, or what is missing to read them. */
export async function adsense(env: Bindings, from: string, to: string, f: Fetch = fetch): Promise<Adsense> {
  const missing = SECRETS.filter(k => !env[k])
  if (missing.length) return { connected: false, missing: [...missing] }
  try {
    const auth = await token(env, f)
    const M = ['ESTIMATED_EARNINGS', 'IMPRESSIONS', 'CLICKS', 'PAGE_VIEWS', 'PAGE_VIEWS_RPM']
    const [byDay, byUnit] = await Promise.all([
      report(env, f, auth, from, to, ['DATE'], M),
      report(env, f, auth, from, to, ['AD_UNIT_NAME'], ['ESTIMATED_EARNINGS', 'IMPRESSIONS', 'CLICKS']),
    ])
    const currency = byDay.headers.find(h => h.currencyCode)?.currencyCode ?? ''
    const days = (byDay.rows ?? []).map(r => ({ day: r.cells[0].value, earnings: num(r.cells[1].value), impressions: num(r.cells[2].value), clicks: num(r.cells[3].value), pageViews: num(r.cells[4].value), rpm: num(r.cells[5].value) }))
    const units = (byUnit.rows ?? []).map(r => ({ unit: r.cells[0].value, earnings: num(r.cells[1].value), impressions: num(r.cells[2].value), clicks: num(r.cells[3].value) })).sort((a, b) => b.earnings - a.earnings)
    const sum = (k: 'earnings' | 'impressions' | 'clicks' | 'pageViews') => days.reduce((a, d) => a + d[k], 0)
    return { connected: true, currency, days, units, total: { earnings: sum('earnings'), impressions: sum('impressions'), clicks: sum('clicks'), pageViews: sum('pageViews') } }
  } catch (e) {
    return { connected: true, error: e instanceof Error ? e.message : 'Could not read AdSense' }
  }
}
