import { NextFunction, Request, Response } from "express";
import { hashApiKey } from "../lib/crypto";
import { getSupabase, supabaseAvailable } from "../lib/supabase";
import { HttpError } from "./errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      apiKey?: { id: string; userId: string; name: string; prefix: string };
    }
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
        .select("id,user_id,name,prefix,revoked_at")
        .eq("key_hash", hash)
        .maybeSingle();
      if (error || !data) return next(new HttpError(401, "Invalid API key"));
      if (data.revoked_at) return next(new HttpError(401, "API key revoked"));

      req.userId = data.user_id;
      req.apiKey = {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        prefix: data.prefix
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
