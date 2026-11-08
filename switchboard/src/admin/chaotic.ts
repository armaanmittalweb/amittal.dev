/**
 * Chaotic Tails' console (dash.chaotictails.com): what is not already a Game Night number elsewhere in the admin app.
 * - launchChecks: the site as Google Search and AdSense see it, checked live from outside (each check says what it
 *   found), so the launch page is a list of facts, not a to-do list someone has to remember to tick.
 * - indexNow: tells Bing, Yandex and the other IndexNow engines that every page in the sitemap changed.
 */

const SITE = 'https://chaotictails.com'
const OLD = 'https://games.amittal.dev'
const PUB = 'pub-8460310688642925'
/** IndexNow's proof of ownership: the site serves /<key>.txt (public/ in the games repo). Public by design. */
const INDEXNOW_KEY = '1ce5b55f1702ab730d44d9177f9a12e9'
const UA = 'Mozilla/5.0 (compatible; ChaoticTailsConsole/1.0; +https://chaotictails.com/about)'
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

export interface LaunchCheck { id: string; group: 'search' | 'ads' | 'site'; label: string; ok: boolean | null; detail: string }

type Fetch = typeof fetch

async function get(f: Fetch, url: string, init: RequestInit = {}) {
  const res = await f(url, { redirect: 'manual', ...init, headers: { 'user-agent': UA, ...(init.headers as Record<string, string> | undefined) }, signal: AbortSignal.timeout(8000) })
  const type = res.headers.get('content-type') ?? ''
  const text = /text|xml|json/.test(type) ? (await res.text()).slice(0, 400_000) : ''
  return { status: res.status, headers: res.headers, text }
}

const attr = (html: string, re: RegExp) => html.match(re)?.[1] ?? null

/** Every check runs at once; one that cannot reach the site says so instead of failing the rest. */
export async function launchChecks(f: Fetch = fetch, adsMode: string | null = null): Promise<{ at: number; checks: LaunchCheck[] }> {
  const at = Date.now()
  const run = async (id: string, group: LaunchCheck['group'], label: string, fn: () => Promise<[boolean | null, string]>): Promise<LaunchCheck> => {
    try { const [ok, detail] = await fn(); return { id, group, label, ok, detail } } catch (e) {
      return { id, group, label, ok: false, detail: `Could not check: ${e instanceof Error ? e.message : 'no answer'}` }
    }
  }
  const home = get(f, SITE + '/')
  const checks = await Promise.all([
    run('https', 'site', 'The site answers at chaotictails.com', async () => {
      const h = await home
      return [h.status === 200, `https://chaotictails.com/ answered ${h.status}`]
    }),
    run('csp', 'site', 'Pages carry the security policy and HSTS', async () => {
      const h = await home
      const csp = h.headers.get('content-security-policy') ?? ''
      const hsts = h.headers.get('strict-transport-security') ?? ''
      const ok = /script-src 'self'/.test(csp) && /frame-ancestors 'none'/.test(csp) && /max-age=\d{7,}/.test(hsts) && /includeSubDomains/i.test(hsts)
      return [ok, `${csp ? 'policy present' : 'NO security policy'} · ${hsts ? `HSTS: ${hsts}` : 'NO HSTS'}`]
    }),
    run('http', 'site', 'http:// goes to https://', async () => {
      const r = await get(f, 'http://chaotictails.com/games?check=1')
      const to = r.headers.get('location') ?? ''
      return [r.status >= 301 && r.status <= 308 && to.startsWith('https://chaotictails.com/'), `${r.status} → ${to || 'nowhere'}`]
    }),
    run('securitytxt', 'site', 'security.txt says how to report a problem', async () => {
      const r = await get(f, SITE + '/.well-known/security.txt')
      return [r.status === 200 && /^Contact:/m.test(r.text) && /^Expires:/m.test(r.text), r.status === 200 ? r.text.split('\n')[0] : `answered ${r.status}`]
    }),
    run('index', 'search', 'Google may index the home page', async () => {
      const h = await home
      const header = h.headers.get('x-robots-tag') ?? ''
      const meta = attr(h.text, /<meta name="robots" content="([^"]*)"/) ?? ''
      const blocked = /noindex/i.test(header + ' ' + meta)
      return [!blocked, blocked ? `Blocked: ${header || meta}` : `robots meta: ${meta || 'none'}; no noindex header`]
    }),
    run('canonical', 'search', 'Pages name chaotictails.com as their address', async () => {
      const c = attr((await home).text, /<link rel="canonical" href="([^"]+)"/)
      return [c === SITE + '/', c ? `canonical: ${c}` : 'No canonical link on the home page']
    }),
    run('robots', 'search', 'robots.txt lets search engines in and names the sitemap', async () => {
      const r = await get(f, SITE + '/robots.txt')
      const disallowAll = /^Disallow:\s*\/\s*$/m.test(r.text)
      const sitemap = r.text.match(/^Sitemap:\s*(\S+)/m)?.[1] ?? null
      return [r.status === 200 && !disallowAll && sitemap === SITE + '/sitemap.xml', `${r.status}; ${disallowAll ? 'disallows everything' : 'allows crawling'}; sitemap: ${sitemap ?? 'none'}`]
    }),
    run('sitemap', 'search', 'The sitemap lists the pages, all on chaotictails.com', async () => {
      const r = await get(f, SITE + '/sitemap.xml')
      const locs = [...r.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
      const off = locs.filter(u => !u.startsWith(SITE + '/'))
      return [r.status === 200 && locs.length > 0 && off.length === 0, `${locs.length} pages${off.length ? `; ${off.length} on another address` : ''}`]
    }),
    run('www', 'search', 'www.chaotictails.com sends people to chaotictails.com', async () => {
      const r = await get(f, 'https://www.chaotictails.com/games?check=1')
      const to = r.headers.get('location')
      return [r.status === 301 && to === SITE + '/games?check=1', `${r.status} → ${to ?? 'nowhere'}`]
    }),
    run('old', 'search', 'games.amittal.dev tells search engines the site moved', async () => {
      const r = await get(f, OLD + '/games/trivia', { headers: { 'user-agent': GOOGLEBOT } })
      const to = r.headers.get('location')
      return [r.status === 301 && to === SITE + '/games/trivia', `${r.status} → ${to ?? 'nowhere'}`]
    }),
    run('share', 'search', 'Links shared on WhatsApp show a picture and a title', async () => {
      const h = (await home).text
      const img = attr(h, /<meta property="og:image" content="([^"]+)"/)
      const title = attr(h, /<meta property="og:title" content="([^"]+)"/)
      if (!img) return [false, 'No og:image on the home page']
      const r = await f(img, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
      return [r.ok && Boolean(title), `“${title ?? 'no title'}” · image ${r.status}`]
    }),
    run('adsmeta', 'ads', 'Pages carry the AdSense publisher tag', async () => {
      const id = attr((await home).text, /<meta name="google-adsense-account" content="([^"]+)"/)
      return [id === `ca-${PUB}`, id ? `google-adsense-account: ${id}` : 'Missing']
    }),
    run('adstxt', 'ads', 'ads.txt names the publisher', async () => {
      const r = await get(f, SITE + '/ads.txt')
      const ok = r.status === 200 && r.text.includes(`google.com, ${PUB}, DIRECT, f08c47fec0942fa0`)
      return [ok, r.status === 200 ? r.text.trim().split('\n')[0] : `answered ${r.status}`]
    }),
    run('policies', 'ads', 'Privacy, terms, about and contact pages are up', async () => {
      const pages = ['/privacy', '/terms', '/about', '/contact']
      const got = await Promise.all(pages.map(p => get(f, SITE + p).then(r => [p, r.status] as const)))
      const bad = got.filter(([, s]) => s !== 200)
      return [bad.length === 0, bad.length ? bad.map(([p, s]) => `${p} ${s}`).join(', ') : 'All four answer 200']
    }),
    run('adsmode', 'ads', 'Ads stay off until AdSense approves the site', async () => [adsMode === null ? null : adsMode === 'off', adsMode === null ? 'Could not read the ads setting' : `Ads are ${adsMode}`]),
  ])
  return { at, checks }
}

/** Sends every page in the sitemap to the IndexNow engines. Returns how each answered. */
export async function indexNow(f: Fetch = fetch): Promise<{ urls: number; answers: { engine: string; status: number | string }[] }> {
  const map = await get(f, SITE + '/sitemap.xml')
  const urlList = [...map.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
  if (!urlList.length) throw new Error('The sitemap has no pages')
  const body = JSON.stringify({ host: 'chaotictails.com', key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList })
  const answers = await Promise.all(['https://api.indexnow.org/indexnow', 'https://www.bing.com/indexnow', 'https://yandex.com/indexnow'].map(async url => {
    const engine = new URL(url).hostname
    try {
      const r = await f(url, { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body, signal: AbortSignal.timeout(10_000) })
      return { engine, status: r.status }
    } catch (e) {
      return { engine, status: e instanceof Error ? e.message : 'no answer' }
    }
  }))
  return { urls: urlList.length, answers }
}
