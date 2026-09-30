// Sets the admin password: hashes it (PBKDF2-SHA256, the format src/admin/auth.ts reads), makes a new
// session secret (which signs everyone out), and uploads both as Worker secrets with wrangler.
//
//   npm run set-password                 generates a strong password and prints it once
//   npm run set-password -- "my phrase"  uses yours (quote it; 12+ characters)
//   npm run set-password -- --print-only prints the secrets JSON instead of uploading (for .dev.vars)
import { execSync } from 'node:child_process'
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const printOnly = args.includes('--print-only')
const given = args.find(a => !a.startsWith('--'))
if (given && given.length < 12) {
  console.error('Use at least 12 characters.')
  process.exit(1)
}
const words = ['amber', 'relay', 'socket', 'patch', 'lamp', 'dial', 'trunk', 'signal', 'copper', 'ledger', 'harbor', 'quartz', 'meadow', 'cinder', 'lantern', 'orbit']
const password = given ?? [...randomBytes(5)].map(b => words[b % words.length]).join('-') + '-' + randomBytes(3).toString('hex')

const iterations = 20_000
const salt = randomBytes(16)
const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256')
const secrets = {
  ADMIN_PASSWORD_HASH: `pbkdf2_sha256$${iterations}$${salt.toString('base64')}$${hash.toString('base64')}`,
  SESSION_SECRET: randomBytes(32).toString('base64url'),
}

if (printOnly) {
  console.log(JSON.stringify(secrets, null, 2))
} else {
  const dir = mkdtempSync(join(tmpdir(), 'sb-'))
  const file = join(dir, 'secrets.json')
  try {
    writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 })
    execSync(`npx wrangler secret bulk "${file}"`, { stdio: 'inherit' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
if (!given) console.log(`\nAdmin password (shown once, save it in your password manager):\n\n  ${password}\n`)
