# Switchboard

One Cloudflare Worker (free plan) with two faces:

- **api.amittal.dev**: the Lab's public gateway. It watches every deployed project, fronts the EduSched API and counts page views.
- **admin.amittal.dev**: a password-protected operator console showing uptime, traffic, free-tier headroom and alerts, plus levers for one-off jobs.

## Public API (api.amittal.dev)

| Route | What it does |
|---|---|
| `GET /status` | Checks every watched service in parallel (4 s timeout each) and returns up/down, round trip and HTTP status. Unwatched services are reported as `planned`, never as down. One snapshot per isolate is reused for 30 s. |
| `GET /uptime` | Per service, per UTC day for the last 30 days: checks passed, checks run, average round trip. |
| `POST /hit` | Page-view beacons from the sites (see Traffic below). Always 204. |
| `/edusched/*` | Forwarded to the EduSched API Worker through a service binding, with the prefix removed. |
| `GET /health` | The Switchboard itself. |

CORS allows `https://www.amittal.dev`, `https://amittal.dev` and `http://localhost:5173`.

Health checks never touch a database. A Neon compute queried every 5 minutes would never scale to zero and would use up the free plan's compute hours, so EduSched is checked at `/api/test`.

## Admin (admin.amittal.dev)

| Screen | Shows |
|---|---|
| **Board** | Every line with its lamp, round trip, 30-day uptime strip and today's views; open alerts; this week's traffic; the four fullest free-tier meters; latest deploys. |
| **Traffic** | Views and visitors per day (7, 30 or 90 days) for all sites or one, top pages, referring sites, countries and devices. |
| **Resources** | Free-tier meters with 70% and 90% marks, grouped by provider; numbers from inside each project; which data sources are connected, with setup steps for the rest. |
| **Controls** | Levers (check now, read usage, clean up EduSched, prune OpeningOS sync, test alert); which lines are watched (no deploy needed); redeploys; alert history. |

Keys: `1` to `4` switch screens and `r` refreshes. The Board refreshes itself every minute while the tab is visible.

**Sign-in.** One password, stored only as a PBKDF2 hash (`ADMIN_PASSWORD_HASH`), and a signed, HttpOnly, SameSite=Strict session cookie that lasts 7 days (`SESSION_SECRET`). Logins are limited to 5 a minute per IP. Every POST must come from the dashboard's own origin. The pages send a strict CSP and `noindex`.

```sh
npm run set-password                  # generates a password, prints it once, uploads both secrets
npm run set-password -- "your phrase" # or choose one (12+ characters)
```

Changing the password also rotates the session secret, which signs every device out.

### Where the numbers come from

| Source | Needs | Gives |
|---|---|---|
| Project Workers' `/internal/stats` | `INTERNAL_KEY` (the same secret on all three Workers) | Database sizes, synced phrases, departments, class changes, demo copies; runs the cleanup levers |
| This Worker's D1 | nothing | Uptime log, traffic, D1 size |
| Cloudflare GraphQL analytics | `CF_API_TOKEN` (Account Analytics: Read) | Worker requests today against 100k, D1 rows read and written |
| Neon API | `NEON_API_KEY` | Compute hours this month per project |
| Vercel API | `VERCEL_TOKEN` | Latest production deploy per site, one-click redeploys |
| ntfy.sh | `NTFY_TOPIC` | Alerts pushed to your phone |

Usage is read every 6 hours by the cron (reading wakes both Neon databases) or on demand with **Refresh usage**. Alerts are re-evaluated every 5 minutes. They fire when a watched line fails two checks in a row, or when a meter reaches 70% (warning) or 90% (critical). Each alert resolves on its own when the problem clears.

### Traffic

Each site calls `countViews('<site>')` (a small `beacon.ts` in each repo) and sends `{ s, p, r }` as a text/plain beacon. The Worker drops bots, unknown sites and beacons whose Origin does not match the site. It keeps daily counts per path, referring site, country and device type.

Unique visitors are a hash of (daily salt, IP, user agent, site). The salt is deleted after two days, so visitors cannot be linked across days. There are no cookies and no ids. Views and dimensions are kept 400 days, visitor hashes 90. A view costs about five D1 row writes, so the 100k daily write limit covers about 20,000 views a day.

## Code

- `src/services.ts`: the watched services, how each is checked, and each site's origin.
- `src/checks.ts`, `src/store.ts`: parallel checks and the uptime log.
- `src/traffic.ts`: beacon validation, counting and the traffic report.
- `src/admin/`: `auth.ts` (password and session), `resources.ts` (meters and connections), `alerts.ts` (rules and ntfy), `app.ts` (the admin API and static files).
- `src/app.ts`: the public routes. `src/index.ts` routes by hostname and runs the cron.
- `admin-ui/`: the dashboard (Preact + Vite), built into `admin-ui/dist` and served as Worker static assets.

```sh
npm install
npm test          # vitest against node:sqlite with the real schema; no Cloudflare account needed
npm run typecheck # Worker, tests and dashboard
npm run dev:ui    # dashboard on :5178, proxying /api to `npm run dev` on :8787
```

For `npm run dev`, create `.dev.vars` with `ADMIN_HOST=api.amittal.dev` (wrangler dev presents every request under the first route), the output of `npm run set-password -- "<local password>" --print-only`, and `INTERNAL_KEY=local`. Then run `npx wrangler d1 execute switchboard --local --file schema.sql`.

## Deploy

```sh
npx wrangler d1 execute switchboard --remote --file schema.sql   # idempotent; run after schema changes
npx wrangler deploy                                              # builds the dashboard first
```

The custom domains, D1 database, service bindings and rate limiters are all in `wrangler.jsonc`.
