# Fly.io + Upstash + Supabase deployment plan

This repo (OtpWave) is already a complete WhatsApp-OTP SaaS — Express + Baileys backend, Next.js dashboard, Supabase auth/DB, Redis-backed OTP store. It currently has `render.yaml` and Railway configs. The application code is already compatible with the target stack — I just need to add Fly.io deployment configs and document the flow.

## Architecture on the target stack

```
+---------------------+      +-----------------------+      +-----------------+
|  otpwave-web        |      |  otpwave-api          |      |  Your WhatsApp  |
|  Next.js dashboard  +----->+  Express + Baileys    +----->+  account        |
|  Fly.io (256 MB)    |      |  Fly.io (256 MB)      | QR   |                 |
+---------------------+      |  + 3 GB volume @/data |      +-----------------+
                             +----+--------+---------+
                                  |        |
                       (rediss://)|        |(https://)
                                  v        v
                          +-------+--+   +-+----------+
                          | Upstash  |   | Supabase   |
                          | Redis    |   | (DB + Auth)|
                          +----------+   +------------+
```

- **Supabase** — already provisioned. DB schema in `supabase/migrations/20260519000001_init.sql` (RLS-protected tables for api_keys, otp_requests, audit_logs, webhook configs, etc.).
- **Upstash Redis** — free tier (10 k cmds/day, 256 MB). Provides a `rediss://` (TLS) URL. The existing `ioredis` client in `api/src/lib/redis.ts` already accepts TLS URLs without changes.
- **Fly.io** — 2 apps, both `shared-cpu-1x` 256 MB:
  - `otpwave-api`: always-on (`min_machines_running = 1`, `auto_stop_machines = false`) — required because Baileys must hold a long-lived WhatsApp socket. Mounts a Fly volume at `/data` for Baileys auth state (`WHATSAPP_SESSIONS_DIR=/data/sessions`).
  - `otpwave-web`: can scale to zero (`auto_stop_machines = true`).

## Files I'll add / change

### New
- `api/fly.toml` — Fly app config (always-on machine, 256 MB, volume mount at `/data`, port 4000, health check on `/health`, websocket support).
- `web/fly.toml` — Fly app config (scale-to-zero OK, 256 MB, port 3000, build args for `NEXT_PUBLIC_*`).
- `api/.dockerignore`, `web/.dockerignore` — keep `node_modules`, `dist`, `.next`, session data out of the build context (much faster `fly deploy`).
- `docs/DEPLOY_FLY.md` — step-by-step deploy guide (Upstash provisioning, Fly app create + volume + secrets, web/api wiring, Supabase auth redirect URLs).

### Modified
- `README.md` — add a new top section recommending the Fly + Upstash + Supabase path; keep Render/Railway sections as alternatives.
- `.env.example` — add a commented Upstash `REDIS_URL` example so devs know the format.

### Unchanged (already compatible)
- `api/src/lib/redis.ts` — `ioredis` already parses `rediss://` for Upstash TLS.
- `api/src/config/env.ts` — already aliases `PORT` → `API_PORT` for Fly's injected `PORT`.
- `api/src/whatsapp/sessionManager.ts` — already reads/writes `WHATSAPP_SESSIONS_DIR`, which we point at `/data/sessions` (the mounted volume).
- `api/Dockerfile`, `web/Dockerfile` — work as-is with `fly deploy`.

## Why no code changes are needed

The app was built generically against `REDIS_URL` (any Redis), `SUPABASE_URL` (any Supabase project), and a configurable on-disk sessions path. Switching to Upstash and Fly is purely a deployment-config exercise — no source changes.

## How you'll deploy (preview of the guide)

```bash
# 1. Supabase: apply the migration
psql "$SUPABASE_DB_URL" < supabase/migrations/20260519000001_init.sql

# 2. Upstash: create a Redis DB, copy the `rediss://...` connection string.

# 3. Fly: create the two apps + volume + secrets
fly apps create otpwave-api
fly apps create otpwave-web
fly volumes create otpwave_sessions --app otpwave-api --size 1 --region iad

# 4. Set secrets on the api app
fly secrets set --app otpwave-api \
  SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=... \
  REDIS_URL='rediss://default:...@...upstash.io:6379' \
  SESSION_ENCRYPTION_KEY=$(openssl rand -hex 32) \
  WEBHOOK_SIGNING_PEPPER=$(openssl rand -hex 16) \
  API_CORS_ORIGINS='https://otpwave-web.fly.dev'

# 5. Deploy api, then web (web needs --build-arg for NEXT_PUBLIC_* vars)
fly deploy --app otpwave-api --config api/fly.toml
fly deploy --app otpwave-web --config web/fly.toml \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  --build-arg NEXT_PUBLIC_API_URL=https://otpwave-api.fly.dev \
  --build-arg NEXT_PUBLIC_SITE_URL=https://otpwave-web.fly.dev
```

## What I'll do next

1. Install deps, verify `npm run build` and `npm run typecheck` pass on `main` first (no-touch baseline).
2. Add the Fly configs + dockerignores + docs.
3. Re-run lint/typecheck/build.
4. Open a PR for review.
5. After PR is green, I can either (a) walk you through `fly deploy` step-by-step, or (b) run it myself if you'd like me to handle the deploy too — but that requires a Fly auth token. Let me know.

Proceeding with implementation now — no need to block.
