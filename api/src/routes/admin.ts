import { Router } from "express";
import { z } from "zod";
import { requireDashboardAuth, requireSuperAdmin } from "../middleware/auth";
import { HttpError } from "../middleware/errors";
import { getSupabase, supabaseAvailable } from "../lib/supabase";
import { sessionManager } from "../whatsapp/sessionManager";
import { getSystemStatus } from "../services/system.service";

export const adminRouter = Router();

// First authenticate via Supabase JWT (sets req.userId), THEN check admin role.
// Without requireDashboardAuth first, req.userId is always undefined and every
// admin endpoint returns 401.
adminRouter.use(requireDashboardAuth(), requireSuperAdmin());

function db() {
  if (!supabaseAvailable()) throw new HttpError(500, "Supabase not configured");
  return getSupabase();
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

adminRouter.get("/users", async (req, res, next) => {
  try {
    const supabase = db();
    const page = Math.max(0, Number(req.query.page ?? 0));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    let q = supabase
      .from("profiles")
      .select("id,email,full_name,avatar_url,created_at", { count: "exact" })
      .order("created_at", { ascending: false });

    if (search) {
      q = q.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    }

    const { data: profiles, count, error: profileError } = await q.range(
      page * limit,
      page * limit + limit - 1
    );
    if (profileError) throw profileError;

    const { data: admins, error: adminError } = await supabase
      .from("admins")
      .select("user_id,role,created_at,created_by");
    if (adminError) throw adminError;

    const adminMap = new Map((admins ?? []).map((a) => [a.user_id, a]));
    const users = (profiles ?? []).map((profile) => ({
      ...profile,
      isAdmin: adminMap.has(profile.id),
      adminRole: adminMap.get(profile.id)?.role ?? null,
      adminSince: adminMap.get(profile.id)?.created_at ?? null
    }));

    res.json({ ok: true, users, total: count ?? users.length, page, limit });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/users/:userId", async (req, res, next) => {
  try {
    const supabase = db();
    const userId = req.params.userId;

    const [profileRes, authRes, adminRes, keysRes, logsRes, hooksRes] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id,email,full_name,avatar_url,created_at,updated_at")
          .eq("id", userId)
          .maybeSingle(),
        supabase.auth.admin.getUserById(userId),
        supabase
          .from("admins")
          .select("role,created_at,created_by")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("api_keys")
          .select(
            "id,name,prefix,created_at,last_used_at,revoked_at,default_otp_length,default_otp_alphabet"
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("otp_logs")
          .select("id,phone_number,status,app_name,created_at,failure_reason")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("webhook_endpoints")
          .select("id,url,events,active,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
      ]);

    if (profileRes.error) throw profileRes.error;
    if (!profileRes.data) throw new HttpError(404, "User not found");

    const session = sessionManager.getState(userId);
    const banned_until =
      (authRes.data?.user as { banned_until?: string } | undefined)
        ?.banned_until ?? null;

    res.json({
      ok: true,
      user: {
        ...profileRes.data,
        banned_until,
        isAdmin: !!adminRes.data,
        adminRole: adminRes.data?.role ?? null,
        adminSince: adminRes.data?.created_at ?? null
      },
      apiKeys: keysRes.data ?? [],
      otpLogs: logsRes.data ?? [],
      webhooks: hooksRes.data ?? [],
      whatsappSession: session
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/users/:userId/suspend", async (req, res, next) => {
  try {
    const supabase = db();
    const { suspend } = req.body ?? {};
    if (typeof suspend !== "boolean") {
      throw new HttpError(400, "Missing or invalid 'suspend' (boolean)");
    }
    const { data, error } = await supabase.auth.admin.updateUserById(
      req.params.userId,
      { ban_duration: suspend ? "876000h" : "none" }
    );
    if (error) throw error;
    res.json({ ok: true, user: data.user });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/users/:userId/password-reset", async (req, res, next) => {
  try {
    const supabase = db();
    const userRes = await supabase.auth.admin.getUserById(req.params.userId);
    if (userRes.error || !userRes.data?.user?.email) {
      throw new HttpError(404, "User not found or has no email");
    }
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: userRes.data.user.email
    });
    if (error) throw error;
    res.json({ ok: true, link: data.properties?.action_link ?? null });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/users/:userId", async (req, res, next) => {
  try {
    if (req.params.userId === req.userId) {
      throw new HttpError(400, "Cannot delete yourself");
    }
    const supabase = db();
    const { error } = await supabase.auth.admin.deleteUser(req.params.userId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Admins
// ---------------------------------------------------------------------------

adminRouter.get("/admins", async (req, res, next) => {
  try {
    const supabase = db();
    const { data, error } = await supabase
      .from("admins")
      .select(
        `id,user_id,email,role,created_at,created_by,
         profiles:user_id (email,full_name,avatar_url)`
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ ok: true, admins: data ?? [] });
  } catch (err) {
    next(err);
  }
});

const addAdminSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["admin", "super_admin"]).default("admin")
});

adminRouter.post("/admins", async (req, res, next) => {
  try {
    const body = addAdminSchema.parse(req.body ?? {});
    const supabase = db();
    const { data, error } = await supabase
      .from("admins")
      .upsert(
        {
          user_id: body.userId,
          email: body.email,
          role: body.role,
          created_by: req.userId!
        },
        { onConflict: "email" }
      )
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, admin: data });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/admins/:userId", async (req, res, next) => {
  try {
    const role = req.body?.role;
    if (role !== "admin" && role !== "super_admin") {
      throw new HttpError(400, "role must be 'admin' or 'super_admin'");
    }
    if (req.params.userId === req.userId && role !== "super_admin") {
      throw new HttpError(400, "Cannot demote yourself");
    }
    const supabase = db();
    const { data, error } = await supabase
      .from("admins")
      .update({ role })
      .eq("user_id", req.params.userId)
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, admin: data });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/admins/:userId", async (req, res, next) => {
  try {
    if (req.params.userId === req.userId) {
      throw new HttpError(400, "Cannot remove your own admin role");
    }
    const supabase = db();
    const { error } = await supabase
      .from("admins")
      .delete()
      .eq("user_id", req.params.userId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Stats / system
// ---------------------------------------------------------------------------

adminRouter.get("/stats", async (_req, res, next) => {
  try {
    const supabase = db();
    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const since24 = new Date(Date.now() - 86_400_000).toISOString();

    const [
      authRes,
      adminCountRes,
      apiKeyCountRes,
      hookCountRes,
      logs30Res,
      logs24Res
    ] = await Promise.all([
      supabase.auth.admin.listUsers({ perPage: 1 }),
      supabase.from("admins").select("id", { count: "exact", head: true }),
      supabase
        .from("api_keys")
        .select("id", { count: "exact", head: true })
        .is("revoked_at", null),
      supabase.from("webhook_endpoints").select("id", { count: "exact", head: true }),
      supabase
        .from("otp_logs")
        .select("status,created_at")
        .gte("created_at", since30),
      supabase
        .from("otp_logs")
        .select("status", { count: "exact", head: true })
        .gte("created_at", since24)
    ]);

    const totalUsers = (authRes.data as { total?: number } | undefined)?.total ??
      authRes.data?.users?.length ?? 0;

    const logs30 = logs30Res.data ?? [];
    const otpStats = { sent: logs30.length, verified: 0, failed: 0, expired: 0, pending: 0 };
    for (let i = 0; i < logs30.length; i++) {
      const s = logs30[i].status;
      if (s === "verified") otpStats.verified++;
      else if (s === "failed") otpStats.failed++;
      else if (s === "expired") otpStats.expired++;
      else if (s === "pending") otpStats.pending++;
    }
    const verificationRate =
      otpStats.sent > 0 ? otpStats.verified / otpStats.sent : 0;

    res.json({
      ok: true,
      stats: {
        totalUsers,
        totalAdmins: adminCountRes.count ?? 0,
        totalApiKeys: apiKeyCountRes.count ?? 0,
        totalWebhooks: hookCountRes.count ?? 0,
        otpsLast24h: logs24Res.count ?? 0,
        verificationRate,
        otpStats: { last30Days: otpStats }
      }
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/system", async (_req, res, next) => {
  try {
    const system = await getSystemStatus();
    res.json({
      ok: true,
      system
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// API keys (global)
// ---------------------------------------------------------------------------

adminRouter.get("/api-keys", async (req, res, next) => {
  try {
    const supabase = db();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 100)));
    const page = Math.max(0, Number(req.query.page ?? 0));
    const userId = typeof req.query.userId === "string" ? req.query.userId : null;
    const status = typeof req.query.status === "string" ? req.query.status : null;

    let q = supabase
      .from("api_keys")
      .select(
        `id,name,prefix,user_id,created_at,last_used_at,revoked_at,
         default_otp_length,default_otp_alphabet,
         profiles:user_id (email,full_name)`,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (userId) q = q.eq("user_id", userId);
    if (status === "active") q = q.is("revoked_at", null);
    if (status === "revoked") q = q.not("revoked_at", "is", null);

    const { data, count, error } = await q.range(
      page * limit,
      page * limit + limit - 1
    );
    if (error) throw error;
    res.json({ ok: true, apiKeys: data ?? [], total: count ?? 0, page, limit });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/api-keys/:id/revoke", async (req, res, next) => {
  try {
    const supabase = db();
    const { data, error } = await supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("id,name,prefix,revoked_at")
      .single();
    if (error) throw error;
    res.json({ ok: true, apiKey: data });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// OTP logs (global) + CSV export
// ---------------------------------------------------------------------------

adminRouter.get("/otp-logs", async (req, res, next) => {
  try {
    const supabase = db();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
    const page = Math.max(0, Number(req.query.page ?? 0));
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const userId = typeof req.query.userId === "string" ? req.query.userId : null;
    const phone = typeof req.query.phone === "string" ? req.query.phone.trim() : "";
    const since = typeof req.query.since === "string" ? req.query.since : null;
    const until = typeof req.query.until === "string" ? req.query.until : null;

    let q = supabase
      .from("otp_logs")
      .select(
        `id,user_id,api_key_id,phone_number,status,attempts,app_name,
         delivered_at,verified_at,expires_at,created_at,failure_reason,
         profiles:user_id (email)`,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (status) q = q.eq("status", status);
    if (userId) q = q.eq("user_id", userId);
    if (phone) q = q.ilike("phone_number", `%${phone}%`);
    if (since) q = q.gte("created_at", since);
    if (until) q = q.lte("created_at", until);

    const { data, count, error } = await q.range(
      page * limit,
      page * limit + limit - 1
    );
    if (error) throw error;
    res.json({ ok: true, logs: data ?? [], total: count ?? 0, page, limit });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/otp-logs.csv", async (req, res, next) => {
  try {
    const supabase = db();
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const userId = typeof req.query.userId === "string" ? req.query.userId : null;
    const phone = typeof req.query.phone === "string" ? req.query.phone.trim() : "";
    const since = typeof req.query.since === "string" ? req.query.since : null;
    const until = typeof req.query.until === "string" ? req.query.until : null;

    let q = supabase
      .from("otp_logs")
      .select(
        "id,user_id,api_key_id,phone_number,status,attempts,app_name,delivered_at,verified_at,expires_at,created_at,failure_reason"
      )
      .order("created_at", { ascending: false })
      .limit(10_000);

    if (status) q = q.eq("status", status);
    if (userId) q = q.eq("user_id", userId);
    if (phone) q = q.ilike("phone_number", `%${phone}%`);
    if (since) q = q.gte("created_at", since);
    if (until) q = q.lte("created_at", until);

    const { data, error } = await q;
    if (error) throw error;

    const escape = (v: unknown) => {
      if (v == null) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const cols = [
      "id",
      "user_id",
      "api_key_id",
      "phone_number",
      "status",
      "attempts",
      "app_name",
      "delivered_at",
      "verified_at",
      "expires_at",
      "created_at",
      "failure_reason"
    ];
    const header = cols.join(",");
    const rows = (data ?? []).map((row) =>
      cols.map((c) => escape((row as Record<string, unknown>)[c])).join(",")
    );
    const csv = [header, ...rows].join("\n");

    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader(
      "content-disposition",
      `attachment; filename="otpwave-otp-logs-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`
    );
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// WhatsApp sessions
// ---------------------------------------------------------------------------

adminRouter.get("/sessions", async (_req, res, next) => {
  try {
    const sessions = sessionManager.getAllStates();
    if (sessions.length === 0) {
      return res.json({ ok: true, sessions: [] });
    }
    const supabase = db();
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,email,full_name")
      .in(
        "id",
        sessions.map((s) => s.userId)
      );
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    const enriched = sessions.map((s) => ({
      ...s,
      email: byId.get(s.userId)?.email ?? null,
      fullName: byId.get(s.userId)?.full_name ?? null
    }));
    res.json({ ok: true, sessions: enriched });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/sessions/:userId/disconnect", async (req, res, next) => {
  try {
    await sessionManager.stop(req.params.userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/sessions/:userId/logout", async (req, res, next) => {
  try {
    await sessionManager.logout(req.params.userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Webhooks (global)
// ---------------------------------------------------------------------------

adminRouter.get("/webhooks", async (_req, res, next) => {
  try {
    const supabase = db();
    const [endpointsRes, deliveriesRes] = await Promise.all([
      supabase
        .from("webhook_endpoints")
        .select(
          `id,user_id,url,events,active,created_at,
           profiles:user_id (email,full_name)`
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("webhook_deliveries")
        .select("id,endpoint_id,status_code,error,delivered_at,created_at")
        .order("created_at", { ascending: false })
        .limit(50)
    ]);
    if (endpointsRes.error) throw endpointsRes.error;
    if (deliveriesRes.error) throw deliveriesRes.error;
    res.json({
      ok: true,
      endpoints: endpointsRes.data ?? [],
      recentDeliveries: deliveriesRes.data ?? []
    });
  } catch (err) {
    next(err);
  }
});
