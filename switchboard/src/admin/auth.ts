/**
 * Admin login: one password, stored only as a PBKDF2 hash in the ADMIN_PASSWORD_HASH secret, and a
 * session cookie signed with SESSION_SECRET. 20k iterations keeps a login inside the free plan's CPU
 * budget; the hash never leaves the Worker's secrets, so it is not exposed to offline guessing.
 *
 * Hash format (same as EduSched): pbkdf2_sha256$<iterations>$<salt b64>$<hash b64>
 */
const enc = new TextEncoder()
export const SESSION_COOKIE = '__Host-sb'
export const SESSION_DAYS = 7
const MAX_ITERATIONS = 100_000 // Workers rejects more than this

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))
const b64url = (u: Uint8Array) => b64(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** Compares without an early exit, so response time says nothing about how much matched. */
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number, bytes: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, bytes * 8))
}

export async function hashPassword(password: string, iterations = 20_000): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2_sha256$${iterations}$${b64(salt)}$${b64(await pbkdf2(password, salt, iterations, 32))}`
}

export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  const [scheme, iter, salt, hash] = (stored ?? '').split('$')
  const iterations = Number(iter)
  if (scheme !== 'pbkdf2_sha256' || !salt || !hash || !Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) return false
  const expected = unb64(hash)
  return sameBytes(await pbkdf2(password, unb64(salt), iterations, expected.length), expected)
}

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}

/** A session token: `<expiry ms>.<HMAC of the expiry>`. Nothing else is needed; there is one admin. */
export async function signSession(secret: string, now: number): Promise<string> {
  const exp = now + SESSION_DAYS * 86_400_000
  return `${exp}.${b64url(await hmac(secret, 'sb1.' + exp))}`
}

export async function verifySession(secret: string | undefined, token: string | undefined, now: number): Promise<boolean> {
  if (!secret || !token) return false
  const [exp, sig] = token.split('.')
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) <= now) return false
  return sameBytes(enc.encode(b64url(await hmac(secret, 'sb1.' + exp))), enc.encode(sig))
}
