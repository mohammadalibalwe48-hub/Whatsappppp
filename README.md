# OtpWave

> WhatsApp OTP verification for modern apps — connect your own WhatsApp account, generate API keys, and send OTPs from your server in under five minutes.

OtpWave is a production-grade SaaS that turns a personal WhatsApp account (paired via QR code, just like WhatsApp Web) into a private OTP gateway. The platform is built around **Baileys** for the WhatsApp protocol, **Supabase** for auth and persistence, and **Redis** for OTP storage, rate limiting, and cooldowns.

```
+-------------+      +----------------+      +-----------------+
|             |      |                |      |                 |
|  Your app   +----->+  OtpWave API   +----->+  Your WhatsApp  +-------> End user
|             | API  |  (Baileys)     | QR   |  account        |
+-------------+      +----------------+      +-----------------+
                            |
                            v
                    +---------------+
                    |  Supabase     |
                    |  + Redis      |
                    +---------------+
```

## What it gives you

- A premium, fully responsive dashboard for connecting WhatsApp, managing API keys, browsing OTP logs, viewing analytics, and configuring webhooks.
- A clean REST API (`/v1/otp/send`, `/v1/otp/verify`, `/v1/otp/resend`, `/v1/otp/{id}`).
- Realtime QR + session status streamed to the dashboard over Socket.IO.
- bcrypt-hashed OTPs, HMAC-signed webhooks, per-key sliding-window rate limits, Supabase row-level security for tenant isolation, and an audit log of every OTP and webhook delivery.
- Automatic Baileys reconnection with exponential backoff and on-disk session persistence so sessions survive restarts.

## Tech stack

| Layer       | Choice                                            |
| ----------- | ------------------------------------------------- |
| API runtime | Node 20 + TypeScript + Express + Socket.IO        |
| WhatsApp    | [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys) |
| Auth + DB   | [Supabase](https://supabase.com) (Postgres + RLS) |
| KV / Queue  | Redis (with an in-memory fallback for dev)        |
| Frontend    | Next.js 14 (App Router) + Tailwind + Radix + Recharts |
| Deployment  | Docker Compose / any container host               |

## Repository layout

```
.
├── api/                 # Express + Baileys backend (TypeScript)
│   ├── src/
│   │   ├── config/      # Environment validation (zod)
│   │   ├── lib/         # supabase, redis, crypto, logger helpers
│   │   ├── whatsapp/    # Baileys session manager
│   │   ├── otp/         # OTP generation, verification, templates
│   │   ├── middleware/  # auth, rate limiting, error handler
│   │   ├── routes/      # public API + dashboard routes
│   │   ├── realtime/    # Socket.IO server
│   │   └── webhooks/    # HMAC-signed webhook dispatcher
│   ├── Dockerfile
│   └── package.json
├── web/                 # Next.js dashboard + marketing page
│   ├── app/             # App Router pages (dashboard, login, signup, docs)
│   ├── components/      # UI primitives (button, card, dialog, tabs, …)
│   ├── lib/             # Supabase clients, API client, hooks
│   ├── Dockerfile
│   └── package.json
├── supabase/migrations/ # SQL migrations (schema + RLS)
├── docker-compose.yml   # Redis + API + Web
├── .env.example
└── README.md
```

## Quick start

### 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. From the **Project Settings → API** page, copy the `Project URL`, the `anon` public key, and the `service_role` secret key.
3. Apply the SQL migration in `supabase/migrations/20260519000001_init.sql`. The easiest way is to paste it into the Supabase SQL editor. If you have the Supabase CLI:

   ```bash
   supabase db push
   ```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_URL
#   SUPABASE_SERVICE_ROLE_KEY
#   SESSION_ENCRYPTION_KEY   (openssl rand -hex 32)
#   WEBHOOK_SIGNING_PEPPER   (any long random string)
```

### 3. Local development

```bash
npm install
npm run dev:api    # http://localhost:4000
npm run dev:web    # http://localhost:3000
```

You'll need a Redis instance for production. For local development the API automatically falls back to an in-memory store if no `REDIS_URL` is set — fine for testing, not for production.

### 4. Run everything in Docker

```bash
docker compose up --build
```

That starts Redis, the API (port `4000`), and the dashboard (port `3000`).

## Deploying to Fly.io + Upstash + Supabase (recommended low-cost path)

Cheapest production-grade setup — all three providers have generous free tiers:

| Layer | Provider | Free quota |
| --- | --- | --- |
| Auth + Postgres | **Supabase** | 500 MB DB, 50 k MAUs |
| OTP / rate-limit KV | **Upstash Redis** | 10 k cmds/day, 256 MB, TLS |
| API container (Baileys) | **Fly.io** `shared-cpu-1x` 256 MB, always-on | 3 always-on shared VMs in the free allowance |
| Web container (Next.js) | **Fly.io** `shared-cpu-1x` 256 MB, scale-to-zero | (same allowance) |
| Baileys session persistence | **Fly volume** 1 GB at `/data` | 3 GB free |

The repo ships ready-to-use Fly configs at [`api/fly.toml`](api/fly.toml) and
[`web/fly.toml`](web/fly.toml). The API config keeps the machine always-on
(required — Baileys holds a long-lived WhatsApp socket), mounts a Fly volume
at `/data` for session credentials, and exposes a health check on `/health`.

**Full step-by-step deploy guide:** [`docs/DEPLOY_FLY.md`](docs/DEPLOY_FLY.md)

TL;DR once you have a Fly account and the CLI installed:

```bash
# 1. Two Fly apps + a 1 GB volume for Baileys auth state
fly apps create otpwave-api
fly apps create otpwave-web
fly volumes create otpwave_sessions --app otpwave-api --size 1 --region iad

# 2. Secrets on the api app (Supabase + Upstash + signing keys)
fly secrets set --app otpwave-api \
  SUPABASE_URL="https://<ref>.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
  REDIS_URL="rediss://default:<pw>@<host>.upstash.io:6379" \
  SESSION_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  WEBHOOK_SIGNING_PEPPER="$(openssl rand -hex 16)" \
  API_CORS_ORIGINS="https://otpwave-web.fly.dev"

# 3. Deploy both apps (web's NEXT_PUBLIC_* vars are baked in at build time)
fly deploy --app otpwave-api --config api/fly.toml
fly deploy --app otpwave-web --config web/fly.toml \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>" \
  --build-arg NEXT_PUBLIC_API_URL="https://otpwave-api.fly.dev" \
  --build-arg NEXT_PUBLIC_SITE_URL="https://otpwave-web.fly.dev"
```

Then update **Supabase → Authentication → URL Configuration** so the
**Site URL** matches `https://otpwave-web.fly.dev` and the same URL +`/**` is
on the **Redirect URLs** list.

## Deploying to Render

Render is an alternative host (see also [Railway](#deploying-to-railway) and [Fly.io](#deploying-to-flyio--upstash--supabase-recommended-low-cost-path)). The repo ships a `render.yaml` blueprint that declares everything Render needs to bring the platform up:

- `otpwave-redis` — managed Key Value (Redis-compatible) store, free plan
- `otpwave-api` — Docker web service on the Starter plan with a 1 GB persistent disk at `/data/sessions`
- `otpwave-web` — Docker web service on the Starter plan for the Next.js dashboard

### 1. Apply the blueprint

Easiest path — the dashboard:

1. Push this repo to GitHub (or use the existing one).
2. In Render, **New → Blueprint → Connect a repository → mohammadalibalwe48-hub/Whatsappppp**.
3. Render reads `render.yaml`, shows the three services it will create, and asks for the env vars marked `sync: false`. Fill them in (table below) and click **Apply**.

### 2. Fill in the env vars Render asks for

You can grab the Supabase values from **Supabase → Project Settings → API**.

| Service | Variable | Where it comes from |
| --- | --- | --- |
| `otpwave-api` | `SUPABASE_URL` | Supabase Project URL (e.g. `https://xyz.supabase.co`) |
| `otpwave-api` | `SUPABASE_SERVICE_ROLE_KEY` | Supabase `service_role` key (keep secret!) |
| `otpwave-api` | `API_CORS_ORIGINS` | `https://otpwave-web.onrender.com` (fill in *after* the web service first deploys) |
| `otpwave-web` | `NEXT_PUBLIC_SUPABASE_URL` | same project URL |
| `otpwave-web` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase `anon` key (safe to ship to the browser) |
| `otpwave-web` | `NEXT_PUBLIC_API_URL` | `https://otpwave-api.onrender.com` (fill in *after* the api service first deploys) |
| `otpwave-web` | `NEXT_PUBLIC_SITE_URL` | this service's own URL, same as above pattern |

`SESSION_ENCRYPTION_KEY`, `WEBHOOK_SIGNING_PEPPER`, and `REDIS_URL` are filled in automatically — the first two via Render's `generateValue`, the third via `fromService` linking to the Key Value store.

### 3. Wire the two services together

The `NEXT_PUBLIC_*` vars are baked into the Next.js bundle at build time, so `otpwave-web` must be **rebuilt** (not just restarted) after you fill in `NEXT_PUBLIC_API_URL`. From the dashboard: **Manual Deploy → Clear build cache & deploy**.

### 4. Configure Supabase Auth

Once the web URL is final, update **Supabase → Authentication → URL Configuration**:

- **Site URL** = `https://<your-web-domain>.onrender.com`
- Add `https://<your-web-domain>.onrender.com/**` to **Redirect URLs**.

Without this, sign-up/login redirects will silently fail or land on `localhost`.

### Costs

- 2× Starter web service = $14/mo
- 1 GB persistent disk = $0.25/mo
- Free Key Value (25 MB, plenty for OTPs) = $0/mo
- **Total ≈ $14.25/mo**

The API runs 24/7 by design — Baileys must hold the WhatsApp socket open, so do **not** drop the API to the Free plan (Free services sleep after 15 minutes of inactivity, which would drop the WhatsApp session every idle window).

## Deploying to Railway

Railway is a great fit for OtpWave because the API needs a long-lived container with a persistent disk for Baileys auth state. You'll create **three services** in one project: `redis`, `api`, and `web`.

### 1. Create the project

```bash
# (optional) install the CLI
npm i -g @railway/cli

railway login
railway init               # creates a new project, asks you to link this repo
```

Or do it from the dashboard: **New Project → Deploy from GitHub repo → mohammadalibalwe48-hub/Whatsappppp**.

### 2. Add Redis

In the project, click **+ New → Database → Add Redis**. Railway provisions a managed Redis instance and exposes `REDIS_URL` automatically.

### 3. Create the API service

1. **+ New → GitHub Repo →** pick this repo.
2. Open the service's **Settings** tab.
3. Under **Source**, set **Root Directory** to `api`. Railway will pick up `api/railway.json` and `api/Dockerfile`.
4. Under **Networking**, click **Generate Domain** (e.g. `otpwave-api.up.railway.app`).
5. Under **Volumes**, attach a volume mounted at `/data/sessions` (1 GB is plenty). This is where Baileys persists pairing credentials — without it, every restart forces users to re-pair.
6. Under **Variables**, set:

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `API_CORS_ORIGINS` | `https://<your-web-domain>` |
   | `REDIS_URL` | `${{Redis.REDIS_URL}}` (Railway variable reference) |
   | `SUPABASE_URL` | from Supabase **Project Settings → API** |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase (keep secret) |
   | `SESSION_ENCRYPTION_KEY` | `openssl rand -hex 32` |
   | `WEBHOOK_SIGNING_PEPPER` | any long random string |
   | `WHATSAPP_SESSIONS_DIR` | `/data/sessions` |

   Optional knobs: `OTP_DEFAULT_LENGTH`, `OTP_DEFAULT_TTL_SECONDS`, `OTP_MAX_ATTEMPTS`, `OTP_RESEND_COOLDOWN_SECONDS`, `RATE_LIMIT_SEND_PER_MIN`, `RATE_LIMIT_VERIFY_PER_MIN`.

   You do **not** need to set `PORT` — Railway injects it and the API picks it up automatically.

7. Click **Deploy**. The healthcheck (`/health`) should turn green.

### 4. Create the Web service

1. **+ New → GitHub Repo →** same repo.
2. **Settings → Source → Root Directory** = `web`.
3. **Settings → Networking → Generate Domain**.
4. **Settings → Variables**:

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase (anon key, safe to ship to the browser) |
   | `NEXT_PUBLIC_API_URL` | `https://<api-service-domain>` (from step 3.4) |
   | `NEXT_PUBLIC_SITE_URL` | `https://<this-web-domain>` |

   These four `NEXT_PUBLIC_*` vars are also exposed to the Docker build as build-args (see `web/Dockerfile`) — Railway passes service variables through automatically.

5. Click **Deploy**.

### 5. Wire the two together

Once the web service has a public URL, go back to the **API** service variables and update `API_CORS_ORIGINS` to that URL, then redeploy the API.

### 6. First-time sanity check

- Visit `https://<web-domain>` → sign up.
- Open **Dashboard → WhatsApp** → click **Generate QR / Reconnect**. Scan with your phone (WhatsApp → Settings → Linked devices). The status pill should go `qr → pairing → connected`.
- **Dashboard → API Keys** → create a key.
- `curl -X POST https://<api-domain>/v1/otp/send -H "X-API-Key: <key>" -H "Content-Type: application/json" -d '{"phoneNumber":"+1...","appName":"Test"}'` — you should receive an OTP on the linked WhatsApp number.

### Costs

At hobby scale: ~$5/month for Railway's Hobby plan (which covers all three services and Redis). The API runs 24/7 by design — Baileys must hold the WhatsApp socket open, so do **not** enable Railway's serverless/sleep mode for the API service.

## Using the API

Sign in to the dashboard, connect WhatsApp by scanning the QR code from your phone, then create an API key from **Dashboard → API Keys**. With the key in hand:

```bash
# Send an OTP
curl -X POST http://localhost:4000/v1/otp/send \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $OTPWAVE_API_KEY" \
  -d '{ "phoneNumber": "+15555550100", "appName": "Acme" }'

# Verify it
curl -X POST http://localhost:4000/v1/otp/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $OTPWAVE_API_KEY" \
  -d '{ "phoneNumber": "+15555550100", "code": "123456" }'
```

The full reference, plus Node.js and Python snippets, live in **Dashboard → Documentation**.

## Webhooks

Add an endpoint from **Dashboard → Webhooks**. OtpWave POSTs a JSON payload signed with HMAC-SHA256 to your URL whenever a subscribed event fires (`otp.sent`, `otp.verified`, `otp.failed`, …). The signature header looks like:

```
x-otpwave-signature: t=1700000000,v1=<hex>
x-otpwave-event: otp.verified
```

To verify, recompute `HMAC_SHA256(secret + '.' + WEBHOOK_SIGNING_PEPPER, "<timestamp>.<raw_body>")` and compare in constant time.

## Security checklist

- [x] OTPs are stored as bcrypt hashes; the plaintext is only ever sent to the recipient via WhatsApp.
- [x] API keys are stored as SHA-256 hashes; the full secret is only revealed once.
- [x] Webhook payloads carry a signed `x-otpwave-signature` header with a peppered HMAC.
- [x] Per-key sliding-window rate limiting (Redis) on both `send` and `verify`.
- [x] Supabase row-level security restricts every read to the authenticated user.
- [x] Session credentials (Baileys auth state) are persisted to a volume — mount an encrypted volume in production.
- [x] Every OTP and webhook delivery is recorded in `otp_logs` / `webhook_deliveries` with IP and user agent.

## Production checklist

1. Provide a managed Redis (Upstash, Aiven, ElastiCache, …) via `REDIS_URL`.
2. Mount a persistent, ideally encrypted, volume at `WHATSAPP_SESSIONS_DIR` so Baileys credentials survive restarts.
3. Set a long, random `SESSION_ENCRYPTION_KEY` and `WEBHOOK_SIGNING_PEPPER`.
4. Front the API with HTTPS (caddy, nginx, or your platform's TLS terminator).
5. Configure `API_CORS_ORIGINS` with the public origin of your dashboard.
6. Lower `RATE_LIMIT_SEND_PER_MIN` if you intend to expose the API to untrusted clients.
7. Optionally route the API behind a queue (e.g. BullMQ) if you expect spikes — the in-process webhook dispatcher already retries with exponential backoff, but a queue gives you back-pressure.

## License

MIT.
