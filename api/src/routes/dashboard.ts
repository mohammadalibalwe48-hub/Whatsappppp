import { Router } from "express";
import { z } from "zod";
import { generateApiKey, generateWebhookSecret } from "../lib/crypto";
import { requireDashboardAuth } from "../middleware/auth";
import { HttpError } from "../middleware/errors";
import { getSupabase, supabaseAvailable } from "../lib/supabase";
import { sessionManager } from "../whatsapp/sessionManager";

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
      .select("id,name,prefix,created_at,last_used_at,revoked_at")
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ ok: true, apiKeys: data ?? [] });
  } catch (err) {
    next(err);
  }
});

const createApiKeySchema = z.object({ name: z.string().min(1).max(80) });

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
        key_hash: hash
      })
      .select("id,name,prefix,created_at,last_used_at,revoked_at")
      .single();
    if (error) throw error;
    res.json({ ok: true, apiKey: data, secret: publicKey });
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
    const totals = {
      sent: rows.length,
      verified: rows.filter((r) => r.status === "verified").length,
      failed: rows.filter((r) => r.status === "failed").length,
      expired: rows.filter((r) => r.status === "expired").length,
      pending: rows.filter((r) => r.status === "pending").length
    };
    const verificationRate = totals.sent > 0 ? totals.verified / totals.sent : 0;

    // Per-day buckets (last 30 days).
    const buckets: Record<string, { sent: number; verified: number; failed: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { sent: 0, verified: 0, failed: 0 };
    }
    for (const r of rows) {
      const key = (r.created_at as string).slice(0, 10);
      const bucket = buckets[key];
      if (!bucket) continue;
      bucket.sent += 1;
      if (r.status === "verified") bucket.verified += 1;
      if (r.status === "failed") bucket.failed += 1;
    }
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
