import { NextFunction, Request, Response } from "express";
import type { OtpAlphabet } from "../lib/crypto";
import { hashApiKey } from "../lib/crypto";
import { getSupabase, supabaseAvailable } from "../lib/supabase";
import { HttpError } from "./errors";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
    apiKey?: {
      id: string;
      userId: string;
      name: string;
      prefix: string;
      defaultOtpLength: number;
      defaultOtpAlphabet: OtpAlphabet;
    };
  }
}

/**
 * Authenticate dashboard requests using the Supabase JWT in the Authorization
 * header. The token is verified server-side via the Supabase Auth API.
 */
export function requireDashboardAuth() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return next(new HttpError(401, "Missing bearer token"));
    }
    if (!supabaseAvailable()) {
      return next(new HttpError(500, "Supabase is not configured on the server"));
    }
    const token = header.slice("Bearer ".length).trim();
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) {
        return next(new HttpError(401, "Invalid or expired token"));
      }
      req.userId = data.user.id;
      next();
    } catch (err) {
      next(new HttpError(401, "Invalid token"));
    }
  };
}

/**
 * Authenticate public API requests using an X-API-Key (or Authorization: Bearer)
 * header. Hashes the key and looks it up via the api_keys table. Records
 * last_used_at on a best-effort basis.
 */
export function requireApiKey() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const raw =
      (req.headers["x-api-key"] as string | undefined) ??
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice("Bearer ".length).trim()
        : undefined);
    if (!raw) return next(new HttpError(401, "Missing API key"));
    if (!supabaseAvailable()) return next(new HttpError(500, "Server misconfigured"));

    const hash = hashApiKey(raw);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("api_keys")
        .select("id,user_id,name,prefix,revoked_at,default_otp_length,default_otp_alphabet")
        .eq("key_hash", hash)
        .maybeSingle();
      if (error || !data) return next(new HttpError(401, "Invalid API key"));
      if (data.revoked_at) return next(new HttpError(401, "API key revoked"));

      req.userId = data.user_id;
      req.apiKey = {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        prefix: data.prefix,
        defaultOtpLength: (data.default_otp_length as number | null) ?? 6,
        defaultOtpAlphabet:
          ((data.default_otp_alphabet as OtpAlphabet | null) ?? "numeric")
      };
      // Best-effort touch — don't await.
      supabase
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", data.id)
        .then(() => undefined);
      next();
    } catch (err) {
      next(new HttpError(500, "Failed to authenticate API key"));
    }
  };
}

/**
 * Check if current user is an admin (middleware that doesn't block - just adds flag)
 */
export function requireAdmin() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.userId) {
      return next(new HttpError(401, "Authentication required"));
    }
    if (!supabaseAvailable()) {
      return next(new HttpError(500, "Supabase is not configured"));
    }
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("admins")
        .select("id,role")
        .eq("user_id", req.userId)
        .maybeSingle();
      
      if (error || !data) {
        return next(new HttpError(403, "Admin access required"));
      }
      
      (req as any).isAdmin = true;
      (req as any).isSuperAdmin = data.role === 'super_admin';
      (req as any).adminRole = data.role;
      next();
    } catch (err) {
      next(new HttpError(500, "Failed to verify admin status"));
    }
  };
}

/**
 * Require super_admin role specifically
 */
export function requireSuperAdmin() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.userId) {
      return next(new HttpError(401, "Authentication required"));
    }
    if (!supabaseAvailable()) {
      return next(new HttpError(500, "Supabase is not configured"));
    }
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("admins")
        .select("id,role")
        .eq("user_id", req.userId)
        .eq("role", "super_admin")
        .maybeSingle();
      
      if (error || !data) {
        return next(new HttpError(403, "Super admin access required"));
      }
      
      (req as any).isAdmin = true;
      (req as any).isSuperAdmin = true;
      (req as any).adminRole = data.role;
      next();
    } catch (err) {
      next(new HttpError(500, "Failed to verify super admin status"));
    }
  };
}
