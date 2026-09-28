// A note sealed with a phrase. The phrase is never stored: it is the key. A request typed
// into the archive's search is tried against the seal, and only the right words open it.
// Sealed with AES-GCM under a PBKDF2-SHA-256 key (250,000 rounds); a wrong key fails the tag.

export interface Keepsake { on: { title: string; body: string }; off: { title: string; body: string } }

const SEAL = {
  salt: 'mIdOnxBJBpJZ5iObC4YhXQ==',
  iv: 'lgMxe0JUk5886ms0',
  box: 'MYei6GHQDwIEqSGudYYDPuAo5qdiAngFw7N8S0Mn2gXfbYkVNDph0wea+F64GlP+WoKVOwEVvv9LumnxDpSO8BRdw2yq+Mn9sR+CjOYMp7ake6JVDWCc1hfbtNP6UdvOopbBLFMhdgnD6bb3ly+Af9NUSEhLN3eYxGQdidvua7s2d0e23ru24lCyOx9qs1+O7E3ddt2+7w0HQ78C9w3loBebf3l5TxJU79xlud4vNPDsv0IaIgN2zKMO9QAMCgctfoe7ILzrVuX6j0fPvI3X//hlStGm8zdA51EF1s8EF8pv1gJunjCk4K2RjaCllYY=',
}

const bytes = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0))

/** The note, if `phrase` is the one it was sealed with; otherwise null. */
export async function openKeepsake(phrase: string): Promise<Keepsake | null> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return null
  try {
    const base = await subtle.importKey('raw', new TextEncoder().encode(phrase.trim().toLowerCase()), 'PBKDF2', false, ['deriveKey'])
    const key = await subtle.deriveKey({ name: 'PBKDF2', salt: bytes(SEAL.salt), iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
    const plain = await subtle.decrypt({ name: 'AES-GCM', iv: bytes(SEAL.iv) }, key, bytes(SEAL.box))
    return JSON.parse(new TextDecoder().decode(plain)) as Keepsake
  } catch { return null }
}
