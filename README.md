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
