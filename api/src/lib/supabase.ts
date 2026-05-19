import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import { logger } from "./logger";

let _client: SupabaseClient | null = null;

/**
 * Service-role Supabase client. Used by the API to bypass RLS for trusted,
 * server-side operations (creating API keys, writing OTP logs, etc.). Never
 * expose this to the browser.
 */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  _client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  logger.info("Supabase service-role client initialized");
  return _client;
}

export function supabaseAvailable(): boolean {
  return env.hasSupabase;
}
