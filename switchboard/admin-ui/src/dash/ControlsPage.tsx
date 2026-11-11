import { useEffect, useState } from 'preact/hooks'
import { api, type SiteConfig } from '../api'
import { ago } from '../format'
import { Toggle } from './AdsPage'
import type { Shared } from './Dash'
import { Card } from './pages'

// Every switch the site has, saved straight to it (src/site.ts in the games repo; pages pick changes up within
// 30 seconds): a notice for everyone, pausing new rooms, taking a game out; and the one-off jobs.

const TONES: { value: SiteConfig['notice']['tone']; label: string }[] = [{ value: 'info', label: 'News' }, { value: 'good', label: 'Good news' }, { value: 'warn', label: 'Warning' }]
const PAUSE_DEFAULT = 'New rooms are paused for a few minutes while we fix something. Rooms already open still work.'
const HOURS = [{ v: 0, l: 'Until I remove it' }, { v: 2, l: '2 hours' }, { v: 12, l: '12 hours' }, { v: 24, l: '1 day' }, { v: 72, l: '3 days' }, { v: 168, l: '1 week' }]

export function ControlsPage(s: Shared) {
  const site = s.site
  const [notice, setNotice] = useState(site?.notice.text ?? '')
  const [tone, setTone] = useState<SiteConfig['notice']['tone']>(site?.notice.tone ?? 'info')
  const [hours, setHours] = useState(0)
  const [pauseMsg, setPauseMsg] = useState(site?.paused.message || PAUSE_DEFAULT)
  const [busy, setBusy] = useState<string | null>(null)
  const [vid, setVid] = useState('')
  useEffect(() => { if (site) { setNotice(site.notice.text); setTone(site.notice.tone); setPauseMsg(site.paused.message || PAUSE_DEFAULT) } }, [site?.updated])

  const save = async (what: string, next: Partial<SiteConfig>, done: string, ask?: string) => {
    if (ask && !confirm(ask)) return
    setBusy(what)
    try { const r = await api.setSite(next); s.setSite(r); s.toast(done) } catch (e) { s.toast(e instanceof Error ? e.message : 'Could not save', 'err') } finally { setBusy(null) }
  }
  const act = async (name: string, body: Record<string, unknown> = {}) => {
    setBusy(name)
    try { const r = await api.action(name, body); s.toast(r.message) } catch (e) { s.toast(e instanceof Error ? e.message : 'That did not work', 'err') } finally { setBusy(null) }
  }
  const forget = async (e: Event) => {
    e.preventDefault()
    if (!vid.trim() || !confirm(`Delete everything kept under ${vid.trim()}? This cannot be undone.`)) return
    setBusy('forget')
    try { const r = await api.forgetBrowser(vid.trim()); s.toast(`Deleted ${r.deleted} record${r.deleted === 1 ? '' : 's'}.`); setVid('') } catch (err) { s.toast(err instanceof Error ? err.message : 'Could not delete', 'err') } finally { setBusy(null) }
  }

  if (!site) return <div class="d-grid" aria-busy="true"><div class="d-card is-wide d-ghost" /></div>
  const names = s.games?.names ?? {}
  const ids = Object.keys(names).sort((a, b) => names[a].localeCompare(names[b]))
  const live = site.notice.text && (!site.notice.until || site.notice.until > Date.now())

  return (
    <div class="d-grid">
      <section class={`d-card is-wide d-hero-switch is-${site.paused.on ? 'paused' : 'open'}`} aria-labelledby="pause-h">
        <div>
          <span class="d-kicker">New rooms</span>
          <h2 id="pause-h">{site.paused.on ? 'New rooms are paused' : 'New rooms are open'}</h2>
          <p>{site.paused.on ? 'Hosts who try to make a room see the message below. Rooms already open carry on.' : 'Pause when something is broken, so new hosts do not start nights that would fail. Rooms already open are never touched.'}</p>
          <label class="d-field"><span>What hosts see while paused</span><textarea rows={2} maxLength={220} value={pauseMsg} onInput={e => setPauseMsg((e.target as HTMLTextAreaElement).value)} /></label>
        </div>
        <div class="d-hero-act">
          {site.paused.on
            ? <><button type="button" class="d-btn d-btn-big" disabled={!!busy} onClick={() => void save('pause', { paused: { on: false, message: pauseMsg } }, 'New rooms are open again.')}>Open new rooms</button>
              <button type="button" class="d-btn is-ghost" disabled={!!busy} onClick={() => void save('pause', { paused: { on: true, message: pauseMsg } }, 'Message updated.')}>Update the message</button></>
            : <button type="button" class="d-btn d-btn-big is-danger" disabled={!!busy} onClick={() => void save('pause', { paused: { on: true, message: pauseMsg } }, 'New rooms are paused.', 'Pause new rooms for everyone?')}>Pause new rooms</button>}
        </div>
      </section>

      <Card title="Ask to join" sub="Whether new rooms ask the host before letting someone in" id="ask">
        <div class="d-toggle-row">
          <div>
            <b>{site.askToJoin ? 'New rooms ask the host first' : 'Anyone with the link joins straight away'}</b>
            <p class="d-fine">{site.askToJoin
              ? 'Someone new waits at the door until the host taps Let in (or Let everyone in). Hosts can still switch it off in their own room.'
              : 'Off by default. Hosts can still switch it on in their own room, under Room settings.'}</p>
          </div>
          <Toggle on={!!site.askToJoin} label="New rooms ask the host before letting someone in" disabled={!!busy}
            onChange={v => void save('ask', { askToJoin: v }, v ? 'New rooms now ask the host before letting someone in.' : 'New rooms let people in straight away again.')} />
        </div>
        <p class="d-fine">Only rooms made from now on. Rooms already open keep what they have.</p>
      </Card>

      <Card title="Notice" sub="One line at the top of the home page and every lobby. Players can close it." id="notice">
        <form class="d-form" onSubmit={e => { e.preventDefault(); void save('notice', { notice: { text: notice.trim(), tone, until: hours ? Date.now() + hours * 3_600_000 : null } }, notice.trim() ? 'The notice is up. Pages show it within 30 seconds.' : 'The notice is gone.') }}>
          <label class="d-field"><span>Message</span><textarea rows={3} maxLength={220} placeholder="e.g. New: 500 Bollywood questions in Trivia tonight!" value={notice} onInput={e => setNotice((e.target as HTMLTextAreaElement).value)} /><small>{notice.length}/220</small></label>
          <div class="d-row">
            <div class="d-seg" role="radiogroup" aria-label="Kind">{TONES.map(t => <button key={t.value} type="button" role="radio" aria-checked={tone === t.value} class={tone === t.value ? 'is-on' : ''} onClick={() => setTone(t.value)}>{t.label}</button>)}</div>
            <label class="d-field is-inline"><span>Show for</span><select value={hours} onChange={e => setHours(Number((e.target as HTMLSelectElement).value))}>{HOURS.map(h => <option key={h.v} value={h.v}>{h.l}</option>)}</select></label>
          </div>
          {notice.trim() && <div class={`d-preview site-${tone}`} aria-label="Preview">{notice.trim()}</div>}
          <div class="d-row">
            <button type="submit" class="d-btn" disabled={!!busy}>{notice.trim() ? 'Put it up' : 'Save'}</button>
            {live && <button type="button" class="d-btn is-ghost" disabled={!!busy} onClick={() => { setNotice(''); void save('notice', { notice: { text: '', tone, until: null } }, 'The notice is gone.') }}>Take it down</button>}
          </div>
          <p class="d-fine">{live ? `Showing now${site.notice.until ? `, until ${new Date(site.notice.until).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}.` : 'No notice showing.'}</p>
        </form>
      </Card>

      <Card title="Games" sub="Switch a game off to take it out of every list. Rooms cannot start it until it is back on." id="games">
        {ids.length ? (
          <ul class="d-toggles is-cols">{ids.map(id => {
            const on = !site.gamesOff.includes(id)
            return <li key={id}><span>{names[id]}</span><Toggle on={on} label={names[id]} disabled={!!busy} onChange={v => void save('games', { gamesOff: v ? site.gamesOff.filter(x => x !== id) : [...site.gamesOff, id] }, v ? `${names[id]} is back.` : `${names[id]} is out for now.`)} /></li>
          })}</ul>
        ) : <p class="d-empty">Loading the game list…</p>}
      </Card>

      <Card title="Search engines" sub="Tell Bing, Yandex and the other IndexNow engines that the pages changed, so they look again now">
        <button type="button" class="d-btn" disabled={!!busy} onClick={() => void act('indexnow')}>{busy === 'indexnow' ? 'Sending…' : 'Send every page'}</button>
        <p class="d-fine">Google does not use IndexNow; it reads the sitemap (see Launch). Use this after a change to many pages, not every day.</p>
      </Card>

      <Card title="Check the site now" sub="Runs the uptime check straight away instead of waiting for the next one (every 5 minutes)">
        <button type="button" class="d-btn" disabled={!!busy} onClick={() => void act('check-now')}>{busy === 'check-now' ? 'Checking…' : 'Check now'}</button>
      </Card>

      <Card title="Delete a person's data" sub="When someone asks through the contact page. They find their browser id on the privacy page.">
        <form class="d-form" onSubmit={forget}>
          <label class="d-field"><span>Browser id</span><input value={vid} placeholder="6 to 40 letters and digits" onInput={e => setVid((e.target as HTMLInputElement).value)} /></label>
          <button type="submit" class="d-btn is-danger" disabled={!!busy || !vid.trim()}>Delete</button>
        </form>
      </Card>
      <p class="d-fine is-wide">Switches last changed {site.updated ? ago(site.updated) : 'never'}.</p>
    </div>
  )
}
