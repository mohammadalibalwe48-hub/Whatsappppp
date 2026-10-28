import { McpServer, type AuthInfo, type JSONRPCRequest, type ScopeChallenge } from "@modelcontextprotocol/server";
import net from "net";
import { z } from "zod";
import { generateApiKey, generateWebhookSecret } from "../lib/crypto";
import { getSupabase, supabaseAvailable } from "../lib/supabase";
import { normalizeWhatsappJid, sessionManager, type WhatsappSessionState } from "../whatsapp/sessionManager";
import { ensureChat, getChat, listChats, listContacts, listMessages, searchInbox } from "../whatsapp/inboxStore";

interface McpIdentity {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  defaultOtpLength: number;
  defaultOtpAlphabet: "numeric" | "alphanumeric" | "alphabetic";
}

function getIdentity(auth: AuthInfo | undefined): McpIdentity {
  if (!auth?.scopes.includes("account:manage")) {
    throw new Error("This tool needs account:manage. Reconnect OtpWave in the AI app and enable account management on the consent screen.");
  }
  const identity = auth?.extra?.apiKey;
  if (!identity || typeof identity !== "object" || typeof (identity as McpIdentity).userId !== "string") {
    throw new Error("MCP authorization context is missing");
  }
  return identity as McpIdentity;
}

function db() {
  if (!supabaseAvailable()) throw new Error("Supabase is not configured");
  return getSupabase();
}

function toolResult(value: unknown, isError = false) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], isError };
}

function toolResultWithImage(value: unknown, data: string) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(value) },
      { type: "image" as const, data, mimeType: "image/png" }
    ]
  };
}

function errorResult(error: unknown, fallback: string) {
  return toolResult({ error: error instanceof Error ? error.message : fallback }, true);
}

function publicSessionState(state: WhatsappSessionState | null, userId: string) {
  const current = state ?? {
    userId,
    status: "disconnected" as const,
    qrDataUrl: null,
    phoneNumber: null,
    lastError: null,
    updatedAt: new Date().toISOString()
  };
  return {
    status: current.status,
    phoneNumber: current.phoneNumber,
    lastError: current.lastError,
    updatedAt: current.updatedAt
  };
}

async function waitForWhatsappState(userId: string, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = sessionManager.getState(userId);
    if (state && ["qr", "connected", "logged_out", "error"].includes(state.status)) return state;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return sessionManager.getState(userId);
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    return parts[0] === 127 || parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) || (parts[0] === 169 && parts[1] === 254) || parts[0] === 0;
  }
  if (net.isIPv6(ip)) {
    return ip === "::1" || ip === "0:0:0:0:0:0:0:1" || /^[fF][cCdD]/.test(ip) || /^[fF][eE][89aAbB]/.test(ip) || /^::[fF]{4}:/i.test(ip);
  }
  return false;
}

const webhookEvent = z.enum([
  "otp.sent",
  "otp.verified",
  "otp.failed",
  "whatsapp.connected",
  "whatsapp.disconnected",
  "api.limit_warning"
]);

const secureWebhookUrl = z.string().url().superRefine((value, ctx) => {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^\[(.*)\]$/, "$1");
    if (host === "localhost" || host.endsWith(".localhost") || isPrivateIp(host)) {
      ctx.addIssue({ code: "custom", message: "Localhost and private/internal IPs are not allowed" });
    }
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid URL" });
  }
});

const otpAlphabet = z.enum(["numeric", "alphanumeric", "alphabetic"]);
const otpLength = z.number().int().min(4).max(10);

const apiKeyFields = "id,name,prefix,created_at,last_used_at,revoked_at,default_otp_length,default_otp_alphabet";
const webhookFields = "id,url,events,active,created_at";

const accountToolNames = new Set([
  "get_whatsapp_status", "connect_whatsapp", "disconnect_whatsapp", "logout_whatsapp",
  "list_whatsapp_chats", "open_whatsapp_chat", "get_whatsapp_chat_history", "search_whatsapp",
  "list_whatsapp_contacts", "get_whatsapp_group_members", "create_whatsapp_group",
  "send_whatsapp_message", "send_whatsapp_media", "send_whatsapp_location", "react_to_whatsapp_message",
  "modify_whatsapp_chat",
  "list_api_keys", "create_api_key", "update_api_key", "revoke_api_key",
  "get_otp_logs", "get_otp_analytics", "list_webhooks", "create_webhook",
  "update_webhook", "delete_webhook", "get_webhook_deliveries", "get_profile",
  "update_profile", "get_onboarding_progress", "change_password", "delete_account"
]);

export function dashboardToolScopeChallenge({ request, authInfo }: { request: JSONRPCRequest; authInfo?: AuthInfo }): ScopeChallenge | undefined {
  const params = request.params as { name?: unknown } | undefined;
  if (request.method !== "tools/call" || typeof params?.name !== "string" || !accountToolNames.has(params.name)) return;
  if (authInfo?.scopes.includes("account:manage")) return;
  return {
    scopes: ["otp:manage", "account:manage"],
    errorDescription: "This tool needs OtpWave account access. Reconnect OtpWave in the AI app and enable account management on the consent screen."
  };
}

export function registerDashboardMcpTools(server: McpServer) {
  server.registerTool(
    "get_whatsapp_status",
    {
      title: "Get WhatsApp connection status",
      description: "Check your own OtpWave WhatsApp session. The pairing QR is hidden unless you explicitly set showQr to true.",
      inputSchema: { showQr: z.boolean().optional().describe("Set true only when you want the current WhatsApp pairing QR shown as an image.") },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const state = sessionManager.getState(userId);
        const visible = publicSessionState(state, userId);
        const qr = args.showQr ? state?.qrDataUrl?.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/)?.[1] : undefined;
        return qr ? toolResultWithImage(visible, qr) : toolResult(visible);
      } catch (error) {
        return errorResult(error, "Could not retrieve WhatsApp status.");
      }
    }
  );

  server.registerTool(
    "connect_whatsapp",
    {
      title: "Connect WhatsApp",
      description: "Start or resume pairing for your own WhatsApp account. Call only after the user asks to connect. If pairing is needed, return the QR as an image so the user can scan it with WhatsApp. A QR grants access to the linked WhatsApp account; show it only to the account owner.",
      inputSchema: {
        confirm: z.literal(true).describe("Required: the user explicitly asked to connect WhatsApp."),
        showQr: z.boolean().optional().describe("Defaults to true during pairing. Set false to hide the QR image.")
      },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        await sessionManager.start(userId);
        const state = await waitForWhatsappState(userId);
        const visible = publicSessionState(state, userId);
        const showQr = args.showQr ?? true;
        const qr = showQr ? state?.qrDataUrl?.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/)?.[1] : undefined;
        if (qr) return toolResultWithImage({ ...visible, pairing: "Scan the QR image with WhatsApp on your phone." }, qr);
        return toolResult({ ...visible, ...(visible.status === "initializing" ? { message: "WhatsApp is starting. Check get_whatsapp_status again in a few seconds." } : {}) });
      } catch (error) {
        return errorResult(error, "Could not start WhatsApp pairing.");
      }
    }
  );

  server.registerTool(
    "disconnect_whatsapp",
    {
      title: "Disconnect WhatsApp",
      description: "Stop your WhatsApp session while preserving its saved pairing credentials. The session can be resumed later. Call only after the user asks to disconnect.",
      inputSchema: { confirm: z.literal(true).describe("Required: the user explicitly asked to disconnect WhatsApp.") },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (_args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        await sessionManager.stop(userId);
        return toolResult(publicSessionState(sessionManager.getState(userId), userId));
      } catch (error) {
        return errorResult(error, "Could not disconnect WhatsApp.");
      }
    }
  );

  server.registerTool(
    "logout_whatsapp",
    {
      title: "Log out and remove WhatsApp pairing",
      description: "Log out your linked WhatsApp device and erase OtpWave's saved pairing credentials. This is more permanent than disconnect_whatsapp and requires a new QR scan to reconnect. Call only after the user explicitly asks to remove the pairing and confirms with the exact phrase.",
      inputSchema: { confirmation: z.literal("LOG OUT AND REMOVE WHATSAPP PAIRING") },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false }
    },
    async (_args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        await sessionManager.logout(userId);
        return toolResult({ status: "logged_out", message: "WhatsApp pairing was removed. Scan a new QR to reconnect." });
      } catch (error) {
        return errorResult(error, "Could not remove the WhatsApp pairing.");
      }
    }
  );

  server.registerTool(
    "list_api_keys",
    {
      title: "List API keys",
      description: "List API keys belonging to your OtpWave account. Secret values are never shown after creation.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (_args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const { data, error } = await db().from("api_keys").select(apiKeyFields).eq("user_id", userId).order("created_at", { ascending: false });
        if (error) throw error;
        return toolResult({ apiKeys: data ?? [] });
      } catch (error) {
        return errorResult(error, "Could not list API keys.");
      }
    }
  );

  server.registerTool(
    "create_api_key",
    {
      title: "Create an API key",
      description: "Create a new OtpWave API key for your account. The secret is returned once in the tool result; save it somewhere secure. Only call when the user explicitly asks for a new key.",
      inputSchema: {
        name: z.string().min(1).max(80),
        defaultOtpLength: otpLength.optional(),
        defaultOtpAlphabet: otpAlphabet.optional(),
        confirm: z.literal(true).describe("Required: the user explicitly asked to create this API key.")
      },
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const generated = generateApiKey();
        const { data, error } = await db().from("api_keys").insert({
          user_id: userId,
          name: args.name,
          prefix: generated.prefix,
          key_hash: generated.hash,
          default_otp_length: args.defaultOtpLength ?? 6,
          default_otp_alphabet: args.defaultOtpAlphabet ?? "numeric"
        }).select(apiKeyFields).single();
        if (error) throw error;
        return toolResult({ apiKey: data, secret: generated.publicKey, note: "This secret is shown only once. Store it securely." });
      } catch (error) {
        return errorResult(error, "Could not create the API key.");
      }
    }
  );

  server.registerTool(
    "update_api_key",
    {
      title: "Update an API key",
      description: "Update the name or default OTP settings for one of your API keys. Only call when the user asks for the change.",
      inputSchema: {
        id: z.string().uuid(),
        name: z.string().min(1).max(80).optional(),
        defaultOtpLength: otpLength.optional(),
        defaultOtpAlphabet: otpAlphabet.optional()
      },
      annotations: { idempotentHint: true, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const patch: Record<string, unknown> = {};
        if (args.name !== undefined) patch.name = args.name;
        if (args.defaultOtpLength !== undefined) patch.default_otp_length = args.defaultOtpLength;
        if (args.defaultOtpAlphabet !== undefined) patch.default_otp_alphabet = args.defaultOtpAlphabet;
        if (Object.keys(patch).length === 0) return toolResult({ error: "Provide at least one field to update." }, true);
        const { data, error } = await db().from("api_keys").update(patch).eq("id", args.id).eq("user_id", userId).select(apiKeyFields).maybeSingle();
        if (error) throw error;
        return data ? toolResult({ apiKey: data }) : toolResult({ error: "API key not found in your account." }, true);
      } catch (error) {
        return errorResult(error, "Could not update the API key.");
      }
    }
  );

  server.registerTool(
    "revoke_api_key",
    {
      title: "Revoke an API key",
      description: "Revoke an API key belonging to your account. Revocation is permanent, and revoking the key used by this MCP connection will disconnect this AI app. Only call after the user asks to revoke a key.",
      inputSchema: { id: z.string().uuid(), confirm: z.literal(true).describe("Required: the user explicitly asked to revoke this key.") },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const { data, error } = await db().from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", args.id).eq("user_id", userId).select("id").maybeSingle();
        if (error) throw error;
        return data ? toolResult({ ok: true, revokedId: data.id }) : toolResult({ error: "API key not found in your account." }, true);
      } catch (error) {
        return errorResult(error, "Could not revoke the API key.");
      }
    }
  );

  server.registerTool(
    "get_otp_logs",
    {
      title: "Get OTP logs",
      description: "Read your own OTP delivery history with optional status or phone-number filters.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
        page: z.number().int().min(0).max(100_000).optional(),
        status: z.enum(["pending", "verified", "failed", "expired"]).optional(),
        phoneNumber: z.string().max(20).optional()
      },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const limit = args.limit ?? 25;
        const page = args.page ?? 0;
        let query = db().from("otp_logs").select("id,phone_number,status,attempts,resend_count,delivered_at,verified_at,expires_at,created_at,failure_reason,app_name", { count: "exact" })
          .eq("user_id", userId).order("created_at", { ascending: false }).range(page * limit, page * limit + limit - 1);
        if (args.status) query = query.eq("status", args.status);
        if (args.phoneNumber) query = query.ilike("phone_number", "%" + args.phoneNumber + "%");
        const { data, count, error } = await query;
        if (error) throw error;
        return toolResult({ logs: data ?? [], total: count ?? 0, page, limit });
      } catch (error) {
        return errorResult(error, "Could not retrieve OTP logs.");
      }
    }
  );

  server.registerTool(
    "get_otp_analytics",
    {
      title: "Get OTP analytics",
      description: "Read your account's 30-day OTP totals, verification rate, and daily activity.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (_args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await db().from("otp_logs").select("status,created_at").eq("user_id", userId).gte("created_at", since);
        if (error) throw error;
        const rows = data ?? [];
        const totals = { sent: rows.length, verified: 0, failed: 0, expired: 0, pending: 0 };
        for (const row of rows) {
          if (row.status === "verified") totals.verified++;
          else if (row.status === "failed") totals.failed++;
          else if (row.status === "expired") totals.expired++;
          else if (row.status === "pending") totals.pending++;
        }
        const buckets: Record<string, { sent: number; verified: number; failed: number }> = {};
        for (let i = 29; i >= 0; i--) {
          const key = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          buckets[key] = { sent: 0, verified: 0, failed: 0 };
        }
        for (const row of rows) {
          const bucket = buckets[String(row.created_at).slice(0, 10)];
          if (!bucket) continue;
          bucket.sent++;
          if (row.status === "verified") bucket.verified++;
          if (row.status === "failed") bucket.failed++;
        }
        return toolResult({ totals, verificationRate: totals.sent ? totals.verified / totals.sent : 0, series: Object.entries(buckets).map(([date, values]) => ({ date, ...values })) });
      } catch (error) {
        return errorResult(error, "Could not retrieve OTP analytics.");
      }
    }
  );

  server.registerTool(
    "list_webhooks",
    {
      title: "List webhooks",
      description: "List webhook endpoints configured on your account. Webhook secrets are not retrievable after creation.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (_args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const { data, error } = await db().from("webhook_endpoints").select(webhookFields).eq("user_id", userId).order("created_at", { ascending: false });
        if (error) throw error;
        return toolResult({ webhooks: data ?? [] });
      } catch (error) {
        return errorResult(error, "Could not list webhooks.");
      }
    }
  );

  server.registerTool(
    "create_webhook",
    {
      title: "Create a webhook",
      description: "Create a webhook for your account. The signing secret is returned once, so store it securely. Only call when the user explicitly asks to add this webhook.",
      inputSchema: {
        url: secureWebhookUrl,
        events: z.array(webhookEvent).min(1),
        confirm: z.literal(true).describe("Required: the user explicitly asked to create this webhook.")
      },
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const secret = generateWebhookSecret();
        const { data, error } = await db().from("webhook_endpoints").insert({ user_id: userId, url: args.url, events: args.events, secret, active: true }).select(webhookFields).single();
        if (error) throw error;
        return toolResult({ webhook: data, secret, note: "The signing secret is shown only once. Store it securely." });
      } catch (error) {
        return errorResult(error, "Could not create the webhook.");
      }
    }
  );

  server.registerTool(
    "update_webhook",
    {
      title: "Update a webhook",
      description: "Change a webhook's URL, event subscriptions, or active status. Only call when the user asks for the change.",
      inputSchema: {
        id: z.string().uuid(),
        url: secureWebhookUrl.optional(),
        events: z.array(webhookEvent).min(1).optional(),
        active: z.boolean().optional()
      },
      annotations: { idempotentHint: true, openWorldHint: true }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const patch: Record<string, unknown> = {};
        if (args.url !== undefined) patch.url = args.url;
        if (args.events !== undefined) patch.events = args.events;
        if (args.active !== undefined) patch.active = args.active;
        if (Object.keys(patch).length === 0) return toolResult({ error: "Provide at least one field to update." }, true);
        const { data, error } = await db().from("webhook_endpoints").update(patch).eq("id", args.id).eq("user_id", userId).select(webhookFields).maybeSingle();
        if (error) throw error;
        return data ? toolResult({ webhook: data }) : toolResult({ error: "Webhook not found in your account." }, true);
      } catch (error) {
        return errorResult(error, "Could not update the webhook.");
      }
    }
  );

  server.registerTool(
    "delete_webhook",
    {
      title: "Delete a webhook",
      description: "Permanently delete one of your webhook endpoints and its delivery history. Only call after the user asks to delete it.",
      inputSchema: { id: z.string().uuid(), confirm: z.literal(true).describe("Required: the user explicitly asked to delete this webhook.") },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const { data, error } = await db().from("webhook_endpoints").delete().eq("id", args.id).eq("user_id", userId).select("id").maybeSingle();
        if (error) throw error;
        return toolResult({ ok: true, deletedId: data?.id ?? null });
      } catch (error) {
        return errorResult(error, "Could not delete the webhook.");
      }
    }
  );

  server.registerTool(
    "get_webhook_deliveries",
    {
      title: "Get webhook deliveries",
      description: "Read recent delivery attempts for one of your webhooks.",
      inputSchema: { id: z.string().uuid() },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const { data, error } = await db().from("webhook_deliveries").select("id,event,status_code,attempt,delivered,error,created_at").eq("endpoint_id", args.id).eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
        if (error) throw error;
        return toolResult({ deliveries: data ?? [] });
      } catch (error) {
        return errorResult(error, "Could not retrieve webhook deliveries.");
      }
    }
  );

  server.registerTool(
    "get_profile",
    {
      title: "Get account profile",
      description: "Read the email address and display name for the signed-in OtpWave account.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (_args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const supabase = db();
        const { data, error } = await supabase.auth.admin.getUserById(userId);
        if (error || !data.user) throw error ?? new Error("Account not found.");
        const profileName = typeof data.user.user_metadata?.full_name === "string" ? data.user.user_metadata.full_name : null;
        return toolResult({ email: data.user.email ?? null, fullName: profileName });
      } catch (error) {
        return errorResult(error, "Could not retrieve your profile.");
      }
    }
  );

  server.registerTool(
    "update_profile",
    {
      title: "Update account profile",
      description: "Update the display name on your OtpWave account. Only call when the user asks to change it.",
      inputSchema: { fullName: z.string().max(120).nullable() },
      annotations: { idempotentHint: true, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const supabase = db();
        const { data: existing, error: readError } = await supabase.auth.admin.getUserById(userId);
        if (readError || !existing.user) throw readError ?? new Error("Account not found.");
        const userMetadata = existing.user.user_metadata ?? {};
        const { error: authError } = await supabase.auth.admin.updateUserById(userId, { user_metadata: { ...userMetadata, full_name: args.fullName } });
        if (authError) throw authError;
        const { error: profileError } = await supabase.from("profiles").update({ full_name: args.fullName }).eq("id", userId);
        return toolResult({ ok: true, profileSynced: !profileError });
      } catch (error) {
        return errorResult(error, "Could not update your profile.");
      }
    }
  );

  server.registerTool(
    "get_onboarding_progress",
    {
      title: "Get onboarding progress",
      description: "Check the setup steps for your own OtpWave account.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (_args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const supabase = db();
        const [keys, logs, webhooks] = await Promise.all([
          supabase.from("api_keys").select("id", { count: "exact", head: true }).eq("user_id", userId).is("revoked_at", null),
          supabase.from("otp_logs").select("id", { count: "exact", head: true }).eq("user_id", userId),
          supabase.from("webhook_endpoints").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("active", true)
        ]);
        if (keys.error || logs.error || webhooks.error) throw keys.error ?? logs.error ?? webhooks.error;
        const steps = [
          { id: "pair_whatsapp", done: sessionManager.getState(userId)?.status === "connected" },
          { id: "create_key", done: (keys.count ?? 0) > 0 },
          { id: "send_otp", done: (logs.count ?? 0) > 0 },
          { id: "webhook", done: (webhooks.count ?? 0) > 0 }
        ];
        const completed = steps.filter((step) => step.done).length;
        return toolResult({ steps, completed, total: steps.length, finished: completed === steps.length });
      } catch (error) {
        return errorResult(error, "Could not retrieve onboarding progress.");
      }
    }
  );

  server.registerTool(
    "change_password",
    {
      title: "Change account password",
      description: "Change the OtpWave login password. The new password is sent through this AI client to OtpWave. Only call when the user explicitly asks, provides the new password, and confirms this exact action. Never repeat the password in the result.",
      inputSchema: {
        newPassword: z.string().min(8).max(128),
        confirmation: z.literal("CHANGE MY OPAWAVE PASSWORD")
      },
      annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const { error } = await db().auth.admin.updateUserById(userId, { password: args.newPassword });
        if (error) throw error;
        return toolResult({ ok: true, message: "Password changed. The password is not included in this result." });
      } catch (error) {
        return errorResult(error, "Could not change your password.");
      }
    }
  );

  server.registerTool(
    "delete_account",
    {
      title: "Permanently delete OtpWave account",
      description: "Permanently delete your OtpWave account, API keys, OTP logs, webhooks, and WhatsApp pairing. This cannot be undone. Only call after the user explicitly asks to delete the account and provides the exact confirmation phrase.",
      inputSchema: { confirmation: z.literal("DELETE MY OPAWAVE ACCOUNT") },
      annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false }
    },
    async (_args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const supabase = db();
        await sessionManager.stop(userId);
        const { error } = await supabase.auth.admin.deleteUser(userId);
        if (error) throw error;
        await sessionManager.logout(userId);
        return toolResult({ ok: true, message: "The OtpWave account and its data have been deleted." });
      } catch (error) {
        return errorResult(error, "Could not delete the OtpWave account.");
      }
    }
  );

  server.registerTool(
    "list_whatsapp_chats",
    {
      title: "List WhatsApp chats",
      description: "List recent chats from your connected WhatsApp account with unread counts, latest message, labels, and chat state.",
      inputSchema: { archived: z.boolean().optional(), limit: z.number().int().min(1).max(250).optional() },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        return toolResult({ chats: await listChats(userId, { archived: args.archived ?? false, limit: args.limit }) });
      } catch (error) {
        return errorResult(error, "Could not list WhatsApp chats.");
      }
    }
  );

  server.registerTool(
    "open_whatsapp_chat",
    {
      title: "Open a WhatsApp chat",
      description: "Open a recent WhatsApp conversation or start a local conversation entry for a phone number or chat ID.",
      inputSchema: { chatJid: z.string().min(5).max(200), name: z.string().max(120).optional() },
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const jid = normalizeWhatsappJid(args.chatJid);
        await ensureChat(userId, jid, args.name, jid.endsWith("@g.us"));
        const [chat, messages] = await Promise.all([
          getChat(userId, jid),
          listMessages(userId, jid, { limit: 50 })
        ]);
        return toolResult({ chat, messages });
      } catch (error) {
        return errorResult(error, "Could not open the WhatsApp chat.");
      }
    }
  );

  server.registerTool(
    "get_whatsapp_chat_history",
    {
      title: "Read WhatsApp chat history",
      description: "Read recent messages in one of your WhatsApp chats. Pass before to page to older messages.",
      inputSchema: {
        chatJid: z.string().min(5).max(200),
        before: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(100).optional()
      },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const jid = normalizeWhatsappJid(args.chatJid);
        return toolResult({ chat: await getChat(userId, jid), messages: await listMessages(userId, jid, { before: args.before, limit: args.limit }) });
      } catch (error) {
        return errorResult(error, "Could not read WhatsApp chat history.");
      }
    }
  );

  server.registerTool(
    "search_whatsapp",
    {
      title: "Search WhatsApp chats and messages",
      description: "Search your chat names, contacts, latest messages, and stored message text by keyword or phone number.",
      inputSchema: { query: z.string().trim().min(1).max(120), limit: z.number().int().min(1).max(50).optional() },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        return toolResult(await searchInbox(userId, args.query, args.limit));
      } catch (error) {
        return errorResult(error, "Could not search WhatsApp.");
      }
    }
  );

  server.registerTool(
    "list_whatsapp_contacts",
    {
      title: "List WhatsApp contacts",
      description: "List contacts synced from your connected WhatsApp account.",
      inputSchema: { query: z.string().max(120).optional(), limit: z.number().int().min(1).max(500).optional() },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        return toolResult({ contacts: await listContacts(userId, args.query, args.limit) });
      } catch (error) {
        return errorResult(error, "Could not list WhatsApp contacts.");
      }
    }
  );

  server.registerTool(
    "get_whatsapp_group_members",
    {
      title: "Get WhatsApp group members",
      description: "Read the members and admin roles for one of your WhatsApp groups.",
      inputSchema: { groupJid: z.string().min(5).max(200) },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        return toolResult(await sessionManager.getGroupMembers(userId, args.groupJid));
      } catch (error) {
        return errorResult(error, "Could not retrieve WhatsApp group members.");
      }
    }
  );

  server.registerTool(
    "create_whatsapp_group",
    {
      title: "Create a WhatsApp group",
      description: "Create a WhatsApp group with the specified participants. Only call after the user explicitly asks to create the group and confirms the recipients.",
      inputSchema: {
        subject: z.string().trim().min(1).max(100),
        participants: z.array(z.string().trim().min(7).max(30)).min(1).max(256),
        confirm: z.literal(true).describe("Required: the user confirmed this group name and participant list.")
      },
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        return toolResult({ group: await sessionManager.createGroup(userId, args.subject, args.participants) });
      } catch (error) {
        return errorResult(error, "Could not create the WhatsApp group.");
      }
    }
  );

  server.registerTool(
    "send_whatsapp_message",
    {
      title: "Send a WhatsApp message",
      description: "Send a text message to a WhatsApp chat. Set quotedMessageId to reply to a specific message. Only call when the user explicitly asks to send the message.",
      inputSchema: {
        chatJid: z.string().min(5).max(200),
        text: z.string().trim().min(1).max(5000),
        quotedMessageId: z.string().min(1).max(200).optional(),
        confirm: z.literal(true).describe("Required: the user explicitly asked to send this message to this chat.")
      },
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        const message = await sessionManager.sendChatText(userId, args.chatJid, args.text, args.quotedMessageId);
        return toolResult({ message });
      } catch (error) {
        return errorResult(error, "Could not send the WhatsApp message.");
      }
    }
  );

  server.registerTool(
    "send_whatsapp_media",
    {
      title: "Send WhatsApp media",
      description: "Send an image, document, or audio clip supplied as base64 data to a WhatsApp chat. Files are limited to 8 MB. Only call when the user explicitly asks to send the file.",
      inputSchema: {
        chatJid: z.string().min(5).max(200),
        mediaType: z.enum(["image", "document", "audio"]),
        mimeType: z.string().min(3).max(120),
        fileName: z.string().max(255).optional(),
        caption: z.string().max(1000).optional(),
        quotedMessageId: z.string().min(1).max(200).optional(),
        dataBase64: z.string().min(4).max(11_184_812),
        confirm: z.literal(true).describe("Required: the user explicitly asked to send this file to this chat.")
      },
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(args.dataBase64)) throw new Error("File data must be valid base64.");
        const buffer = Buffer.from(args.dataBase64, "base64");
        if (buffer.length === 0 || buffer.length > 8 * 1024 * 1024) throw new Error("Choose a file smaller than 8 MB.");
        if (args.mediaType === "image" && !/^image\/(jpeg|png|webp|gif)$/i.test(args.mimeType)) throw new Error("Images must be JPEG, PNG, WebP, or GIF.");
        if (args.mediaType === "audio" && !/^audio\/(ogg|mpeg|mp4|aac|wav|webm)$/i.test(args.mimeType)) throw new Error("Audio must use a supported audio format.");
        const message = await sessionManager.sendMedia(userId, args.chatJid, args.mediaType, buffer, args.mimeType, args.fileName, args.caption, args.quotedMessageId);
        return toolResult({ message });
      } catch (error) {
        return errorResult(error, "Could not send the WhatsApp media.");
      }
    }
  );

  server.registerTool(
    "send_whatsapp_location",
    {
      title: "Send a WhatsApp location",
      description: "Send a location pin to a WhatsApp chat. Only call when the user explicitly asks to share this location.",
      inputSchema: {
        chatJid: z.string().min(5).max(200),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        name: z.string().max(120).optional(),
        address: z.string().max(300).optional(),
        confirm: z.literal(true).describe("Required: the user explicitly asked to send this location to this chat.")
      },
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        return toolResult({ message: await sessionManager.sendLocation(userId, args.chatJid, args.latitude, args.longitude, args.name, args.address) });
      } catch (error) {
        return errorResult(error, "Could not send the WhatsApp location.");
      }
    }
  );

  server.registerTool(
    "react_to_whatsapp_message",
    {
      title: "React to a WhatsApp message",
      description: "Send an emoji reaction to a message in a WhatsApp chat. Use an empty reaction string to remove your reaction. Only call when the user asks to react.",
      inputSchema: {
        chatJid: z.string().min(5).max(200),
        messageId: z.string().min(1).max(200),
        reaction: z.string().max(16),
        confirm: z.literal(true).describe("Required: the user explicitly asked to add or remove this reaction.")
      },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        return toolResult({ message: await sessionManager.reactToMessage(userId, args.chatJid, args.messageId, args.reaction) });
      } catch (error) {
        return errorResult(error, "Could not react to the WhatsApp message.");
      }
    }
  );

  server.registerTool(
    "modify_whatsapp_chat",
    {
      title: "Manage a WhatsApp chat",
      description: "Mark a chat read or unread, archive it, pin or mute it, or set its OtpWave labels. Only call after the user explicitly asks to make the selected change.",
      inputSchema: {
        chatJid: z.string().min(5).max(200),
        action: z.enum(["mark_read", "mark_unread", "archive", "unarchive", "pin", "unpin", "mute", "unmute", "labels"]),
        durationMinutes: z.number().int().min(1).max(10080).optional(),
        labels: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
        confirm: z.literal(true).describe("Required: the user explicitly asked for this chat change.")
      },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args, context) => {
      try {
        const { userId } = getIdentity(context.http?.authInfo);
        if (args.action === "labels" && !args.labels) throw new Error("Provide labels for the labels action.");
        const chat = await sessionManager.modifyChat(userId, args.chatJid, args.action, {
          durationMinutes: args.durationMinutes,
          labels: args.labels
        });
        return chat ? toolResult({ chat }) : toolResult({ error: "Chat not found." }, true);
      } catch (error) {
        return errorResult(error, "Could not update the WhatsApp chat.");
      }
    }
  );
}
