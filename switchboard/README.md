# Switchboard

The Lab's gateway at `api.amittal.dev`: one Cloudflare Worker (free plan) that watches every deployed project and fronts the ones that have an API.

| Route | What it does |
|---|---|
| `GET /status` | Checks every service listed in `LIVE` in parallel (4 s timeout each) and returns up/down, round trip and HTTP status. Services not yet in `LIVE` are reported as `planned`, never as down. One snapshot per isolate is reused for 30 s. |
| `GET /uptime` | Per service, per UTC day for the last 30 days: checks passed, checks run, average round trip. |
| `/edusched/*` | Forwarded to the EduSched API Worker through a service binding, with the prefix removed. 503 until the binding exists. |
| `GET /health` | The Switchboard itself. |

A cron runs every 5 minutes: it records one round of checks in D1 and deletes rows older than 35 days. With six services that is under 2,000 writes a day, well inside D1's free limits.

CORS allows `https://www.amittal.dev`, `https://amittal.dev` and `http://localhost:5173`.

## Code

- `src/services.ts`: the watched services and how each is checked (public URL, or a service binding for Workers).
- `src/checks.ts`: the parallel checks with timeouts.
- `src/store.ts`: the uptime store: D1 in production, an array in tests.
- `src/app.ts`: the Hono routes and the cron job; `src/index.ts` wires them to D1.

```sh
npm install
npm test          # vitest, no Cloudflare account needed
npm run typecheck
```

## Deploy (needs the Cloudflare account)

```sh
npm approve-scripts workerd esbuild   # npm 11 blocks their install scripts by default
npx wrangler login
npx wrangler d1 create switchboard    # paste the id into wrangler.jsonc
npx wrangler d1 execute switchboard --remote --file schema.sql
npx wrangler deploy
```

Then uncomment the `routes` entry for `api.amittal.dev` (the domain has to be on Cloudflare), and the `EDUSCHED` service binding once `edusched-api` is deployed. Add each service's id to `LIVE` as it ships.
