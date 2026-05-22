import { Router } from "express";
import { z } from "zod";
import { requireSuperAdmin } from "../middleware/auth";
import { HttpError } from "../middleware/errors";
import { getSupabase, supabaseAvailable } from "../lib/supabase";

export const adminRouter = Router();

adminRouter.use(requireSuperAdmin());

function db() {
  if (!supabaseAvailable()) throw new HttpError(500, "Supabase not configured");
  return getSupabase();
}

// --- Get all users with their admin status ---
adminRouter.get("/users", async (req, res, next) => {
  try {
    const supabase = db();
    const page = Math.max(0, Number(req.query.page ?? 0));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25)));

    // Get all users from auth.users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) throw authError;

    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,full_name,avatar_url,created_at")
      .order("created_at", { ascending: false })
      .range(page * limit, page * limit + limit - 1);
    if (profileError) throw profileError;

    // Get all admins
    const { data: admins, error: adminError } = await supabase
      .from("admins")
      .select("user_id,role,created_at,created_by");
    if (adminError) throw adminError;

    // Merge data
    const adminMap = new Map(admins?.map(a => [a.user_id, a]) ?? []);
    const users = (profiles ?? []).map(profile => ({
      ...profile,
      isAdmin: adminMap.has(profile.id),
      adminRole: adminMap.get(profile.id)?.role ?? null,
      adminSince: adminMap.get(profile.id)?.created_at ?? null
    }));

    res.json({ ok: true, users, total: profiles?.length ?? 0, page, limit });
  } catch (err) {
    next(err);
  }
});

// --- Get all admins ---
adminRouter.get("/admins", async (req, res, next) => {
  try {
    const supabase = db();
    const { data, error } = await supabase
      .from("admins")
      .select(`
        id,
        user_id,
        email,
        role,
        created_at,
        created_by,
        profiles:user_id (
          email,
          full_name,
          avatar_url
        )
      `)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ ok: true, admins: data ?? [] });
  } catch (err) {
    next(err);
  }
});

// --- Add/Update admin ---
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
      .upsert({
        user_id: body.userId,
        email: body.email,
        role: body.role
      })
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, admin: data });
  } catch (err) {
    next(err);
  }
});

// --- Remove admin ---
adminRouter.delete("/admins/:userId", async (req, res, next) => {
  try {
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

// --- Get system stats ---
adminRouter.get("/stats", async (req, res, next) => {
  try {
    const supabase = db();

    // Get total users
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const totalUsers = authUsers?.users?.length ?? 0;

    // Get total admins
    const { count: totalAdmins } = await supabase
      .from("admins")
      .select("id", { count: "exact", head: true });

    // Get total OTPs in last 30 days
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: otpLogs } = await supabase
      .from("otp_logs")
      .select("status,created_at")
      .gte("created_at", since);

    const otpStats = {
      sent: otpLogs?.length ?? 0,
      verified: otpLogs?.filter(l => l.status === "verified").length ?? 0,
      failed: otpLogs?.filter(l => l.status === "failed").length ?? 0
    };

    // Get total API keys
    const { count: totalApiKeys } = await supabase
      .from("api_keys")
      .select("id", { count: "exact", head: true })
      .is("revoked_at", null);

    // Get total webhooks
    const { count: totalWebhooks } = await supabase
      .from("webhook_endpoints")
      .select("id", { count: "exact", head: true });

    res.json({
      ok: true,
      stats: {
        totalUsers,
        totalAdmins: totalAdmins ?? 0,
        totalApiKeys: totalApiKeys ?? 0,
        totalWebhooks: totalWebhooks ?? 0,
        otpStats: {
          last30Days: otpStats
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// --- Get all OTP logs (admin view) ---
adminRouter.get("/otp-logs", async (req, res, next) => {
  try {
    const supabase = db();
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25)));
    const page = Math.max(0, Number(req.query.page ?? 0));
    const status = typeof req.query.status === "string" ? req.query.status : null;

    let query = supabase
      .from("otp_logs")
      .select(
        "id,phone_number,status,attempts,app_name,delivered_at,verified_at,expires_at,created_at,failure_reason,user_id",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(page * limit, page * limit + limit - 1);

    if (status) query = query.eq("status", status);

    const { data, count, error } = await query;
    if (error) throw error;
    res.json({ ok: true, logs: data ?? [], total: count ?? 0, page, limit });
  } catch (err) {
    next(err);
  }
});

// --- Suspend/Unsuspend user ---
adminRouter.patch("/users/:userId/suspend", async (req, res, next) => {
  try {
    const supabase = db();
    const { suspend } = req.body;
    
    if (suspend === undefined) {
      throw new HttpError(400, "Missing 'suspend' field");
    }

    const { data, error } = await supabase.auth.admin.updateUserById(
      req.params.userId,
      { ban_duration: suspend ? "9000000000" : "none" }
    );
    
    if (error) throw error;
    res.json({ ok: true, user: data.user });
  } catch (err) {
    next(err);
  }
});

// --- Delete user ---
adminRouter.delete("/users/:userId", async (req, res, next) => {
  try {
    const supabase = db();
    const { error } = await supabase.auth.admin.deleteUser(req.params.userId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});