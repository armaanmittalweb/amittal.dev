// A note sealed with a phrase. The phrase is never stored: it is the key. A request typed
// into the archive's search is tried against the seal, and only the right words open it.
// Sealed with AES-GCM under a PBKDF2-SHA-256 key (100,000 rounds: quick to check, slow to guess); a wrong key fails the tag.

export interface Keepsake { on: { title: string; body: string }; off: { title: string; body: string } }

const SEAL = {
  salt: 'pL+TXs8PpOMtSaXLG37Hqw==',
  iv: 'SmrVzOzso9akQbmE',
  box: 'E+x3VuQ463NTXWhfYAhg7Ze7bp3j0qjCypB9/uLhNoGTHkV0xomEM5xQSHAzWSgN/22KW5gf48Q6JgjFQeEEbrY/9djhtLvPw6B8zkrpQnl9eSIexrTPkKYveDcB9Lh90WFWhBJyusV3K+7l3EMcf+phA777uQrtRAG9CByeBJdQhVxD4mIDLGC3grAiGw+ZGFs9BNDHFfTFxe52YIwQxUhlVPreWjIWbllu1TkPg+h2Wrn9HrIEOzo/33QNhB8OVni2NkJaDumL4FA3Y1bsGZImm4JMMGGHz6Gex/j6L07BF22J7lMSBXxmCNcL5XI=',
}

const bytes = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0))

/** The note, if `phrase` is the one it was sealed with; otherwise null. */
export async function openKeepsake(phrase: string): Promise<Keepsake | null> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return null
  try {
    const base = await subtle.importKey('raw', new TextEncoder().encode(phrase.trim().toLowerCase()), 'PBKDF2', false, ['deriveKey'])
    const key = await subtle.deriveKey({ name: 'PBKDF2', salt: bytes(SEAL.salt), iterations: 100000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
    const plain = await subtle.decrypt({ name: 'AES-GCM', iv: bytes(SEAL.iv) }, key, bytes(SEAL.box))
    return JSON.parse(new TextDecoder().decode(plain)) as Keepsake
  } catch { return null }
}
