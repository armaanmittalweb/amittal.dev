import { useRef } from 'preact/hooks'
import type { Btn, Msg } from '../api'

// The editor for every message the console writes to Chaotic Tails: the home page notice, the pause message, a message
// to one room or every room, and a custom room's note. Plain text as before, or HTML with a toolbar, plus up to four
// buttons. The preview is cleaned here the same way the site cleans it (the games repo's src/rich.ts is what counts:
// the site cleans everything again before anyone sees it).

const BTN_MAX = 4
const HTML_MAX = 3000
/** Ready-made buttons: the places people are usually sent. */
const PRESETS: Btn[] = [
  { label: 'Play chess games', href: '/chess', style: 'main' },
  { label: 'All games', href: '/games', style: 'soft' },
  { label: "Today's daily", href: '/daily', style: 'soft' },
  { label: 'Follow on Instagram', href: 'https://www.instagram.com/chaotic_tails/', style: 'soft' },
]
/** The toolbar: what each button wraps the selected words in. */
const TOOLS: { label: string; title: string; open: string; close: string }[] = [
  { label: 'B', title: 'Bold', open: '<b>', close: '</b>' },
  { label: 'I', title: 'Italic', open: '<i>', close: '</i>' },
  { label: 'Link', title: 'A link (https://… or a page here like /chess)', open: '<a href="/chess">', close: '</a>' },
  { label: 'Big', title: 'Bigger words', open: '<span class="rt-big">', close: '</span>' },
  { label: 'Accent', title: "The page's accent colour", open: '<span class="rt-accent">', close: '</span>' },
  { label: 'Gold', title: 'Gold words', open: '<span class="rt-gold">', close: '</span>' },
  { label: 'Chip', title: 'A small pill, like a tag', open: '<span class="rt-chip">', close: '</span>' },
  { label: 'Colour', title: 'Any colour', open: '<span style="color: #e2bf72">', close: '</span>' },
  { label: 'New line', title: 'A line break', open: '<br>', close: '' },
  { label: 'Picture', title: 'A picture from an https link', open: '<img src="https://" alt="" width="320">', close: '' },
]

// The same rules as the site (src/rich.ts), for the preview.
const TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'small', 'mark', 'code', 'br', 'p', 'span', 'a', 'ul', 'ol', 'li', 'h3', 'h4', 'img', 'div', 'hr', 'sup', 'sub'])
const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math', 'form', 'textarea', 'select', 'button', 'input', 'video', 'audio', 'link', 'meta', 'base'])
const CLASSES = new Set(['rt-big', 'rt-small', 'rt-muted', 'rt-accent', 'rt-center', 'rt-chip', 'rt-gold', 'rt-green', 'rt-red'])
const STYLES = new Set(['color', 'background', 'background-color', 'font-weight', 'font-style', 'font-size', 'text-align', 'text-decoration', 'border-radius', 'padding', 'margin', 'letter-spacing', 'text-transform', 'display', 'max-width', 'width', 'height'])
export function safeHref(s: string): string | null {
  const v = s.replace(/[\u0000- \u007f]/g, '').trim()
  if (/^https?:\/\/[^\s/$.?#][^\s]*$/i.test(v) || /^mailto:[^\s@]+@[^\s@]+$/i.test(v) || /^\/(?!\/)[\w\-./?=&#%~+]*$/.test(v) || /^#[\w-]{1,60}$/.test(v)) return v
  return null
}
function cleanNode(n: Node, out: Node) {
  for (const c of [...n.childNodes]) {
    if (c.nodeType === 3) { out.appendChild(document.createTextNode(c.textContent ?? '')); continue }
    if (c.nodeType !== 1) continue
    const el = c as Element, tag = el.tagName.toLowerCase()
    if (DROP.has(tag)) continue
    if (!TAGS.has(tag)) { cleanNode(el, out); continue }
    const copy = document.createElement(tag)
    for (const a of [...el.attributes]) {
      const k = a.name.toLowerCase(), v = a.value
      if (k === 'class') { const cl = v.split(/\s+/).filter(x => CLASSES.has(x)); if (cl.length) copy.setAttribute('class', cl.join(' ')) }
      else if (k === 'style') {
        const st = v.split(';').map(d => d.split(':')).filter(([p, val]) => p && val && STYLES.has(p.trim().toLowerCase()) && /^[#a-z0-9 .,%()\-+]{1,80}$/i.test(val.trim()) && !/url\s*\(|expression|javascript/i.test(val)).map(([p, val]) => `${p.trim()}: ${val.trim()}`).join('; ')
        if (st) copy.setAttribute('style', st)
      } else if (tag === 'a' && k === 'href') { const h = safeHref(v); if (h) copy.setAttribute('href', h) }
      else if (tag === 'a' && k === 'title') copy.setAttribute('title', v)
      else if (tag === 'img' && k === 'src') { if (/^https:\/\/[^\s"'<>]+$/i.test(v.trim())) copy.setAttribute('src', v.trim()) }
      else if (tag === 'img' && (k === 'alt' || ((k === 'width' || k === 'height') && /^\d{1,4}$/.test(v)))) copy.setAttribute(k, v)
    }
    if (tag === 'img' && !copy.getAttribute('src')) continue
    if (tag === 'a') copy.setAttribute('target', '_blank')
    cleanNode(el, copy)
    out.appendChild(copy)
  }
}
/** HTML as the site will show it. */
export function previewHtml(raw: string): string {
  const doc = new DOMParser().parseFromString(`<body>${raw}</body>`, 'text/html')
  const box = document.createElement('div')
  cleanNode(doc.body, box)
  return box.innerHTML
}

/** A message as the site shows it: for the previews here. */
export function MsgPreview({ msg, tone }: { msg: Msg; tone?: string }) {
  if (!msg.text.trim() && !msg.buttons?.length) return null
  return (
    <div class={`d-preview site-${tone ?? 'info'}`} aria-label="Preview">
      {msg.html ? <span class="rt" dangerouslySetInnerHTML={{ __html: previewHtml(msg.text) }} /> : <span>{msg.text}</span>}
      {!!msg.buttons?.length && <span class="rt-btns">{msg.buttons.map((b, i) => <span key={i} class={`rt-btn is-${b.style}`} title={b.href}>{b.label || 'Button'}</span>)}</span>}
    </div>
  )
}

interface Props { value: Msg; onChange: (m: Msg) => void; max?: number; rows?: number; label?: string; placeholder?: string; tone?: string; preview?: boolean }

export function MessageEditor({ value, onChange, max = 220, rows = 3, label = 'Message', placeholder, tone, preview = true }: Props) {
  const box = useRef<HTMLTextAreaElement>(null)
  const html = !!value.html
  const buttons = value.buttons ?? []
  const set = (m: Partial<Msg>) => onChange({ ...value, ...m })
  const wrap = (open: string, close: string) => {
    const el = box.current
    const t = value.text, a = el?.selectionStart ?? t.length, b = el?.selectionEnd ?? t.length
    const next = t.slice(0, a) + open + t.slice(a, b) + close + t.slice(b)
    set({ text: next })
    requestAnimationFrame(() => { if (el) { el.focus(); const at = a + open.length + (b - a); el.setSelectionRange(close ? a + open.length : at, close ? at : at) } })
  }
  const setBtn = (i: number, b: Partial<Btn>) => set({ buttons: buttons.map((x, j) => (j === i ? { ...x, ...b } : x)) })
  const limit = html ? HTML_MAX : max
  const badLinks = buttons.filter(b => b.href && !safeHref(b.href))
  return (
    <div class="d-msged">
      <div class="d-row d-msged-head">
        <span class="d-msged-label">{label}</span>
        <div class="d-seg" role="radiogroup" aria-label="Kind of message">
          <button type="button" role="radio" aria-checked={!html} class={!html ? 'is-on' : ''} onClick={() => set({ html: false })}>Plain text</button>
          <button type="button" role="radio" aria-checked={html} class={html ? 'is-on' : ''} onClick={() => set({ html: true })}>HTML</button>
        </div>
      </div>
      {html && (
        <div class="d-msged-tools" role="toolbar" aria-label="Insert">
          {TOOLS.map(t => <button key={t.label} type="button" class="d-btn is-ghost is-sm" title={t.title} onClick={() => wrap(t.open, t.close)}>{t.label}</button>)}
        </div>
      )}
      <label class="d-field">
        <textarea ref={box} rows={html ? Math.max(rows, 4) : rows} maxLength={limit} placeholder={placeholder} value={value.text} spellcheck={!html} class={html ? 'is-code' : ''}
          onInput={e => set({ text: (e.target as HTMLTextAreaElement).value })} aria-label={label} />
        <small>{value.text.length}/{limit}{html ? ' · scripts, forms and javascript: links are removed' : ''}</small>
      </label>
      <div class="d-msged-btns">
        {buttons.map((b, i) => (
          <div key={i} class="d-msged-btn">
            <input class="d-input" value={b.label} maxLength={40} placeholder="Words on the button" aria-label={`Button ${i + 1} words`} onInput={e => setBtn(i, { label: (e.target as HTMLInputElement).value })} />
            <input class={`d-input ${b.href && !safeHref(b.href) ? 'is-bad' : ''}`} value={b.href} placeholder="/chess or https://…" aria-label={`Button ${i + 1} link`} onInput={e => setBtn(i, { href: (e.target as HTMLInputElement).value })} />
            <select class="d-input" value={b.style} aria-label={`Button ${i + 1} look`} onChange={e => setBtn(i, { style: (e.target as HTMLSelectElement).value === 'soft' ? 'soft' : 'main' })}>
              <option value="main">Main</option><option value="soft">Soft</option>
            </select>
            <button type="button" class="d-btn is-ghost is-sm" aria-label={`Remove button ${i + 1}`} onClick={() => set({ buttons: buttons.filter((_, j) => j !== i) })}>Remove</button>
          </div>
        ))}
        {buttons.length < BTN_MAX && (
          <div class="d-row">
            <button type="button" class="d-btn is-ghost is-sm" onClick={() => set({ buttons: [...buttons, { label: '', href: '', style: buttons.length ? 'soft' : 'main' }] })}>Add a button</button>
            {PRESETS.filter(p => !buttons.some(b => b.href === p.href)).map(p => <button key={p.href} type="button" class="d-btn is-ghost is-sm" onClick={() => set({ buttons: [...buttons, { ...p, style: buttons.length ? 'soft' : p.style }] })}>+ {p.label}</button>)}
          </div>
        )}
        {badLinks.length > 0 && <p class="d-fine is-err">A button link must start with https://, mailto: or / (a page of the site). Buttons with other links are left out.</p>}
      </div>
      {preview && <MsgPreview msg={value} tone={tone} />}
    </div>
  )
}

/** The message as the site takes it: buttons without words or a good link left out. */
export const msgOut = (m: Msg): Msg => {
  const buttons = (m.buttons ?? []).filter(b => b.label.trim() && safeHref(b.href)).map(b => ({ ...b, label: b.label.trim(), href: b.href.trim() }))
  return { text: m.text.trim(), ...(m.html ? { html: true } : {}), ...(buttons.length ? { buttons } : {}) }
}
/** Whether a message has anything to show. */
export const msgEmpty = (m: Msg) => !m.text.trim() && !(m.buttons ?? []).some(b => b.label.trim() && safeHref(b.href))
