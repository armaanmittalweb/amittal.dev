import { createApp, defaultProbe, recordChecks, type Bindings, type Deps } from './app'
import { d1Store } from './store'

const deps: Deps = { store: env => d1Store(env.DB), probe: defaultProbe }
const app = createApp(deps)

export default {
  fetch: app.fetch,
  // Every 5 minutes (wrangler.jsonc): record a round of checks for the Lab's uptime strip.
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(recordChecks(env, deps))
  },
} satisfies ExportedHandler<Bindings>
