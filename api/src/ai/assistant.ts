import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptAtRest, encryptAtRest } from "../lib/crypto";
import { getSupabase, supabaseAvailable } from "../lib/supabase";
import { listMessages, type WhatsAppMessageRecord } from "../whatsapp/inboxStore";
import { sessionManager } from "../whatsapp/sessionManager";
import { AiConfigError, generateAiReply, listAiModels, PROVIDER_DEFAULTS, testAiProvider, validateCompatibleBaseUrl, type AiModel, type AiProvider, type AiRequestConfig } from "./providers";

export interface AssistantSettingsInput {
  provider: AiProvider;
  model: string;
  baseUrl?: string;
  systemPrompt: string;
  enabled: boolean;
  maxRepliesPerDay: number;
  replyScope: "all" | "selected";
  workflowConfig: WorkflowConfig;
  apiKey?: string;
  clearApiKey?: boolean;
}

export interface WorkflowField {
  key: string;
  label: string;
  question: string;
}

export interface WorkflowConfig {
  enabled: boolean;
  name: string;
  startKeyword: string;
  fields: WorkflowField[];
  completionMessage: string;
}

export type KnowledgeKind = "business" | "faq" | "policy" | "website";
export type AiChatMode = "inherit" | "enabled" | "paused" | "blocked" | "human";

export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  enabled: false,
  name: "",
  startKeyword: "",
  fields: [],
  completionMessage: "Thanks, I have the details. A member of our team will follow up soon."
};

interface StoredSettings {
  user_id: string;
  provider: AiProvider;
  model: string;
  base_url: string | null;
  api_key_ciphertext: string | null;
  system_prompt: string;
  enabled: boolean;
  max_replies_per_day: number;
  reply_scope?: "all" | "selected";
  workflow_config?: WorkflowConfig;
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
    replyScope: row?.reply_scope ?? "all",
    workflowConfig: { ...DEFAULT_WORKFLOW_CONFIG, ...(row?.workflow_config ?? {}) },
    keyConfigured: Boolean(row?.api_key_ciphertext)
  };
}

async function readStoredSettings(userId: string): Promise<StoredSettings | null> {
  const { data, error } = await db().from("whatsapp_ai_settings")
    .select("user_id,provider,model,base_url,api_key_ciphertext,system_prompt,enabled,max_replies_per_day,reply_scope,workflow_config")
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
    reply_scope: input.replyScope,
    workflow_config: input.workflowConfig,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await db().from("whatsapp_ai_settings").upsert(row, { onConflict: "user_id" })
    .select("user_id,provider,model,base_url,api_key_ciphertext,system_prompt,enabled,max_replies_per_day,reply_scope,workflow_config")
    .single();
  if (error) throw error;
  return publicSettings(data as StoredSettings);
}

export async function listAssistantKnowledge(userId: string) {
  const { data, error } = await db().from("whatsapp_ai_knowledge_items")
    .select("id,kind,title,source_url,content,active,created_at,updated_at")
    .eq("user_id", userId).order("updated_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function createAssistantKnowledge(userId: string, input: { kind: KnowledgeKind; title: string; sourceUrl?: string; content: string }) {
  const { data, error } = await db().from("whatsapp_ai_knowledge_items")
    .insert({ user_id: userId, kind: input.kind, title: input.title, source_url: input.sourceUrl?.trim() || null, content: input.content })
    .select("id,kind,title,source_url,content,active,created_at,updated_at").single();
  if (error) throw error;
  return data;
}

export async function updateAssistantKnowledge(userId: string, id: string, input: { kind: KnowledgeKind; title: string; sourceUrl?: string; content: string; active: boolean }) {
  const { data, error } = await db().from("whatsapp_ai_knowledge_items")
    .update({ kind: input.kind, title: input.title, source_url: input.sourceUrl?.trim() || null, content: input.content, active: input.active, updated_at: new Date().toISOString() })
    .eq("user_id", userId).eq("id", id)
    .select("id,kind,title,source_url,content,active,created_at,updated_at").single();
  if (error) throw error;
  return data;
}

export async function deleteAssistantKnowledge(userId: string, id: string) {
  const { error } = await db().from("whatsapp_ai_knowledge_items").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}

interface StoredChatControl {
  mode: AiChatMode;
  handoff_reason: string | null;
  workflow_state: { fieldIndex: number; values: Record<string, string>; completed?: boolean; workflowName?: string; completedAt?: string } | null;
  updated_at: string;
}

async function readChatControl(userId: string, accountJid: string, chatJid: string): Promise<StoredChatControl | null> {
  const { data, error } = await db().from("whatsapp_ai_chat_controls")
    .select("mode,handoff_reason,workflow_state,updated_at")
    .eq("user_id", userId).eq("account_jid", accountJid).eq("chat_jid", chatJid).maybeSingle();
  if (error) throw error;
  return data as StoredChatControl | null;
}

export async function listAssistantChatControls(userId: string, accountJid: string) {
  const { data, error } = await db().from("whatsapp_ai_chat_controls")
    .select("chat_jid,mode,handoff_reason,workflow_state,updated_at")
    .eq("user_id", userId).eq("account_jid", accountJid)
    .order("updated_at", { ascending: false }).limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function setAssistantChatMode(userId: string, accountJid: string, chatJid: string, mode: AiChatMode) {
  const current = await readChatControl(userId, accountJid, chatJid);
  const row = {
    user_id: userId,
    account_jid: accountJid,
    chat_jid: chatJid,
    mode,
    handoff_reason: mode === "human" ? current?.handoff_reason ?? "Needs a human reply" : null,
    workflow_state: current?.workflow_state ?? null,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await db().from("whatsapp_ai_chat_controls").upsert(row, { onConflict: "user_id,account_jid,chat_jid" })
    .select("chat_jid,mode,handoff_reason,workflow_state,updated_at").single();
  if (error) throw error;
  sessionManager.emit("ai-control", { userId, accountJid, chatJid, mode, handoffReason: data.handoff_reason, workflowState: data.workflow_state });
  return data;
}

export async function clearAssistantWorkflowData(userId: string, accountJid: string, chatJid: string) {
  const current = await readChatControl(userId, accountJid, chatJid);
  if (!current?.workflow_state) return;
  await setWorkflowState(userId, accountJid, chatJid, current, null);
}

async function setWorkflowState(
  userId: string,
  accountJid: string,
  chatJid: string,
  current: StoredChatControl | null,
  workflowState: StoredChatControl["workflow_state"]
) {
  const { error } = await db().from("whatsapp_ai_chat_controls").upsert({
    user_id: userId,
    account_jid: accountJid,
    chat_jid: chatJid,
    mode: current?.mode ?? "inherit",
    handoff_reason: current?.handoff_reason ?? null,
    workflow_state: workflowState,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id,account_jid,chat_jid" });
  if (error) throw error;
  sessionManager.emit("ai-control", {
    userId,
    accountJid,
    chatJid,
    mode: current?.mode ?? "inherit",
    handoffReason: current?.handoff_reason ?? null,
    workflowState
  });
}

async function flagHumanHandoff(userId: string, message: WhatsAppMessageRecord, reason: string) {
  const current = await readChatControl(userId, message.accountJid, message.chatJid);
  const { error } = await db().from("whatsapp_ai_chat_controls").upsert({
    user_id: userId,
    account_jid: message.accountJid,
    chat_jid: message.chatJid,
    mode: "human",
    handoff_reason: reason.slice(0, 300),
    workflow_state: current?.workflow_state ?? null,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id,account_jid,chat_jid" });
  if (error) throw error;
  sessionManager.emit("ai-control", { userId, accountJid: message.accountJid, chatJid: message.chatJid, mode: "human", handoffReason: reason.slice(0, 300), workflowState: current?.workflow_state ?? null });
}

function workflowText(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([a-z0-9_]+)\}\}/gi, (_, key: string) => values[key] ?? "").slice(0, 1500);
}

function selectKnowledge(items: Array<{ kind: string; title: string; content: string }>, message: string): string {
  const terms = new Set(message.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  const ranked = items.map((item) => {
    const searchable = `${item.title} ${item.content}`.toLowerCase();
    const score = [...terms].reduce((sum, term) => sum + (searchable.includes(term) ? 1 : 0), 0);
    return { item, score };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
  if (!ranked.length) return "No matching business knowledge was found. Do not guess business-specific facts; offer a human follow-up.";
  return ranked.map(({ item }) => `[${item.kind}] ${item.title}\n${item.content}`).join("\n\n").slice(0, 12000);
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

export async function listAssistantModels(
  userId: string,
  input: { provider: AiProvider; baseUrl?: string; apiKey?: string }
): Promise<AiModel[]> {
  let apiKey = input.apiKey?.trim();
  if (!apiKey) {
    const saved = await readStoredSettings(userId);
    if (saved?.api_key_ciphertext) apiKey = decryptAtRest(saved.api_key_ciphertext).toString("utf8");
  }
  if (!apiKey) throw new AiConfigError("Enter a provider API key to load its available models.");
  return listAiModels({
    provider: input.provider,
    apiKey,
    baseUrl: input.provider === "openai_compatible"
      ? validateCompatibleBaseUrl(input.baseUrl || PROVIDER_DEFAULTS.openai_compatible.baseUrl!)
      : PROVIDER_DEFAULTS[input.provider].baseUrl
  });
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

  const control = await readChatControl(userId, message.accountJid, jid);
  if (control?.mode === "paused" || control?.mode === "blocked" || control?.mode === "human") return;
  const chatIsEnabled = control?.mode === "enabled";
  if (!chatIsEnabled && (settings.reply_scope ?? "all") === "selected") return;

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

    const workflow = { ...DEFAULT_WORKFLOW_CONFIG, ...(settings.workflow_config ?? {}) };
    const workflowState = control?.workflow_state;
    if (workflow.enabled && workflowState && workflow.fields[workflowState.fieldIndex]) {
      if (/^(stop|cancel|cancel workflow|stop workflow)$/i.test(message.text!.trim())) {
        await setWorkflowState(userId, message.accountJid, jid, control, null);
        await updateEvent(userId, message, { status: "skipped", reason: "workflow_cancelled" });
        return;
      }
      const field = workflow.fields[workflowState.fieldIndex];
      const values = { ...workflowState.values, [field.key]: message.text!.trim().slice(0, 1000) };
      const nextIndex = workflowState.fieldIndex + 1;
      const nextField = workflow.fields[nextIndex];
      if (nextField) {
        await setWorkflowState(userId, message.accountJid, jid, control, { fieldIndex: nextIndex, values });
        const sent = await sessionManager.sendChatText(userId, message.accountJid, jid, workflowText(nextField.question, values), message.messageId);
        await updateEvent(userId, message, { status: "sent", reply_message_id: sent.messageId, reason: "workflow_step" });
        return;
      }
      await setWorkflowState(userId, message.accountJid, jid, control, { fieldIndex: workflow.fields.length, values, completed: true, workflowName: workflow.name, completedAt: new Date().toISOString() });
      const completion = workflowText(workflow.completionMessage, values);
      const sent = await sessionManager.sendChatText(userId, message.accountJid, jid, completion, message.messageId);
      await updateEvent(userId, message, { status: "sent", reply_message_id: sent.messageId, reason: "workflow_completed" });
      return;
    }

    const startKeyword = workflow.startKeyword.trim();
    if (workflow.enabled && startKeyword && workflow.fields.length > 0 && message.text!.toLowerCase().includes(startKeyword.toLowerCase())) {
      const firstQuestion = workflowText(workflow.fields[0].question, {});
      await setWorkflowState(userId, message.accountJid, jid, control, { fieldIndex: 0, values: {} });
      const sent = await sessionManager.sendChatText(userId, message.accountJid, jid, firstQuestion, message.messageId);
      await updateEvent(userId, message, { status: "sent", reply_message_id: sent.messageId, reason: "workflow_started" });
      return;
    }

    const [history, apiKey, knowledge] = await Promise.all([
      listMessages(userId, message.accountJid, jid, { limit: 12 }),
      Promise.resolve(decryptAtRest(settings.api_key_ciphertext).toString("utf8")),
      db().from("whatsapp_ai_knowledge_items").select("kind,title,content")
        .eq("user_id", userId).eq("active", true).limit(100)
    ]);
    if (knowledge.error) throw knowledge.error;
    const context = history.filter((item) => item.text?.trim()).slice(-12).map((item) => ({
      role: item.fromMe ? "assistant" as const : "user" as const,
      content: item.text!.trim().slice(0, 3000)
    }));
    const reply = await generateAiReply({
      provider: settings.provider,
      model: settings.model,
      apiKey,
      baseUrl: settings.base_url,
      systemPrompt: `${settings.system_prompt}\n\nBusiness knowledge (use this as the only source for business-specific facts):\n${selectKnowledge(knowledge.data ?? [], message.text)}`
    }, context);
    if (!reply) {
      await updateEvent(userId, message, { status: "skipped", reason: "empty_reply" });
      return;
    }

    const handoff = /^<HANDOFF>([\s\S]{1,300})<\/HANDOFF>$/i.exec(reply.trim());
    if (handoff) {
      await flagHumanHandoff(userId, message, handoff[1].trim());
      const sent = await sessionManager.sendChatText(userId, message.accountJid, jid, "I’m handing this conversation to a person who can help. They’ll follow up here soon.", message.messageId);
      await updateEvent(userId, message, { status: "handoff", reply_message_id: sent.messageId, reason: "human_handoff" });
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
