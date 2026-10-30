import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptAtRest, encryptAtRest } from "../lib/crypto";
import { getSupabase, supabaseAvailable } from "../lib/supabase";
import { listMessages, type WhatsAppMessageRecord } from "../whatsapp/inboxStore";
import { sessionManager } from "../whatsapp/sessionManager";
import { AiConfigError, generateAiReply, PROVIDER_DEFAULTS, testAiProvider, validateCompatibleBaseUrl, type AiProvider, type AiRequestConfig } from "./providers";

export interface AssistantSettingsInput {
  provider: AiProvider;
  model: string;
  baseUrl?: string;
  systemPrompt: string;
  enabled: boolean;
  maxRepliesPerDay: number;
  apiKey?: string;
  clearApiKey?: boolean;
}

interface StoredSettings {
  user_id: string;
  provider: AiProvider;
  model: string;
  base_url: string | null;
  api_key_ciphertext: string | null;
  system_prompt: string;
  enabled: boolean;
  max_replies_per_day: number;
}

function db(): SupabaseClient {
  if (!supabaseAvailable()) throw new Error("Supabase is not configured.");
  return getSupabase();
}

function publicSettings(row: StoredSettings | null) {
  const provider = row?.provider ?? "gemini";
  const defaults = PROVIDER_DEFAULTS[provider];
  return {
    provider,
    model: row?.model ?? defaults.model,
    baseUrl: row?.base_url ?? defaults.baseUrl ?? "",
    systemPrompt: row?.system_prompt ?? "",
    enabled: row?.enabled ?? false,
    maxRepliesPerDay: row?.max_replies_per_day ?? 100,
    keyConfigured: Boolean(row?.api_key_ciphertext)
  };
}

async function readStoredSettings(userId: string): Promise<StoredSettings | null> {
  const { data, error } = await db().from("whatsapp_ai_settings")
    .select("user_id,provider,model,base_url,api_key_ciphertext,system_prompt,enabled,max_replies_per_day")
    .eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data as StoredSettings | null;
}

export async function getAssistantSettings(userId: string) {
  return publicSettings(await readStoredSettings(userId));
}

function configWithKey(input: Omit<AssistantSettingsInput, "apiKey" | "clearApiKey">, apiKey: string): AiRequestConfig {
  const providerDefaults = PROVIDER_DEFAULTS[input.provider];
  return {
    provider: input.provider,
    model: input.model.trim(),
    apiKey,
    baseUrl: input.provider === "openai_compatible"
      ? validateCompatibleBaseUrl(input.baseUrl || providerDefaults.baseUrl!)
      : providerDefaults.baseUrl,
    systemPrompt: input.systemPrompt.trim()
  };
}

export async function saveAssistantSettings(userId: string, input: AssistantSettingsInput) {
  const current = await readStoredSettings(userId);
  let encryptedKey = current?.api_key_ciphertext ?? null;
  if (input.clearApiKey) encryptedKey = null;
  if (input.apiKey?.trim()) encryptedKey = encryptAtRest(Buffer.from(input.apiKey.trim(), "utf8"));

  if (input.enabled && !encryptedKey) throw new AiConfigError("Add an AI provider API key before enabling automatic replies.");
  if (input.provider === "openai_compatible") {
    validateCompatibleBaseUrl(input.baseUrl || PROVIDER_DEFAULTS.openai_compatible.baseUrl!);
  }

  const row = {
    user_id: userId,
    provider: input.provider,
    model: input.model.trim(),
    base_url: input.provider === "openai_compatible"
      ? validateCompatibleBaseUrl(input.baseUrl || PROVIDER_DEFAULTS.openai_compatible.baseUrl!)
      : null,
    api_key_ciphertext: encryptedKey,
    system_prompt: input.systemPrompt.trim(),
    enabled: input.enabled,
    max_replies_per_day: input.maxRepliesPerDay,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await db().from("whatsapp_ai_settings").upsert(row, { onConflict: "user_id" })
    .select("user_id,provider,model,base_url,api_key_ciphertext,system_prompt,enabled,max_replies_per_day")
    .single();
  if (error) throw error;
  return publicSettings(data as StoredSettings);
}

export async function testAssistantProvider(userId: string, input: AssistantSettingsInput): Promise<void> {
  let apiKey = input.apiKey?.trim();
  if (!apiKey) {
    const saved = await readStoredSettings(userId);
    if (saved?.api_key_ciphertext) apiKey = decryptAtRest(saved.api_key_ciphertext).toString("utf8");
  }
  if (!apiKey) throw new AiConfigError("Enter and save a provider API key before testing the connection.");
  await testAiProvider(configWithKey(input, apiKey));
}

export async function listAssistantActivity(userId: string) {
  const { data, error } = await db().from("whatsapp_ai_reply_events")
    .select("account_jid,chat_jid,source_message_id,reply_message_id,status,reason,created_at,completed_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
  if (error) throw error;
  return data ?? [];
}

async function updateEvent(userId: string, message: WhatsAppMessageRecord, patch: Record<string, unknown>) {
  const { error } = await db().from("whatsapp_ai_reply_events").update({
    ...patch,
    completed_at: new Date().toISOString()
  }).eq("user_id", userId).eq("account_jid", message.accountJid).eq("source_message_id", message.messageId);
  if (error) throw error;
}

/**
 * Auto replies are intentionally limited to new, incoming direct text messages.
 * Groups, media, broadcasts, historical sync, and our own sent messages are ignored.
 */
export async function handleIncomingWhatsAppMessage(userId: string, message: WhatsAppMessageRecord): Promise<void> {
  const jid = message.chatJid;
  const isDirectMessage = jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid");
  if (message.fromMe || message.messageType !== "text" || !message.text?.trim() || !isDirectMessage) return;

  const settings = await readStoredSettings(userId);
  if (!settings?.enabled || !settings.api_key_ciphertext) return;

  const { error: insertError } = await db().from("whatsapp_ai_reply_events").insert({
    user_id: userId,
    account_jid: message.accountJid,
    chat_jid: jid,
    source_message_id: message.messageId,
    status: "processing"
  });
  if (insertError?.code === "23505") return;
  if (insertError) throw insertError;

  try {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count, error: countError } = await db().from("whatsapp_ai_reply_events")
      .select("source_message_id", { count: "exact", head: true })
      .eq("user_id", userId).gte("created_at", startOfDay.toISOString()).in("status", ["processing", "sent"]);
    if (countError) throw countError;
    if ((count ?? 0) > settings.max_replies_per_day) {
      await updateEvent(userId, message, { status: "skipped", reason: "daily_limit" });
      return;
    }

    const [history, apiKey] = await Promise.all([
      listMessages(userId, message.accountJid, jid, { limit: 12 }),
      Promise.resolve(decryptAtRest(settings.api_key_ciphertext).toString("utf8"))
    ]);
    const context = history.filter((item) => item.text?.trim()).slice(-12).map((item) => ({
      role: item.fromMe ? "assistant" as const : "user" as const,
      content: item.text!.trim().slice(0, 3000)
    }));
    const reply = await generateAiReply({
      provider: settings.provider,
      model: settings.model,
      apiKey,
      baseUrl: settings.base_url,
      systemPrompt: settings.system_prompt
    }, context);
    if (!reply) {
      await updateEvent(userId, message, { status: "skipped", reason: "empty_reply" });
      return;
    }

    const sent = await sessionManager.sendChatText(userId, message.accountJid, jid, reply, message.messageId);
    await updateEvent(userId, message, { status: "sent", reply_message_id: sent.messageId, reason: null });
  } catch (error) {
    // Store only a coarse reason. Provider errors can contain request metadata,
    // so never persist the raw error or any API key-bearing URLs.
    const reason = error instanceof Error && error.message.startsWith("AI provider") ? "provider_error" : "send_error";
    try {
      await updateEvent(userId, message, { status: "failed", reason });
    } catch {
      // The original processing error remains the only useful signal here.
    }
    throw error;
  }
}
