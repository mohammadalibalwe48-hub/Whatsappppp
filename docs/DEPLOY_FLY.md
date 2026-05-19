# Deploying OtpWave to Fly.io + Upstash + Supabase

This is the recommended low-cost stack for OtpWave:

| Component | Provider | Why |
| --- | --- | --- |
| Auth + Postgres | **Supabase** (free tier) | RLS for tenant isolation + first-party auth |
| Redis (OTPs, rate limits, cooldowns) | **Upstash Redis** (free tier — 10 k cmds/day, 256 MB) | Serverless, TLS by default, generous free quota |
| API container (Baileys) | **Fly.io** (`shared-cpu-1x`, 256 MB, always-on) | Holds a long-lived WhatsApp socket; needs persistent disk for auth state |
| Web container (Next.js) | **Fly.io** (`shared-cpu-1x`, 256 MB, scale-to-zero OK) | Stateless dashboard |

> The OtpWave app code is provider-agnostic. It speaks vanilla Redis (`ioredis`,
> which transparently handles Upstash's `rediss://` TLS URLs), vanilla Supabase,
> and reads `WHATSAPP_SESSIONS_DIR` from the env so the Baileys session
> directory can live on any mounted volume.

---

## 0. Install the Fly CLI

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh
```

Then `fly auth login` (signs you in via your browser).

---

## 1. Provision Supabase

1. Create a project at <https://supabase.com>.
2. From **Project Settings → API** copy:
   - `Project URL` → you'll use it as `SUPABASE_URL` (and `NEXT_PUBLIC_SUPABASE_URL`).
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never ship to the browser).
3. Apply the schema migration:

   ```bash
   # Easiest: paste supabase/migrations/20260519000001_init.sql into the
   # Supabase SQL editor and click Run.
   #
   # Or via the Supabase CLI:
   supabase db push
   ```

4. Don't update **Auth → URL Configuration** yet — you'll do that in step 6 after the web app's Fly URL is known.

---

## 2. Provision Upstash Redis

1. Create a Redis database at <https://console.upstash.com>.
2. From the database detail page, copy the connection string under **"Connect → Node.js → ioredis"**. It looks like:

   ```
   rediss://default:<password>@<region>-<id>.upstash.io:6379
   ```

   The `rediss://` (with two S's) is important — it's TLS. The app's
   `ioredis` client handles TLS automatically when it sees that scheme.

3. Optional: enable **"Eviction"** and pick **`allkeys-lru`** so old rate-limit keys don't cause writes to fail when you hit the 256 MB limit.

---

## 3. Create the two Fly apps

From the repo root:

```bash
fly apps create otpwave-api
fly apps create otpwave-web
```

(Pick different names if those are taken — just remember to use your names
everywhere below.)

### Create a persistent volume for Baileys session data

Baileys writes the WhatsApp pairing credentials to disk. Without a volume,
every deploy / restart forces users to re-pair their WhatsApp.

```bash
fly volumes create otpwave_sessions \
  --app otpwave-api \
  --size 1 \
  --region iad
```

`--size 1` is 1 GB — more than enough for hundreds of session directories.
Fly's free allowance includes 3 GB of volume storage.

The volume name (`otpwave_sessions`) and mount path (`/data`) are already
wired up in [`api/fly.toml`](../api/fly.toml).

---

## 4. Set secrets on the API app

`fly secrets set` stores values encrypted and exposes them as env vars at
runtime — they're not baked into the image, so it's safe for the
`service_role` key.

```bash
fly secrets set --app otpwave-api \
  SUPABASE_URL="https://<your-project-ref>.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
  REDIS_URL="rediss://default:<password>@<region>-<id>.upstash.io:6379" \
  SESSION_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  WEBHOOK_SIGNING_PEPPER="$(openssl rand -hex 16)" \
  API_CORS_ORIGINS="https://otpwave-web.fly.dev"
```

Sanity-check what's set:

```bash
fly secrets list --app otpwave-api
```

---

## 5. Deploy the API

```bash
fly deploy --app otpwave-api --config api/fly.toml
```

Fly builds the Dockerfile in `api/`, pushes the image to its registry, and
boots the machine. Because of [`api/fly.toml`](../api/fly.toml):

- The machine is **always-on** (`auto_stop_machines = "off"`,
  `min_machines_running = 1`). This is required — Baileys needs a long-lived
  TCP socket to WhatsApp's servers.
- The volume mounts at `/data`, and `WHATSAPP_SESSIONS_DIR=/data/sessions`
  is set, so Baileys persists pairing credentials there.
- Fly probes `GET /health` every 30 s.

Verify:

```bash
curl https://otpwave-api.fly.dev/health
# {"ok":true,"service":"otpwave-api","kvReady":true,"supabaseConfigured":true,...}
```

If `kvReady` is `false`, Upstash isn't reachable — double-check the
`REDIS_URL` (it must start with `rediss://`).

---

## 6. Deploy the web app

The Next.js dashboard inlines `NEXT_PUBLIC_*` env vars **at build time**, so
they have to be passed as Docker build args (not runtime secrets):

```bash
fly deploy --app otpwave-web --config web/fly.toml \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://<your-project-ref>.supabase.co" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>" \
  --build-arg NEXT_PUBLIC_API_URL="https://otpwave-api.fly.dev" \
  --build-arg NEXT_PUBLIC_SITE_URL="https://otpwave-web.fly.dev"
```

Any time you change one of those values you must **redeploy** the web app
(restart isn't enough — they're baked into the JS bundle).

### Wire Supabase Auth to the web URL

In **Supabase → Authentication → URL Configuration**:

- **Site URL** = `https://otpwave-web.fly.dev`
- Add `https://otpwave-web.fly.dev/**` to **Redirect URLs**.

Without this, sign-up confirmation emails redirect to `localhost`.

---

## 7. End-to-end smoke test

1. Visit `https://otpwave-web.fly.dev` and click **Sign up**.
2. Create an account, sign in, and open **Dashboard → WhatsApp**.
3. Scan the QR code with your phone (WhatsApp → Settings → Linked devices → Link a device).
4. Once the dashboard pill flips to **Connected**, hit the API:

   ```bash
   curl -X POST https://otpwave-api.fly.dev/v1/otp/send \
     -H "Authorization: Bearer <your-api-key>" \
     -H "Content-Type: application/json" \
     -d '{"phone": "+1555..."}'
   ```

5. Verify the message lands on the destination phone.

---

## Costs

Free tier as of 2026-05:

- Supabase free: 500 MB DB, 50 k MAUs, plenty for OTP traffic.
- Upstash free: 10 k commands/day, 256 MB, 1 DB.
- Fly free allowance: shared CPU machines + 3 GB volume storage.

A single OTP send + verify is ~5 Redis commands, so 10 k cmd/day comfortably
covers ~2 k OTPs/day. If you outgrow the Upstash free plan, the next tier
(`Pay-as-you-go`) is $0.2 per 100 k commands.

---

## Troubleshooting

**`fly deploy` fails with "no machines configured"**
You created the app but the volume is in a different region than the
machine. Either delete and recreate the volume in `iad` (matching the
`primary_region` in `fly.toml`), or change `primary_region` to match the
volume.

**WhatsApp session keeps disconnecting after deploys**
Check that the volume is actually mounted: `fly ssh console --app
otpwave-api`, then `ls /data/sessions`. If it's empty after every deploy,
the volume isn't attached — `fly volumes list --app otpwave-api` should
show one volume.

**Web app gets 401s from the API**
The browser's `NEXT_PUBLIC_API_URL` must match the API's
`API_CORS_ORIGINS`. After changing either, redeploy the affected app
(restart is not enough for the web app — env vars are inlined at build
time).

**Upstash returns `ECONNRESET` / `read ETIMEDOUT`**
Upstash drops idle connections after ~30 s. `ioredis` reconnects
automatically; the API will log a transient `Redis error` and recover. If
you see this constantly, the Upstash region is probably far from the Fly
region — pick the closest pair.
