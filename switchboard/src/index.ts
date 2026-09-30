import { createApp, defaultProbe, recordChecks, type Bindings } from './app'
import { adminTick, createAdmin, type AdminDeps } from './admin/app'
import { d1Sql, getSetting } from './sql'
import { liveIds } from './services'
import { d1Store } from './store'

const deps: AdminDeps = {
  store: env => d1Store(env.DB),
  probe: defaultProbe,
  sql: env => d1Sql(env.DB),
  // The admin can change the live list without a deploy; the LIVE var is the fallback.
  live: async env => liveIds((await getSetting(d1Sql(env.DB), 'live').catch(() => null)) ?? env.LIVE),
}
const app = createApp(deps)
const admin = createAdmin(deps)

export default {
  // api.amittal.dev is the public API; admin.amittal.dev is the dashboard.
  fetch(req, env, ctx) {
    const host = new URL(req.url).hostname
    return (host === (env.ADMIN_HOST ?? 'admin.amittal.dev') ? admin : app).fetch(req, env, ctx)
  },
  // Every 5 minutes (wrangler.jsonc): record a round of checks, then the admin's alerts and upkeep.
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(recordChecks(env, deps).then(() => adminTick(env, deps)))
  },
} satisfies ExportedHandler<Bindings>
