import { Router } from "express";
import { z } from "zod";
import { generateApiKey, generateWebhookSecret } from "../lib/crypto";
import { requireDashboardAuth } from "../middleware/auth";
import { HttpError } from "../middleware/errors";
import { getSupabase, supabaseAvailable } from "../lib/supabase";
import { sessionManager } from "../whatsapp/sessionManager";
import { sendOtp, verifyOtp, lookupOtp } from "../otp/service";

export const dashboardRouter = Router();

dashboardRouter.use(requireDashboardAuth());

function db() {
  if (!supabaseAvailable()) throw new HttpError(500, "Supabase not configured");
  return getSupabase();
}

// --- WhatsApp session ---------------------------------------------------------

dashboardRouter.get("/whatsapp/session", async (req, res, next) => {
  try {
    const state = sessionManager.getState(req.userId!) ?? {
      userId: req.userId!,
      status: "disconnected" as const,
      qrDataUrl: null,
      phoneNumber: null,
      lastError: null,
      updatedAt: new Date().toISOString()
    };
    res.json({ ok: true, session: state });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.post("/whatsapp/session/start", async (req, res, next) => {
  try {
    const state = await sessionManager.start(req.userId!);
    res.json({ ok: true, session: state });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.post("/whatsapp/session/stop", async (req, res, next) => {
  try {
    await sessionManager.stop(req.userId!);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.post("/whatsapp/session/logout", async (req, res, next) => {
  try {
    await sessionManager.logout(req.userId!);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- API keys -----------------------------------------------------------------

dashboardRouter.get("/api-keys", async (req, res, next) => {
  try {
    const supabase = db();
    const { data, error } = await supabase
      .from("api_keys")
      .select(
        "id,name,prefix,created_at,last_used_at,revoked_at,default_otp_length,default_otp_alphabet"
      )
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ ok: true, apiKeys: data ?? [] });
  } catch (err) {
    next(err);
  }
});

const otpAlphabetSchema = z.enum(["numeric", "alphanumeric", "alphabetic"]);
const otpLengthSchema = z.number().int().min(4).max(10);

const createApiKeySchema = z.object({
  name: z.string().min(1).max(80),
  defaultOtpLength: otpLengthSchema.optional(),
  defaultOtpAlphabet: otpAlphabetSchema.optional()
});

const updateApiKeySchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    defaultOtpLength: otpLengthSchema.optional(),
    defaultOtpAlphabet: otpAlphabetSchema.optional()
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.defaultOtpLength !== undefined ||
      v.defaultOtpAlphabet !== undefined,
    { message: "No fields to update" }
  );

dashboardRouter.post("/api-keys", async (req, res, next) => {
  try {
    const body = createApiKeySchema.parse(req.body ?? {});
    const supabase = db();
    const { publicKey, prefix, hash } = generateApiKey();
    const { data, error } = await supabase
      .from("api_keys")
      .insert({
        user_id: req.userId!,
        name: body.name,
        prefix,
        key_hash: hash,
        default_otp_length: body.defaultOtpLength ?? 6,
        default_otp_alphabet: body.defaultOtpAlphabet ?? "numeric"
      })
      .select(
        "id,name,prefix,created_at,last_used_at,revoked_at,default_otp_length,default_otp_alphabet"
      )
      .single();
    if (error) throw error;
    res.json({ ok: true, apiKey: data, secret: publicKey });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.patch("/api-keys/:id", async (req, res, next) => {
  try {
    const body = updateApiKeySchema.parse(req.body ?? {});
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.defaultOtpLength !== undefined) patch.default_otp_length = body.defaultOtpLength;
    if (body.defaultOtpAlphabet !== undefined) patch.default_otp_alphabet = body.defaultOtpAlphabet;

    const supabase = db();
    const { data, error } = await supabase
      .from("api_keys")
      .update(patch)
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .select(
        "id,name,prefix,created_at,last_used_at,revoked_at,default_otp_length,default_otp_alphabet"
      )
      .single();
    if (error) throw error;
    res.json({ ok: true, apiKey: data });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.delete("/api-keys/:id", async (req, res, next) => {
  try {
    const supabase = db();
    const { error } = await supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("user_id", req.userId!);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- OTP logs -----------------------------------------------------------------

dashboardRouter.get("/otp-logs", async (req, res, next) => {
  try {
    const supabase = db();
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25)));
    const page = Math.max(0, Number(req.query.page ?? 0));
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const q = typeof req.query.q === "string" ? req.query.q : null;

    let query = supabase
      .from("otp_logs")
      .select(
        "id,phone_number,status,attempts,resend_count,delivered_at,verified_at,expires_at,created_at,failure_reason,app_name",
        { count: "exact" }
      )
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false })
      .range(page * limit, page * limit + limit - 1);

    if (status) query = query.eq("status", status);
    if (q) query = query.ilike("phone_number", `%${q}%`);

    const { data, count, error } = await query;
    if (error) throw error;
    res.json({ ok: true, logs: data ?? [], total: count ?? 0, page, limit });
  } catch (err) {
    next(err);
  }
});

// --- Analytics ----------------------------------------------------------------

dashboardRouter.get("/analytics/overview", async (req, res, next) => {
  try {
    const supabase = db();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("otp_logs")
      .select("status,created_at")
      .eq("user_id", req.userId!)
      .gte("created_at", since);
    if (error) throw error;

    const rows = data ?? [];
    const totals = { sent: rows.length, verified: 0, failed: 0, expired: 0, pending: 0 };

    // Per-day buckets (last 30 days).
    const buckets: Record<string, { sent: number; verified: number; failed: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { sent: 0, verified: 0, failed: 0 };
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const s = r.status;
      if (s === "verified") totals.verified++;
      else if (s === "failed") totals.failed++;
      else if (s === "expired") totals.expired++;
      else if (s === "pending") totals.pending++;

      const key = (r.created_at as string).slice(0, 10);
      const bucket = buckets[key];
      if (bucket) {
        bucket.sent += 1;
        if (s === "verified") bucket.verified += 1;
        if (s === "failed") bucket.failed += 1;
      }
    }

    const verificationRate = totals.sent > 0 ? totals.verified / totals.sent : 0;
    const series = Object.entries(buckets).map(([date, v]) => ({ date, ...v }));

    res.json({ ok: true, totals, verificationRate, series });
  } catch (err) {
    next(err);
  }
});

// --- Webhooks -----------------------------------------------------------------

const webhookEventEnum = z.enum([
  "otp.sent",
  "otp.verified",
  "otp.failed",
  "whatsapp.connected",
  "whatsapp.disconnected",
  "api.limit_warning"
]);

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(webhookEventEnum).min(1)
});

dashboardRouter.get("/webhooks", async (req, res, next) => {
  try {
    const supabase = db();
    const { data, error } = await supabase
      .from("webhook_endpoints")
      .select("id,url,events,active,created_at")
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ ok: true, webhooks: data ?? [] });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.post("/webhooks", async (req, res, next) => {
  try {
    const body = createWebhookSchema.parse(req.body ?? {});
    const supabase = db();
    const secret = generateWebhookSecret();
    const { data, error } = await supabase
      .from("webhook_endpoints")
      .insert({
        user_id: req.userId!,
        url: body.url,
        events: body.events,
        secret,
        active: true
      })
      .select("id,url,events,active,created_at")
      .single();
    if (error) throw error;
    res.json({ ok: true, webhook: data, secret });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.patch("/webhooks/:id", async (req, res, next) => {
  try {
    const patchSchema = z.object({
      active: z.boolean().optional(),
      events: z.array(webhookEventEnum).min(1).optional(),
      url: z.string().url().optional()
    });
    const body = patchSchema.parse(req.body ?? {});
    const supabase = db();
    const { data, error } = await supabase
      .from("webhook_endpoints")
      .update(body)
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .select("id,url,events,active,created_at")
      .single();
    if (error) throw error;
    res.json({ ok: true, webhook: data });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.delete("/webhooks/:id", async (req, res, next) => {
  try {
    const supabase = db();
    const { error } = await supabase
      .from("webhook_endpoints")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.userId!);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/webhooks/:id/deliveries", async (req, res, next) => {
  try {
    const supabase = db();
    const { data, error } = await supabase
      .from("webhook_deliveries")
      .select("id,event,status_code,attempt,delivered,error,created_at")
      .eq("endpoint_id", req.params.id)
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ ok: true, deliveries: data ?? [] });
  } catch (err) {
    next(err);
  }
});

// --- Playground (in-dashboard test sender) -----------------------------------
// Picks an active API key automatically so the user doesn't have to paste theirs.

async function pickApiKey(userId: string) {
  const supabase = db();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id,name,prefix,default_otp_length,default_otp_alphabet")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new HttpError(
      400,
      "You need at least one active API key to use the playground. Create one first."
    );
  }
  return data;
}

dashboardRouter.post("/playground/send", async (req, res, next) => {
  try {
    const body = z
      .object({
        phoneNumber: z.string().min(6).max(20),
        appName: z.string().max(60).optional(),
        length: z.number().int().min(4).max(10).optional(),
        alphabet: z.enum(["numeric", "alphanumeric", "alphabetic"]).optional(),
        ttlSeconds: z.number().int().min(30).max(60 * 60).optional()
      })
      .parse(req.body ?? {});
    const key = await pickApiKey(req.userId!);
    const result = await sendOtp({
      userId: req.userId!,
      apiKeyId: key.id,
      phoneNumber: body.phoneNumber,
      appName: body.appName ?? "OtpWave Playground",
      length: body.length ?? key.default_otp_length ?? 6,
      alphabet: body.alphabet ?? key.default_otp_alphabet ?? "numeric",
      ttlSeconds: body.ttlSeconds,
      ip: req.ip,
      userAgent: req.headers["user-agent"] ?? null
    });
    res.json({
      ok: true,
      ...result,
      apiKey: { id: key.id, name: key.name, prefix: key.prefix }
    });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.post("/playground/verify", async (req, res, next) => {
  try {
    const body = z
      .object({
        otpId: z.string().optional(),
        phoneNumber: z.string().min(6).max(20).optional(),
        code: z.string().min(4).max(10)
      })
      .refine((v) => v.otpId || v.phoneNumber, {
        message: "Either otpId or phoneNumber is required"
      })
      .parse(req.body ?? {});
    const key = await pickApiKey(req.userId!);
    const result = await verifyOtp({
      userId: req.userId!,
      apiKeyId: key.id,
      otpId: body.otpId,
      phoneNumber: body.phoneNumber,
      code: body.code
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/playground/lookup", async (req, res, next) => {
  try {
    const otpId = String(req.query.otpId ?? "");
    if (!otpId) throw new HttpError(400, "otpId required");
    const record = await lookupOtp({ userId: req.userId!, otpId });
    res.json({ ok: true, record });
  } catch (err) {
    next(err);
  }
});

// --- Onboarding progress -----------------------------------------------------

dashboardRouter.get("/onboarding", async (req, res, next) => {
  try {
    const supabase = db();
    const session = sessionManager.getState(req.userId!);
    const waConnected = session?.status === "connected";

    const [{ count: keysCount }, { count: logsCount }, { count: webhooksCount }] =
      await Promise.all([
        supabase
          .from("api_keys")
          .select("id", { count: "exact", head: true })
          .eq("user_id", req.userId!)
          .is("revoked_at", null),
        supabase
          .from("otp_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", req.userId!),
        supabase
          .from("webhook_endpoints")
          .select("id", { count: "exact", head: true })
          .eq("user_id", req.userId!)
          .eq("active", true)
      ]);

    const steps = [
      {
        id: "pair_whatsapp",
        title: "Pair your WhatsApp",
        description: "Link your phone to OtpWave to send OTPs.",
        href: "/dashboard/whatsapp",
        done: waConnected
      },
      {
        id: "create_key",
        title: "Create your first API key",
        description: "Generate credentials so your app can authenticate.",
        href: "/dashboard/api-keys",
        done: (keysCount ?? 0) > 0
      },
      {
        id: "send_otp",
        title: "Send a test OTP",
        description: "Try the playground to verify end-to-end delivery.",
        href: "/dashboard/playground",
        done: (logsCount ?? 0) > 0
      },
      {
        id: "webhook",
        title: "Add a webhook (optional)",
        description: "Get notified when OTPs are sent, verified, or fail.",
        href: "/dashboard/webhooks",
        done: (webhooksCount ?? 0) > 0
      }
    ];

    const completed = steps.filter((s) => s.done).length;
    res.json({
      ok: true,
      steps,
      completed,
      total: steps.length,
      finished: completed === steps.length
    });
  } catch (err) {
    next(err);
  }
});

// --- Profile + account management --------------------------------------------

dashboardRouter.patch("/profile", async (req, res, next) => {
  try {
    const body = z
      .object({
        full_name: z.string().max(120).nullable().optional(),
        avatar_url: z.string().url().nullable().optional()
      })
      .parse(req.body ?? {});

    const supabase = db();
    const patch: Record<string, unknown> = {};
    if (body.full_name !== undefined) patch.full_name = body.full_name;
    if (body.avatar_url !== undefined) patch.avatar_url = body.avatar_url;

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", req.userId!);
      if (error) throw error;
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.delete("/account", async (req, res, next) => {
  try {
    const userId = req.userId!;
    const supabase = db();

    // Stop any active WhatsApp session before tearing down auth state.
    try {
      await sessionManager.stop(userId);
    } catch {
      // best-effort
    }

    // Delete the auth row (RLS cascades remove profile/api_keys/otp_logs/webhooks
    // via the user_id foreign keys with ON DELETE CASCADE).
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
