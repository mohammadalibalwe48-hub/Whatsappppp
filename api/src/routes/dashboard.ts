import { Router } from "express";
import express from "express";
import { z } from "zod";
import net from "net";
import { generateApiKey, generateWebhookSecret } from "../lib/crypto";
import { requireDashboardAuth } from "../middleware/auth";
import { HttpError } from "../middleware/errors";
import { getSupabase, supabaseAvailable } from "../lib/supabase";
import { sessionManager } from "../whatsapp/sessionManager";
import { normalizeWhatsappJid } from "../whatsapp/sessionManager";
import { ensureChat, listChats, listContacts, listMessages, listWhatsAppAccounts, savePhonebookContacts, searchInbox } from "../whatsapp/inboxStore";
import { parseVCard } from "../whatsapp/vcard";
import { rateLimit } from "../middleware/rateLimit";
import { sendOtp, verifyOtp, lookupOtp } from "../otp/service";
import { clearAssistantWorkflowData, createAssistantKnowledge, deleteAssistantKnowledge, getAssistantSettings, listAssistantActivity, listAssistantChatControls, listAssistantKnowledge, listAssistantModels, resumeAssistantAfterHumanReply, saveAssistantSettings, setAssistantChatMode, testAssistantProvider, updateAssistantKnowledge } from "../ai/assistant";
import { AiConfigError, AiProviderError } from "../ai/providers";

export const dashboardRouter = Router();

dashboardRouter.use(requireDashboardAuth());

function db() {
  if (!supabaseAvailable()) throw new HttpError(500, "Supabase not configured");
  return getSupabase();
}

// --- WhatsApp session ---------------------------------------------------------

dashboardRouter.get("/whatsapp/session", async (req, res, next) => {
  try {
    const state = await sessionManager.getStateForUser(req.userId!);
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

const whatsappSendLimit = rateLimit({ bucket: "whatsapp_send", windowSeconds: 60, limit: 30 });
const whatsappMediaLimit = rateLimit({ bucket: "whatsapp_media", windowSeconds: 60, limit: 10 });
const aiProviderTestLimit = rateLimit({ bucket: "ai_provider_test", windowSeconds: 60, limit: 5 });

const workflowConfigSchema = z.object({
  enabled: z.boolean().default(false),
  name: z.string().trim().max(100).default(""),
  startKeyword: z.string().trim().max(80).default(""),
  fields: z.array(z.object({
    key: z.string().regex(/^[a-z0-9_]{1,40}$/),
    label: z.string().trim().min(1).max(80),
    question: z.string().trim().min(1).max(500)
  })).max(8).default([]),
  completionMessage: z.string().trim().min(1).max(1000).default("Thanks, I have the details. A member of our team will follow up soon.")
}).superRefine((value, ctx) => {
  if (value.enabled && !value.startKeyword) ctx.addIssue({ code: "custom", message: "Add a start keyword for the workflow.", path: ["startKeyword"] });
  if (value.enabled && value.fields.length === 0) ctx.addIssue({ code: "custom", message: "Add at least one workflow question.", path: ["fields"] });
  value.fields.forEach((field, index) => {
    if (/(?:\botp\b|verification code|password|passcode|credit card|card number|\bcvv\b|payment details|bank account)/i.test(`${field.label} ${field.question}`)) {
      ctx.addIssue({ code: "custom", message: "Workflows cannot ask for passwords, verification codes, or payment credentials.", path: ["fields", index] });
    }
  });
});

const aiSettingsSchema = z.object({
  provider: z.enum(["gemini", "groq", "openai_compatible"]),
  model: z.string().trim().min(1).max(120),
  baseUrl: z.string().trim().max(300).optional(),
  systemPrompt: z.string().max(2000).default(""),
  enabled: z.boolean().default(false),
  maxRepliesPerDay: z.number().int().min(1).max(500).default(100),
  replyScope: z.enum(["all", "selected"]).default("all"),
  workflowConfig: workflowConfigSchema.default({ enabled: false, name: "", startKeyword: "", fields: [], completionMessage: "Thanks, I have the details. A member of our team will follow up soon." }),
  apiKey: z.string().trim().max(500).optional(),
  clearApiKey: z.boolean().optional()
});

const knowledgeSchema = z.object({
  kind: z.enum(["business", "faq", "policy", "website"]),
  title: z.string().trim().min(1).max(120),
  sourceUrl: z.union([z.string().trim().max(500).url().refine((value) => value.startsWith("https://"), "Website URL must start with https://"), z.literal("")]).optional(),
  content: z.string().trim().min(1).max(6000)
});

dashboardRouter.get("/ai/knowledge", async (req, res, next) => {
  try {
    res.json({ ok: true, items: await listAssistantKnowledge(req.userId!) });
  } catch (err) { next(err); }
});

dashboardRouter.post("/ai/knowledge", async (req, res, next) => {
  try {
    const item = await createAssistantKnowledge(req.userId!, knowledgeSchema.parse(req.body ?? {}));
    res.status(201).json({ ok: true, item });
  } catch (err) { next(err); }
});

dashboardRouter.patch("/ai/knowledge/:id", async (req, res, next) => {
  try {
    const body = knowledgeSchema.extend({ active: z.boolean().default(true) }).parse(req.body ?? {});
    const item = await updateAssistantKnowledge(req.userId!, z.string().uuid().parse(req.params.id), body);
    res.json({ ok: true, item });
  } catch (err) { next(err); }
});

dashboardRouter.delete("/ai/knowledge/:id", async (req, res, next) => {
  try {
    await deleteAssistantKnowledge(req.userId!, z.string().uuid().parse(req.params.id));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

dashboardRouter.get("/ai/chats", async (req, res, next) => {
  try {
    const accountJid = await requestedAccount(req.userId!, req.query.accountJid);
    res.json({ ok: true, controls: accountJid ? await listAssistantChatControls(req.userId!, accountJid) : [] });
  } catch (err) { next(err); }
});

dashboardRouter.post("/ai/chats/control", async (req, res, next) => {
  try {
    const body = z.object({
      accountJid: z.string().min(3).max(150),
      chatJid: z.string().min(5).max(200),
      mode: z.enum(["inherit", "enabled", "paused", "blocked"])
    }).parse(req.body ?? {});
    const accountJid = await requestedAccount(req.userId!, body.accountJid);
    if (!accountJid) throw new HttpError(404, "WhatsApp account not found.");
    const chatJid = routeChatJid(body.chatJid);
    const control = await setAssistantChatMode(req.userId!, accountJid, chatJid, body.mode);
    res.json({ ok: true, control });
  } catch (err) { next(err); }
});

dashboardRouter.post("/ai/chats/workflow/clear", async (req, res, next) => {
  try {
    const body = z.object({ accountJid: z.string().min(3).max(150), chatJid: z.string().min(5).max(200) }).parse(req.body ?? {});
    const accountJid = await requestedAccount(req.userId!, body.accountJid);
    if (!accountJid) throw new HttpError(404, "WhatsApp account not found.");
    await clearAssistantWorkflowData(req.userId!, accountJid, routeChatJid(body.chatJid));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

const aiModelsSchema = z.object({
  provider: z.enum(["gemini", "groq", "openai_compatible"]),
  baseUrl: z.string().trim().max(300).optional(),
  apiKey: z.string().trim().max(500).optional()
});

const aiModelListLimit = rateLimit({ bucket: "ai_model_list", windowSeconds: 60, limit: 20 });

dashboardRouter.post("/ai/models", aiModelListLimit, async (req, res, next) => {
  try {
    const input = aiModelsSchema.parse(req.body ?? {});
    const models = await listAssistantModels(req.userId!, input);
    res.json({ ok: true, models });
  } catch (err) {
    next(err instanceof AiConfigError || err instanceof AiProviderError ? new HttpError(400, err.message) : err);
  }
});

dashboardRouter.get("/ai/settings", async (req, res, next) => {
  try {
    res.json({ ok: true, settings: await getAssistantSettings(req.userId!) });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.put("/ai/settings", async (req, res, next) => {
  try {
    const input = aiSettingsSchema.parse(req.body ?? {});
    const settings = await saveAssistantSettings(req.userId!, input);
    res.json({ ok: true, settings });
  } catch (err) {
    next(err instanceof AiConfigError ? new HttpError(400, err.message) : err);
  }
});

dashboardRouter.post("/ai/test", aiProviderTestLimit, async (req, res, next) => {
  try {
    const input = aiSettingsSchema.parse({ ...(req.body ?? {}), enabled: false });
    await testAssistantProvider(req.userId!, input);
    res.json({ ok: true });
  } catch (err) {
    next(err instanceof AiConfigError || err instanceof AiProviderError ? new HttpError(400, err.message) : err);
  }
});

dashboardRouter.get("/ai/activity", async (req, res, next) => {
  try {
    res.json({ ok: true, events: await listAssistantActivity(req.userId!) });
  } catch (err) {
    next(err);
  }
});
const chatJidSchema = z.string().min(5).max(200);

function routeChatJid(value: string): string {
  try {
    return normalizeWhatsappJid(value);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "Invalid WhatsApp chat ID.");
  }
}

async function requestedAccount(userId: string, value?: unknown): Promise<string | null> {
  try {
    const requested = typeof value === "string" && value.length > 0 ? value : undefined;
    return await sessionManager.getAccountJid(userId, requested);
  } catch (error) {
    throw new HttpError(404, error instanceof Error ? error.message : "WhatsApp account not found.");
  }
}

dashboardRouter.get("/whatsapp/accounts", async (req, res, next) => {
  try {
    const [accounts, state] = await Promise.all([
      listWhatsAppAccounts(req.userId!),
      sessionManager.getStateForUser(req.userId!)
    ]);
    res.json({ ok: true, accounts, activeAccountJid: state.accountJid });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/whatsapp/chats", async (req, res, next) => {
  try {
    const archived = req.query.archived === "true";
    const limit = Number(req.query.limit ?? 100);
    const accountJid = await requestedAccount(req.userId!, req.query.accountJid);
    const chats = accountJid ? await listChats(req.userId!, accountJid, { archived, limit: Number.isFinite(limit) ? limit : 100 }) : [];
    res.json({ ok: true, chats });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.post("/whatsapp/chats/open", async (req, res, next) => {
  try {
    const body = z.object({ jid: chatJidSchema, name: z.string().max(120).optional(), accountJid: z.string().max(150).optional() }).parse(req.body ?? {});
    const jid = routeChatJid(body.jid);
    const accountJid = await requestedAccount(req.userId!, body.accountJid);
    if (!accountJid) throw new HttpError(409, "Connect WhatsApp before opening a conversation.");
    await ensureChat(req.userId!, accountJid, jid, body.name, jid.endsWith("@g.us"));
    res.json({ ok: true, jid, accountJid });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/whatsapp/chats/:jid/messages", async (req, res, next) => {
  try {
    const jid = routeChatJid(req.params.jid);
    const limit = Number(req.query.limit ?? 50);
    const before = typeof req.query.before === "string" ? req.query.before : undefined;
    const accountJid = await requestedAccount(req.userId!, req.query.accountJid);
    const messages = accountJid ? await listMessages(req.userId!, accountJid, jid, { before, limit: Number.isFinite(limit) ? limit : 50 }) : [];
    res.json({ ok: true, messages });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/whatsapp/search", async (req, res, next) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : "";
    if (!query) return res.json({ ok: true, chats: [], messages: [], contacts: [] });
    const accountJid = await requestedAccount(req.userId!, req.query.accountJid);
    const results = accountJid ? await searchInbox(req.userId!, accountJid, query) : { chats: [], messages: [], contacts: [] };
    res.json({ ok: true, ...results });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/whatsapp/contacts", async (req, res, next) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : undefined;
    const accountJid = await requestedAccount(req.userId!, req.query.accountJid);
    const contacts = accountJid ? await listContacts(req.userId!, accountJid, query) : [];
    res.json({ ok: true, contacts });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.post(
  "/whatsapp/contacts/import",
  express.raw({ type: "application/octet-stream", limit: "5mb" }),
  async (req, res, next) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, "Choose a non-empty vCard file.");
      const accountJid = await requestedAccount(req.userId!, typeof req.query.accountJid === "string" ? req.query.accountJid : undefined);
      if (!accountJid) throw new HttpError(409, "Connect WhatsApp before importing contacts.");
      const countryCode = typeof req.query.countryCode === "string" ? req.query.countryCode : undefined;
      if (countryCode && !/^\+?\d{1,4}$/.test(countryCode.trim())) throw new HttpError(400, "Enter a country calling code such as +964.");
      const parsed = parseVCard(req.body, countryCode);
      if (parsed.contacts.length === 0) throw new HttpError(400, "No contacts with a usable phone number were found in that vCard.");
      const imported = await savePhonebookContacts(req.userId!, accountJid, parsed.contacts);
      res.json({ ok: true, imported, skipped: parsed.skipped });
    } catch (err) {
      next(err);
    }
  }
);

dashboardRouter.post("/whatsapp/chats/:jid/messages", whatsappSendLimit, async (req, res, next) => {
  try {
    const jid = routeChatJid(req.params.jid);
    const accountJid = await requestedAccount(req.userId!, req.query.accountJid);
    if (!accountJid) throw new HttpError(409, "Connect WhatsApp before sending messages.");
    const body = z.object({
      text: z.string().trim().min(1).max(5000),
      quotedMessageId: z.string().min(1).max(200).optional()
    }).parse(req.body ?? {});
    const message = await sessionManager.sendChatText(req.userId!, accountJid, jid, body.text, body.quotedMessageId);
    await resumeAssistantAfterHumanReply(req.userId!, message);
    res.json({ ok: true, message });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.post(
  "/whatsapp/chats/:jid/media",
  whatsappMediaLimit,
  express.raw({ type: "application/octet-stream", limit: "8mb" }),
  async (req, res, next) => {
    try {
      const jid = routeChatJid(req.params.jid);
      const accountJid = await requestedAccount(req.userId!, req.query.accountJid);
      if (!accountJid) throw new HttpError(409, "Connect WhatsApp before sending files.");
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, "Choose a non-empty file to send.");
      const params = z.object({
        mediaType: z.enum(["image", "document", "audio"]),
        mimeType: z.string().min(3).max(120),
        fileName: z.string().max(255).optional(),
        caption: z.string().max(1000).optional(),
        quotedMessageId: z.string().min(1).max(200).optional()
      }).parse(req.query);
      if (params.mediaType === "image" && !/^image\/(jpeg|png|webp|gif)$/i.test(params.mimeType)) {
        throw new HttpError(400, "Images must be JPEG, PNG, WebP, or GIF.");
      }
      if (params.mediaType === "audio" && !/^audio\/(ogg|mpeg|mp4|aac|wav|webm)$/i.test(params.mimeType)) {
        throw new HttpError(400, "Audio must use a supported audio format.");
      }
      const message = await sessionManager.sendMedia(
        req.userId!, accountJid, jid, params.mediaType, req.body, params.mimeType,
        params.fileName, params.caption, params.quotedMessageId
      );
      await resumeAssistantAfterHumanReply(req.userId!, message);
      res.json({ ok: true, message });
    } catch (err) {
      next(err);
    }
  }
);

dashboardRouter.post("/whatsapp/chats/:jid/location", whatsappSendLimit, async (req, res, next) => {
  try {
    const jid = routeChatJid(req.params.jid);
    const accountJid = await requestedAccount(req.userId!, req.query.accountJid);
    if (!accountJid) throw new HttpError(409, "Connect WhatsApp before sharing a location.");
    const body = z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      name: z.string().max(120).optional(),
      address: z.string().max(300).optional()
    }).parse(req.body ?? {});
    const message = await sessionManager.sendLocation(req.userId!, accountJid, jid, body.latitude, body.longitude, body.name, body.address);
    res.json({ ok: true, message });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.post("/whatsapp/chats/:jid/reactions", whatsappSendLimit, async (req, res, next) => {
  try {
    const jid = routeChatJid(req.params.jid);
    const accountJid = await requestedAccount(req.userId!, req.query.accountJid);
    if (!accountJid) throw new HttpError(409, "Connect WhatsApp before reacting to messages.");
    const body = z.object({ messageId: z.string().min(1).max(200), reaction: z.string().max(16) }).parse(req.body ?? {});
    const message = await sessionManager.reactToMessage(req.userId!, accountJid, jid, body.messageId, body.reaction);
    res.json({ ok: true, message });
  } catch (err) {
    next(err);
  }
});

const chatActionSchema = z.object({
  action: z.enum(["mark_read", "mark_unread", "archive", "unarchive", "pin", "unpin", "mute", "unmute", "labels"]),
  durationMinutes: z.number().int().min(1).max(10080).optional(),
  labels: z.array(z.string().trim().min(1).max(40)).max(20).optional()
}).refine((value) => value.action !== "labels" || value.labels !== undefined, { message: "Labels are required for the labels action." });

dashboardRouter.patch("/whatsapp/chats/:jid", async (req, res, next) => {
  try {
    const jid = routeChatJid(req.params.jid);
    const accountJid = await requestedAccount(req.userId!, req.query.accountJid);
    if (!accountJid) throw new HttpError(409, "Connect WhatsApp before managing a chat.");
    const body = chatActionSchema.parse(req.body ?? {});
    const chat = await sessionManager.modifyChat(req.userId!, accountJid, jid, body.action, {
      durationMinutes: body.durationMinutes,
      labels: body.labels
    });
    if (!chat) throw new HttpError(404, "Chat not found.");
    res.json({ ok: true, chat });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.post("/whatsapp/groups", whatsappSendLimit, async (req, res, next) => {
  try {
    const body = z.object({
      subject: z.string().trim().min(1).max(100),
      participants: z.array(z.string().trim().min(7).max(30)).min(1).max(256)
    }).parse(req.body ?? {});
    const participants = body.participants.map(routeChatJid);
    const group = await sessionManager.createGroup(req.userId!, body.subject, participants);
    res.json({ ok: true, group });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/whatsapp/groups/:jid/members", async (req, res, next) => {
  try {
    const members = await sessionManager.getGroupMembers(req.userId!, routeChatJid(req.params.jid));
    res.json({ ok: true, ...members });
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
      .select(
        "id,name,prefix,created_at,last_used_at,revoked_at,default_otp_length,default_otp_alphabet"
      )
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ ok: true, apiKeys: data ?? [] });
  } catch (err) {
    next(err);
  }
});

const otpAlphabetSchema = z.enum(["numeric", "alphanumeric", "alphabetic"]);
const otpLengthSchema = z.number().int().min(4).max(10);

const createApiKeySchema = z.object({
  name: z.string().min(1).max(80),
  defaultOtpLength: otpLengthSchema.optional(),
  defaultOtpAlphabet: otpAlphabetSchema.optional()
});

const updateApiKeySchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    defaultOtpLength: otpLengthSchema.optional(),
    defaultOtpAlphabet: otpAlphabetSchema.optional()
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.defaultOtpLength !== undefined ||
      v.defaultOtpAlphabet !== undefined,
    { message: "No fields to update" }
  );

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
        key_hash: hash,
        default_otp_length: body.defaultOtpLength ?? 6,
        default_otp_alphabet: body.defaultOtpAlphabet ?? "numeric"
      })
      .select(
        "id,name,prefix,created_at,last_used_at,revoked_at,default_otp_length,default_otp_alphabet"
      )
      .single();
    if (error) throw error;
    res.json({ ok: true, apiKey: data, secret: publicKey });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.patch("/api-keys/:id", async (req, res, next) => {
  try {
    const body = updateApiKeySchema.parse(req.body ?? {});
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.defaultOtpLength !== undefined) patch.default_otp_length = body.defaultOtpLength;
    if (body.defaultOtpAlphabet !== undefined) patch.default_otp_alphabet = body.defaultOtpAlphabet;

    const supabase = db();
    const { data, error } = await supabase
      .from("api_keys")
      .update(patch)
      .eq("id", req.params.id)
      .eq("user_id", req.userId!)
      .select(
        "id,name,prefix,created_at,last_used_at,revoked_at,default_otp_length,default_otp_alphabet"
      )
      .single();
    if (error) throw error;
    res.json({ ok: true, apiKey: data });
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
    const totals = { sent: rows.length, verified: 0, failed: 0, expired: 0, pending: 0 };
    for (let i = 0; i < rows.length; i++) {
      const s = rows[i].status;
      if (s === "verified") totals.verified++;
      else if (s === "failed") totals.failed++;
      else if (s === "expired") totals.expired++;
      else if (s === "pending") totals.pending++;
    }
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

const isPrivateIP = (ip: string): boolean => {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    return (
      parts[0] === 127 || // Loopback
      parts[0] === 10 || // 10.0.0.0/8
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
      (parts[0] === 192 && parts[1] === 168) || // 192.168.0.0/16
      (parts[0] === 169 && parts[1] === 254) || // 169.254.0.0/16
      parts[0] === 0 // 0.0.0.0/8
    );
  } else if (net.isIPv6(ip)) {
    const isLoopback = ip === "::1" || ip === "0:0:0:0:0:0:0:1";
    const isUniqueLocal = /^[fF][cCdD]/.test(ip);
    const isLinkLocal = /^[fF][eE][89aAbB]/.test(ip);
    const isIPv4Mapped = /^::[fF]{4}:/.test(ip);
    return isLoopback || isUniqueLocal || isLinkLocal || isIPv4Mapped;
  }
  return false;
};

const secureUrlSchema = z.string().url().superRefine((val, ctx) => {
  try {
    const url = new URL(val);
    const host = url.hostname.replace(/^\[(.*)\]$/, "$1"); // Remove IPv6 brackets

    if (host === "localhost" || host.endsWith(".localhost")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Localhost is not allowed" });
      return;
    }

    if (isPrivateIP(host)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Private/internal IPs are not allowed" });
    }
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid URL" });
  }
});

const createWebhookSchema = z.object({
  url: secureUrlSchema,
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
      url: secureUrlSchema.optional()
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

// --- Playground (in-dashboard test sender) -----------------------------------
// Picks an active API key automatically so the user doesn't have to paste theirs.

async function pickApiKey(userId: string) {
  const supabase = db();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id,name,prefix,default_otp_length,default_otp_alphabet")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new HttpError(
      400,
      "You need at least one active API key to use the playground. Create one first."
    );
  }
  return data;
}

dashboardRouter.post("/playground/send", async (req, res, next) => {
  try {
    const body = z
      .object({
        phoneNumber: z.string().min(6).max(20),
        appName: z.string().max(60).optional(),
        length: z.number().int().min(4).max(10).optional(),
        alphabet: z.enum(["numeric", "alphanumeric", "alphabetic"]).optional(),
        ttlSeconds: z.number().int().min(30).max(60 * 60).optional()
      })
      .parse(req.body ?? {});
    const key = await pickApiKey(req.userId!);
    const result = await sendOtp({
      userId: req.userId!,
      apiKeyId: key.id,
      phoneNumber: body.phoneNumber,
      appName: body.appName ?? "OtpWave Playground",
      length: body.length ?? key.default_otp_length ?? 6,
      alphabet: body.alphabet ?? key.default_otp_alphabet ?? "numeric",
      ttlSeconds: body.ttlSeconds,
      ip: req.ip,
      userAgent: req.headers["user-agent"] ?? null
    });
    res.json({
      ok: true,
      ...result,
      apiKey: { id: key.id, name: key.name, prefix: key.prefix }
    });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.post("/playground/verify", async (req, res, next) => {
  try {
    const body = z
      .object({
        otpId: z.string().optional(),
        phoneNumber: z.string().min(6).max(20).optional(),
        code: z.string().min(4).max(10)
      })
      .refine((v) => v.otpId || v.phoneNumber, {
        message: "Either otpId or phoneNumber is required"
      })
      .parse(req.body ?? {});
    const key = await pickApiKey(req.userId!);
    const result = await verifyOtp({
      userId: req.userId!,
      apiKeyId: key.id,
      otpId: body.otpId,
      phoneNumber: body.phoneNumber,
      code: body.code
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/playground/lookup", async (req, res, next) => {
  try {
    const otpId = String(req.query.otpId ?? "");
    if (!otpId) throw new HttpError(400, "otpId required");
    const record = await lookupOtp({ userId: req.userId!, otpId });
    res.json({ ok: true, record });
  } catch (err) {
    next(err);
  }
});

// --- Onboarding progress -----------------------------------------------------

dashboardRouter.get("/onboarding", async (req, res, next) => {
  try {
    const supabase = db();
    const session = sessionManager.getState(req.userId!);
    const waConnected = session?.status === "connected";

    const [{ count: keysCount }, { count: logsCount }, { count: webhooksCount }] =
      await Promise.all([
        supabase
          .from("api_keys")
          .select("id", { count: "exact", head: true })
          .eq("user_id", req.userId!)
          .is("revoked_at", null),
        supabase
          .from("otp_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", req.userId!),
        supabase
          .from("webhook_endpoints")
          .select("id", { count: "exact", head: true })
          .eq("user_id", req.userId!)
          .eq("active", true)
      ]);

    const steps = [
      {
        id: "pair_whatsapp",
        title: "Pair your WhatsApp",
        description: "Link your phone to OtpWave to send OTPs.",
        href: "/dashboard/whatsapp",
        done: waConnected
      },
      {
        id: "create_key",
        title: "Create your first API key",
        description: "Generate credentials so your app can authenticate.",
        href: "/dashboard/api-keys",
        done: (keysCount ?? 0) > 0
      },
      {
        id: "send_otp",
        title: "Send a test OTP",
        description: "Try the playground to verify end-to-end delivery.",
        href: "/dashboard/playground",
        done: (logsCount ?? 0) > 0
      },
      {
        id: "webhook",
        title: "Add a webhook (optional)",
        description: "Get notified when OTPs are sent, verified, or fail.",
        href: "/dashboard/webhooks",
        done: (webhooksCount ?? 0) > 0
      }
    ];

    const completed = steps.filter((s) => s.done).length;
    res.json({
      ok: true,
      steps,
      completed,
      total: steps.length,
      finished: completed === steps.length
    });
  } catch (err) {
    next(err);
  }
});

// --- Profile + account management --------------------------------------------

dashboardRouter.patch("/profile", async (req, res, next) => {
  try {
    const body = z
      .object({
        full_name: z.string().max(120).nullable().optional(),
        avatar_url: z.string().url().nullable().optional()
      })
      .parse(req.body ?? {});

    const supabase = db();
    const patch: Record<string, unknown> = {};
    if (body.full_name !== undefined) patch.full_name = body.full_name;
    if (body.avatar_url !== undefined) patch.avatar_url = body.avatar_url;

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", req.userId!);
      if (error) throw error;
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.delete("/account", async (req, res, next) => {
  try {
    const userId = req.userId!;
    const supabase = db();

    // Stop the socket before deleting the account, then remove its pairing data.
    try {
      await sessionManager.stop(userId);
    } catch {
      // best-effort
    }

    // Delete the auth row (RLS cascades remove profile/api_keys/otp_logs/webhooks
    // via the user_id foreign keys with ON DELETE CASCADE).
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;
    await sessionManager.logout(userId);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
