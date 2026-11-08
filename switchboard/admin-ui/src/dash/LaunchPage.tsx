import { useEffect, useState } from 'preact/hooks'
import { api, SignedOut, type LaunchCheck } from '../api'
import { ago } from '../format'
import type { Shared } from './Dash'
import { Card } from './pages'

// Launch: the site as Google Search and AdSense see it, checked live from outside, then the steps only you can take
// (they need your Google and Cloudflare sign-ins), in order.

const GROUPS: { id: LaunchCheck['group']; title: string; sub: string }[] = [
  { id: 'site', title: 'The site', sub: 'It answers on its new address' },
  { id: 'search', title: 'Google Search', sub: 'What Google needs to find and list every page' },
  { id: 'ads', title: 'AdSense', sub: 'What the AdSense review looks for' },
]

const STEPS: { title: string; body: string; link?: [string, string] }[] = [
  { title: 'Add chaotictails.com to Search Console', body: 'Add property › Domain › chaotictails.com. Pick “Cloudflare” when it asks how to verify: it adds the DNS record for you.', link: ['https://search.google.com/search-console/welcome', 'Open Search Console'] },
  { title: 'Submit the sitemap', body: 'In the new property: Sitemaps › add https://chaotictails.com/sitemap.xml.', link: ['https://search.google.com/search-console/sitemaps', 'Sitemaps'] },
  { title: 'Tell Google about the move', body: 'If games.amittal.dev (or amittal.dev) is in Search Console: open it › Settings › Change of address › chaotictails.com. Search Console says if the tool cannot be used for that property; the permanent redirects do the job either way.', link: ['https://search.google.com/search-console/settings', 'Settings'] },
  { title: 'Add the site to AdSense', body: 'Sites › Add site › chaotictails.com. It finds the tag on the pages and ads.txt (both checked above). Then Request review. Reviews take from a few days to a few weeks.', link: ['https://www.google.com/adsense/new/u/0/pub-8460310688642925/sites/my-sites', 'AdSense sites'] },
  { title: 'Set up the EU consent message', body: 'AdSense › Privacy & messaging › European regulations › create a message for chaotictails.com and publish it. The privacy page already promises it.', link: ['https://www.google.com/adsense/new/u/0/pub-8460310688642925/privacymessaging', 'Privacy & messaging'] },
  { title: 'When AdSense approves', body: 'Ads › set Test, open the site on a phone and look at a few screens; then set Live. Ads stay off until then.' },
  { title: 'Add the site to Bing', body: 'Bing Webmaster Tools › Import from Google Search Console. Bing also powers DuckDuckGo and ChatGPT search.', link: ['https://www.bing.com/webmasters', 'Bing Webmaster Tools'] },
  { title: 'Lock this console behind your email', body: 'Cloudflare Zero Trust › Access › Applications › Add › Self-hosted › dash.chaotictails.com › allow only your email. A one-time code to your inbox then comes before this password.', link: ['https://one.dash.cloudflare.com/', 'Cloudflare Zero Trust'] },
]

export function LaunchPage(s: Shared) {
  const [data, setData] = useState<{ at: number; checks: LaunchCheck[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Record<number, boolean>>(() => { try { return JSON.parse(localStorage.getItem('ct-dash-launch') ?? '{}') } catch { return {} } })
  const run = async () => {
    setBusy(true)
    try { setData(await api.launch()) } catch (e) { if (e instanceof SignedOut) s.signedOut(); else s.toast(e instanceof Error ? e.message : 'Could not run the checks', 'err') } finally { setBusy(false) }
  }
  useEffect(() => { void run() }, [])
  const tick = (i: number) => {
    const next = { ...done, [i]: !done[i] }
    setDone(next)
    try { localStorage.setItem('ct-dash-launch', JSON.stringify(next)) } catch { /* private mode */ }
  }
  const passed = data?.checks.filter(c => c.ok).length ?? 0
  const total = data?.checks.length ?? 0
  return (
    <div class="d-grid">
      <section class="d-card is-wide d-launch-head">
        <div><span class="d-kicker">Checked live from outside</span><h2>{data ? `${passed} of ${total} checks pass` : 'Checking…'}</h2><p>{data ? `Ran ${ago(data.at)}.` : 'Asking chaotictails.com, www and the old address.'}</p></div>
        <button type="button" class="d-btn" onClick={() => void run()} disabled={busy}>{busy ? 'Checking…' : 'Check again'}</button>
      </section>
      {GROUPS.map(gp => (
        <Card key={gp.id} title={gp.title} sub={gp.sub}>
          <ul class="d-checks">{(data?.checks ?? []).filter(c => c.group === gp.id).map(c => (
            <li key={c.id} class={c.ok === null ? 'is-idle' : c.ok ? 'is-ok' : 'is-bad'}>
              <span class="d-check-icon" aria-hidden="true">{c.ok === null ? '–' : c.ok ? '✓' : '!'}</span>
              <span><b>{c.label}</b><small>{c.ok === null ? 'Unknown' : c.ok ? 'Pass' : 'Needs a look'} · {c.detail}</small></span>
            </li>
          ))}{!data && <li class="is-idle"><span class="d-check-icon">…</span><span><b>Checking</b></span></li>}</ul>
        </Card>
      ))}
      <Card title="Your steps" sub="These need your Google and Cloudflare sign-ins. Tick them off here as you go (saved on this device)." wide>
        <ol class="d-steps">{STEPS.map((st, i) => (
          <li key={i} class={done[i] ? 'is-done' : ''}>
            <button type="button" role="checkbox" aria-checked={!!done[i]} class="d-step-box" onClick={() => tick(i)} aria-label={`Done: ${st.title}`}>{done[i] ? '✓' : i + 1}</button>
            <div><b>{st.title}</b><p>{st.body}</p>{st.link && <a href={st.link[0]} target="_blank" rel="noopener">{st.link[1]} ↗</a>}</div>
          </li>
        ))}</ol>
      </Card>
    </div>
  )
}
