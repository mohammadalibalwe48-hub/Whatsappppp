import { getKv } from "../lib/redis";
import { getSupabase } from "../lib/supabase";
import { sessionManager } from "../whatsapp/sessionManager";
import { env } from "../config/env";

export async function getSystemStatus() {
  const supabase = getSupabase();
  const kv = getKv();
  let kvReady = kv.ready;
  let kvPingMs: number | null = null;
  try {
    const t = Date.now();
    await kv.set("__admin_healthcheck__", "1", 5);
    kvPingMs = Date.now() - t;
  } catch {
    kvReady = false;
  }

  let supabaseReady = false;
  let supabasePingMs: number | null = null;
  try {
    const t = Date.now();
    const { error } = await supabase
      .from("profiles")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    supabasePingMs = Date.now() - t;
    supabaseReady = !error;
  } catch {
    supabaseReady = false;
  }

  const sessions = sessionManager.getAllStates();
  let connected = 0, qr = 0, disconnected = 0;
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i].status;
    if (s === "connected") connected++;
    else if (s === "qr") qr++;
    else if (s === "disconnected") disconnected++;
  }

  return {
    env: env.NODE_ENV,
    nodeVersion: process.version,
    uptimeSeconds: Math.floor(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    kv: { ready: kvReady, pingMs: kvPingMs },
    supabase: { ready: supabaseReady, pingMs: supabasePingMs },
    corsOrigins: env.CORS_ORIGINS,
    whatsapp: {
      totalActive: sessions.length,
      connected,
      qr,
      disconnected
    }
  };
}
