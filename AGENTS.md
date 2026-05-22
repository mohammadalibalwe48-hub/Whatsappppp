# AGENTS.md

Guidance for AI coding agents (Devin, Codex, Cursor, Claude, Aider, Copilot Chat, etc.) working on this repository.

## Project

**OtpWave** — a self-hosted WhatsApp OTP verification gateway. You pair your own WhatsApp account once, then send OTPs to any phone number from your server via a simple HTTP API. Customers authenticate with a per-key `X-API-Key` header.

This is an npm-workspaces monorepo with two apps:

| Workspace | Purpose | Stack |
|---|---|---|
| `api/` | HTTP gateway + WhatsApp bridge | Node 22 · Express · TypeScript · [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) · Supabase service-role · Upstash Redis (`ioredis`) · Socket.IO |
| `web/` | Customer dashboard + landing page | Next.js 14 (App Router) · TypeScript · Tailwind · shadcn-style primitives · Supabase auth (client) |

## Production URLs

- **API:** https://otpwave-api.fly.dev (health: `GET /health`)
- **Dashboard / landing:** https://otpwave-web.fly.dev

Use these when verifying deploys, reproducing user-reported bugs, or running end-to-end checks. Both are publicly accessible (no SSO).

Note:
- Do **not** ask the user for the production URLs — they are these.
- The Fly app slugs are `otpwave-api` and `otpwave-web` (Fly org: `personal`).

## Infrastructure

- **Compute:** Fly.io. Configs live in `api/fly.toml` and `web/fly.toml`. `api/` has a 1 GB volume `otpwave_sessions` mounted at `/data` for Baileys auth state. `auto_stop_machines = "off"` on `api/` because Baileys needs an always-on socket — **do not change this**.
- **Database & auth:** Supabase project `qqmuccjurxbmvebfcerd` (us-west-2). The dashboard uses Supabase Auth (email + password). The API uses the service-role key for server-side writes and bypasses RLS.
- **Cache / OTP store:** Upstash Redis (Tokyo `ap-northeast-1` for now). All OTP state (active code, hash, attempts, resend cooldown) lives in Redis with a TTL; `otp_logs` in Supabase is the durable audit trail.
- **Deploy:** `fly deploy --app otpwave-api --remote-only` (from `api/`) and `fly deploy --app otpwave-web --remote-only --build-arg NEXT_PUBLIC_API_BASE_URL=https://otpwave-api.fly.dev --build-arg NEXT_PUBLIC_SUPABASE_URL=… --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=…` (from `web/`). See `docs/DEPLOY_FLY.md` for the full first-time setup (Fly apps, volume, Supabase auth redirect URLs, secrets).

## Local development

```bash
# from repo root
npm install                 # installs both workspaces

npm run dev:api             # tsx watch — port 4000
npm run dev:web             # next dev — port 3000

npm run lint                # eslint in both workspaces
npm run typecheck           # tsc --noEmit in both workspaces
npm run build               # tsc + next build in both workspaces
```

Both workspaces need `.env` files. Copy `.env.example` (at the repo root) to `api/.env` and `web/.env.local`, then fill in the Supabase + Upstash + signing-key values. Never commit `.env` files.

## Codebase layout

### `api/`

- `api/src/index.ts` — express boot, routes wiring, Socket.IO server
- `api/src/routes/publicApi.ts` — `/v1/otp/send`, `/v1/otp/verify`, `/v1/otp/resend` (require `X-API-Key`)
- `api/src/routes/dashboard.ts` — `/dashboard/*` endpoints (require Supabase Bearer JWT)
- `api/src/middleware/auth.ts` — `requireApiKey()` and `requireDashboardAuth()`
- `api/src/otp/service.ts` — OTP lifecycle: generate, store, verify, resend
- `api/src/otp/templates.ts` — message rendering
- `api/src/whatsapp/sessionManager.ts` — Baileys session lifecycle, QR generation, reconnects
- `api/src/lib/crypto.ts` — `generateApiKey`, `hashApiKey`, `generateOtpCode(length, alphabet)`
- `api/src/lib/redis.ts` — `ioredis` wrapper (`getKv`)
- `api/src/lib/supabase.ts` — service-role Supabase client (`getSupabase`)
- `api/src/webhooks/dispatcher.ts` — outgoing webhook delivery + signing

### `web/`

- `web/app/dashboard/` — authenticated dashboard pages
  - `api-keys/` — list, create, edit, revoke API keys (with per-key OTP length + alphabet defaults)
  - `whatsapp/` — QR pairing UI, session status
  - `analytics/` — OTP funnel + recent activity
  - `webhooks/` — webhook endpoint management
  - `settings/` — profile / signing keys
- `web/app/login`, `web/app/signup` — Supabase auth
- `web/lib/api.ts` — `apiFetch` helper that injects the Supabase JWT
- `web/components/ui/` — minimal shadcn-style primitives (Button, Card, Dialog, Input, Label, Badge, Skeleton, etc.)

### `supabase/`

- `supabase/migrations/` — timestamped SQL files. All tables use Row-Level Security; the API bypasses it server-side via the service-role key.
- Tables: `profiles`, `api_keys`, `otp_logs`, `webhook_endpoints`, `webhook_deliveries`.

## Public API contract

All public endpoints require an `X-API-Key` header (or `Authorization: Bearer <key>`).

### `POST /v1/otp/send`

```json
{
  "phoneNumber": "+15551234567",
  "appName": "MyApp",          // optional, used in the message template
  "length": 6,                 // optional 4–10, falls back to key default
  "alphabet": "numeric",       // optional: numeric|alphanumeric|alphabetic
  "ttlSeconds": 300            // optional 30–3600, defaults to env OTP_DEFAULT_TTL_SECONDS
}
```

Returns `{ ok: true, otpId, expiresAt, ttlSeconds }`.

### `POST /v1/otp/verify`

```json
{ "otpId": "otp_...", "code": "123456" }
```

Or, instead of `otpId`, pass `"phoneNumber": "+15551234567"` to verify against the most recent active OTP for that phone.

Returns one of:
- `{ ok: true, status: "verified", otpId, phoneNumber }`
- `{ ok: true, status: "invalid", attemptsRemaining, reason }`
- `{ ok: true, status: "expired", otpId }`
- `{ ok: true, status: "not_found" }`
- `{ ok: true, status: "rate_limited", retryAfter }`

### `POST /v1/otp/resend`

```json
{ "otpId": "otp_..." }   // or { "phoneNumber": "+15551234567" }
```

Subject to a server-side resend cooldown (default 30 s).

## Conventions

- **Follow existing code style.** Don't introduce new libraries without checking `package.json` (api or web) first. Both workspaces are intentionally light on dependencies.
- **Keep PRs minimal and focused.** Avoid large refactors unless explicitly requested.
- **Never commit secrets.** Anything that goes into `process.env` belongs in Fly secrets (`fly secrets set …`), not in committed files. `.env.example` is the only `.env*` checked in.
- **Schema changes:** add a new file under `supabase/migrations/` with a timestamp prefix (e.g. `20260520000000_my_change.sql`). Apply it to the live DB via the Supabase Management API before deploying API code that uses the new columns, so the deploy doesn't break mid-rollout. Migrations should be idempotent (`add column if not exists`, etc.) where possible.
- **Never edit `dist/` or generated files** — they're compiled from `src/`.
- **Always open a PR against `main`.** Don't push to `main` directly. Use the repo's PR template at `.github/PULL_REQUEST_TEMPLATE.md` if present.
- **Lint, typecheck, and build before PR:** `npm run lint && npm run typecheck && npm run build`. There is currently no CI; review is human-driven.

## Things to NOT break

1. **`auto_stop_machines = "off"`** on `api/fly.toml`. Baileys' WhatsApp socket can't survive a machine pause; if you turn auto-stop on, the API stops delivering OTPs as soon as traffic dies down.
2. **`min_machines_running = 1`** on `api/fly.toml`. Same reason.
3. **`node:22-bookworm-slim`** in `api/Dockerfile` and `web/Dockerfile`. Supabase `@supabase/supabase-js` 2.106+ eagerly constructs a Realtime WebSocket client; Node 20 has no native `WebSocket` and the API returns 401 on every dashboard request. Don't downgrade below 22.
4. **Volume mount** at `/data` on `api/fly.toml`. Baileys auth state (the paired-device credentials) lives in `/data/sessions/<userId>/`. Losing the volume = needing to re-scan the QR code.
5. **Service-role key handling.** The service-role key in `api/` bypasses RLS. Don't expose it via any new dashboard endpoint or log it. Only the `api/` workspace ever sees it.
6. **`API_CORS_ORIGINS` allow-list.** When integrating new frontends (e.g. the MBGRAM site), add the origin to the env var and re-run `fly secrets set API_CORS_ORIGINS=…`; don't open it to `*`.

## When you're done

1. `npm run lint && npm run typecheck && npm run build` — all green.
2. Open a PR against `main`. The PR template (if present) asks for a manual-test checklist; fill it in.
3. If your change is a schema migration, mention that the live DB needs the migration applied separately.
4. After merge, the user (or the next agent) runs `fly deploy --app otpwave-api --remote-only` and `fly deploy --app otpwave-web --remote-only …` to ship.
