import { useState } from 'preact/hooks'
import { api } from './api'

export function Login({ configured, onIn }: { configured: boolean; onIn: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: Event) => {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError(null)
    try {
      await api.login(password)
      onIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.')
      setBusy(false)
    }
  }

  return (
    <main class="login">
      <form class="login-card" onSubmit={submit}>
        <div class="login-lamps" aria-hidden="true">
          <span class="lamp lamp-up" /><span class="lamp lamp-warn" /><span class="lamp lamp-idle" /><span class="lamp lamp-up" />
        </div>
        <h1 class="wordmark">Switchboard</h1>
        <p class="login-sub">Operator console for amittal.dev</p>
        {!configured && <p class="notice is-err" role="alert">The admin password has not been set on the Worker yet. See the Switchboard README.</p>}
        <label class="field">
          <span class="kicker">PASSWORD</span>
          <input type="password" autoComplete="current-password" autoFocus value={password} onInput={e => setPassword((e.target as HTMLInputElement).value)} disabled={!configured} />
        </label>
        {error && <p class="login-error" role="alert">{error}</p>}
        <button type="submit" class="btn btn-wide" disabled={busy || !password || !configured}>{busy ? 'Connecting…' : 'Connect'}</button>
        <p class="fine">Five tries a minute. The session lasts seven days on this device.</p>
      </form>
    </main>
  )
}
