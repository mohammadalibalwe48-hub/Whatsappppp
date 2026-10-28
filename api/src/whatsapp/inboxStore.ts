import {
  getContentType,
  normalizeMessageContent,
  type Chat,
  type Contact,
  type WAMessage
} from "@whiskeysockets/baileys";
import { getSupabase, supabaseAvailable } from "../lib/supabase";

export type WhatsAppMessageType = "text" | "image" | "video" | "audio" | "document" | "sticker" | "location" | "contact" | "reaction" | "unknown";

export interface WhatsAppChatSummary {
  jid: string;
  name: string | null;
  isGroup: boolean;
  unreadCount: number;
  lastMessageId: string | null;
  lastMessageText: string | null;
  lastMessageType: WhatsAppMessageType | null;
  lastMessageAt: string | null;
  isArchived: boolean;
  isPinned: boolean;
  mutedUntil: string | null;
  labels: string[];
  updatedAt: string;
}

export interface WhatsAppMessageRecord {
  chatJid: string;
  messageId: string;
  participantJid: string | null;
  fromMe: boolean;
  messageType: WhatsAppMessageType;
  text: string | null;
  caption: string | null;
  mimeType: string | null;
  fileName: string | null;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  quotedMessageId: string | null;
  status: "pending" | "sent" | "delivered" | "read" | "failed" | "received";
  sentAt: string;
}

export interface WhatsAppContact {
  jid: string;
  name: string | null;
  notify: string | null;
  verifiedName: string | null;
  updatedAt: string;
}

function db() {
  if (!supabaseAvailable()) throw new Error("Supabase is not configured");
  return getSupabase();
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function timestampSeconds(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  if (value && typeof value === "object" && "toNumber" in value) {
    const toNumber = (value as { toNumber?: () => number }).toNumber;
    if (typeof toNumber === "function") return toNumber.call(value);
  }
  return Math.floor(Date.now() / 1000);
}

function messageType(contentType: string | undefined): WhatsAppMessageType {
  if (!contentType) return "unknown";
  if (contentType === "conversation" || contentType === "extendedTextMessage") return "text";
  if (contentType === "imageMessage") return "image";
  if (contentType === "videoMessage") return "video";
  if (contentType === "audioMessage") return "audio";
  if (contentType === "documentMessage") return "document";
  if (contentType === "stickerMessage") return "sticker";
  if (contentType === "locationMessage" || contentType === "liveLocationMessage") return "location";
  if (contentType === "contactMessage" || contentType === "contactsArrayMessage") return "contact";
  if (contentType === "reactionMessage") return "reaction";
  return "unknown";
}

export function normalizeWhatsAppMessage(message: WAMessage): WhatsAppMessageRecord | null {
  const chatJid = stringValue(message.key.remoteJid);
  const messageId = stringValue(message.key.id);
  if (!chatJid || !messageId || chatJid === "status@broadcast" || chatJid.endsWith("@broadcast")) return null;

  const content = normalizeMessageContent(message.message);
  const contentType = getContentType(content);
  const contentRecord = record(content);
  const selected = record(contentType ? contentRecord[contentType] : undefined);
  const type = messageType(contentType);
  const text = contentType === "conversation"
    ? stringValue(contentRecord.conversation)
    : contentType === "extendedTextMessage"
      ? stringValue(selected.text)
      : contentType === "buttonsResponseMessage"
        ? stringValue(selected.selectedDisplayText)
        : contentType === "listResponseMessage"
          ? stringValue(selected.title)
          : contentType === "locationMessage"
            ? stringValue(selected.name) ?? stringValue(selected.address)
            : contentType === "contactMessage"
              ? stringValue(selected.displayName)
              : contentType === "reactionMessage"
                ? stringValue(selected.text)
              : null;
  const caption = stringValue(selected.caption);
  const contextInfo = record(selected.contextInfo);
  const reactionTarget = record(selected.key);
  const location = type === "location" ? selected : {};
  const statusValue = Number(message.status ?? 0);
  const status: WhatsAppMessageRecord["status"] = !message.key.fromMe
    ? "received"
    : statusValue >= 4 ? "read" : statusValue >= 3 ? "delivered" : "sent";

  return {
    chatJid,
    messageId,
    participantJid: stringValue(message.key.participant) ?? stringValue(message.key.participantPn) ?? stringValue(message.key.participantLid),
    fromMe: message.key.fromMe === true,
    messageType: type,
    text,
    caption,
    mimeType: stringValue(selected.mimetype),
    fileName: stringValue(selected.fileName),
    latitude: numberValue(location.degreesLatitude),
    longitude: numberValue(location.degreesLongitude),
    locationName: stringValue(location.name) ?? stringValue(location.address),
    quotedMessageId: stringValue(contextInfo.stanzaId) ?? (type === "reaction" ? stringValue(reactionTarget.id) : null),
    status,
    sentAt: new Date(timestampSeconds(message.messageTimestamp) * 1000).toISOString()
  };
}

function displayPreview(message: WhatsAppMessageRecord): string {
  if (message.messageType === "reaction") return message.text ? "Reaction " + message.text : "Reaction removed";
  return message.text ?? message.caption ?? message.fileName ?? `[${message.messageType}]`;
}

function dbChatToApi(row: Record<string, unknown>): WhatsAppChatSummary {
  return {
    jid: String(row.jid),
    name: stringValue(row.name),
    isGroup: row.is_group === true,
    unreadCount: typeof row.unread_count === "number" ? row.unread_count : 0,
    lastMessageId: stringValue(row.last_message_id),
    lastMessageText: stringValue(row.last_message_text),
    lastMessageType: stringValue(row.last_message_type) as WhatsAppMessageType | null,
    lastMessageAt: stringValue(row.last_message_at),
    isArchived: row.is_archived === true,
    isPinned: row.is_pinned === true,
    mutedUntil: stringValue(row.muted_until),
    labels: Array.isArray(row.labels) ? row.labels.filter((v): v is string => typeof v === "string") : [],
    updatedAt: stringValue(row.updated_at) ?? new Date().toISOString()
  };
}

export async function listChats(userId: string, options: { archived?: boolean; limit?: number } = {}): Promise<WhatsAppChatSummary[]> {
  let query = db().from("whatsapp_chats").select("*").eq("user_id", userId);
  if (options.archived !== undefined) query = query.eq("is_archived", options.archived);
  const { data, error } = await query
    .order("is_pinned", { ascending: false })
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(options.limit ?? 100, 250)));
  if (error) throw error;
  return (data ?? []).map((row) => dbChatToApi(row as Record<string, unknown>));
}

export async function getChat(userId: string, jid: string): Promise<WhatsAppChatSummary | null> {
  const { data, error } = await db().from("whatsapp_chats").select("*").eq("user_id", userId).eq("jid", jid).maybeSingle();
  if (error) throw error;
  return data ? dbChatToApi(data as Record<string, unknown>) : null;
}

export async function ensureChat(userId: string, jid: string, name?: string | null, isGroup?: boolean): Promise<void> {
  await mergeChat(userId, jid, {
    ...(name ? { name } : {}),
    ...(isGroup !== undefined ? { is_group: isGroup } : {})
  });
}

async function mergeChat(userId: string, jid: string, patch: Record<string, unknown>): Promise<void> {
  const supabase = db();
  const updatedAt = new Date().toISOString();
  const { data: existing, error: readError } = await supabase
    .from("whatsapp_chats")
    .select("jid,last_message_at")
    .eq("user_id", userId)
    .eq("jid", jid)
    .maybeSingle();
  if (readError) throw readError;

  if (existing) {
    const nextPatch: Record<string, unknown> = { ...patch, updated_at: updatedAt };
    const incomingAt = typeof patch.last_message_at === "string" ? Date.parse(patch.last_message_at) : null;
    const currentAt = typeof existing.last_message_at === "string" ? Date.parse(existing.last_message_at) : null;
    if (incomingAt !== null && currentAt !== null && incomingAt < currentAt) {
      delete nextPatch.last_message_id;
      delete nextPatch.last_message_text;
      delete nextPatch.last_message_type;
      delete nextPatch.last_message_at;
    }
    const { error } = await supabase.from("whatsapp_chats").update(nextPatch).eq("user_id", userId).eq("jid", jid);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("whatsapp_chats").insert({
    user_id: userId,
    jid,
    name: null,
    is_group: jid.endsWith("@g.us"),
    unread_count: 0,
    last_message_id: null,
    last_message_text: null,
    last_message_type: null,
    last_message_at: null,
    is_archived: false,
    is_pinned: false,
    muted_until: null,
    labels: [],
    ...patch,
    updated_at: updatedAt
  });
  if (error?.code === "23505") {
    const { error: updateError } = await supabase.from("whatsapp_chats").update({ ...patch, updated_at: updatedAt }).eq("user_id", userId).eq("jid", jid);
    if (updateError) throw updateError;
  } else if (error) {
    throw error;
  }
}

export async function saveWhatsAppChats(userId: string, chats: Array<Partial<Chat>>): Promise<WhatsAppChatSummary[]> {
  const saved: WhatsAppChatSummary[] = [];
  for (const chat of chats) {
    const jid = stringValue(chat.id);
    if (!jid || jid.endsWith("@broadcast") || jid.endsWith("@newsletter")) continue;
    const muteTimestamp = numberValue(chat.muteEndTime);
    await mergeChat(userId, jid, {
      ...(stringValue(chat.name) ? { name: stringValue(chat.name) } : {}),
      ...(typeof chat.unreadCount === "number" ? { unread_count: Math.max(0, chat.unreadCount) } : {}),
      ...(typeof chat.archived === "boolean" ? { is_archived: chat.archived } : {}),
      ...(typeof chat.pinned === "boolean" ? { is_pinned: chat.pinned } : {}),
      ...(muteTimestamp !== null ? { muted_until: muteTimestamp > 0 ? new Date(muteTimestamp * 1000).toISOString() : null } : {}),
      is_group: jid.endsWith("@g.us")
    });
    const row = await getChat(userId, jid);
    if (row) saved.push(row);
  }
  return saved;
}

export async function saveWhatsAppContacts(userId: string, contacts: Array<Contact | Partial<Contact>>): Promise<void> {
  const supabase = db();
  for (const contact of contacts) {
    const jid = stringValue(contact.jid) ?? stringValue(contact.id) ?? stringValue(contact.lid);
    if (!jid || jid.endsWith("@broadcast") || jid.endsWith("@newsletter")) continue;
    const patch = {
      ...(stringValue(contact.name) ? { name: contact.name } : {}),
      ...(stringValue(contact.notify) ? { notify: contact.notify } : {}),
      ...(stringValue(contact.verifiedName) ? { verified_name: contact.verifiedName } : {}),
      updated_at: new Date().toISOString()
    };
    const { data: existing, error: readError } = await supabase.from("whatsapp_contacts").select("jid").eq("user_id", userId).eq("jid", jid).maybeSingle();
    if (readError) throw readError;
    if (existing) {
      const { error } = await supabase.from("whatsapp_contacts").update(patch).eq("user_id", userId).eq("jid", jid);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("whatsapp_contacts").insert({ user_id: userId, jid, name: null, notify: null, verified_name: null, ...patch });
      if (error?.code === "23505") {
        const { error: updateError } = await supabase.from("whatsapp_contacts").update(patch).eq("user_id", userId).eq("jid", jid);
        if (updateError) throw updateError;
      } else if (error) {
        throw error;
      }
    }
  }
}

function rowFromMessage(userId: string, message: WhatsAppMessageRecord) {
  return {
    user_id: userId,
    chat_jid: message.chatJid,
    message_id: message.messageId,
    participant_jid: message.participantJid,
    is_from_me: message.fromMe,
    message_type: message.messageType,
    text_body: message.text,
    caption: message.caption,
    mime_type: message.mimeType,
    file_name: message.fileName,
    latitude: message.latitude,
    longitude: message.longitude,
    location_name: message.locationName,
    quoted_message_id: message.quotedMessageId,
    status: message.status,
    sent_at: message.sentAt
  };
}

export async function saveWhatsAppMessages(userId: string, baileysMessages: WAMessage[]): Promise<WhatsAppMessageRecord[]> {
  const messages = baileysMessages.map(normalizeWhatsAppMessage).filter((message): message is WhatsAppMessageRecord => Boolean(message));
  if (messages.length === 0) return [];

  const latestByChat = new Map<string, WhatsAppMessageRecord>();
  for (const message of messages) {
    const latest = latestByChat.get(message.chatJid);
    if (!latest || Date.parse(message.sentAt) > Date.parse(latest.sentAt)) latestByChat.set(message.chatJid, message);
  }
  for (const latest of latestByChat.values()) {
    await mergeChat(userId, latest.chatJid, {
      is_group: latest.chatJid.endsWith("@g.us"),
      last_message_id: latest.messageId,
      last_message_text: displayPreview(latest),
      last_message_type: latest.messageType,
      last_message_at: latest.sentAt
    });
  }

  const supabase = db();
  for (let offset = 0; offset < messages.length; offset += 100) {
    const rows = messages.slice(offset, offset + 100).map((message) => rowFromMessage(userId, message));
    const { error } = await supabase.from("whatsapp_messages").upsert(rows, { onConflict: "user_id,chat_jid,message_id" });
    if (error) throw error;
  }
  return messages;
}

export async function listMessages(userId: string, jid: string, options: { before?: string; limit?: number } = {}): Promise<WhatsAppMessageRecord[]> {
  let query = db().from("whatsapp_messages").select("*").eq("user_id", userId).eq("chat_jid", jid);
  if (options.before) query = query.lt("sent_at", options.before);
  const { data, error } = await query.order("sent_at", { ascending: false }).order("message_id", { ascending: false }).limit(Math.max(1, Math.min(options.limit ?? 50, 100)));
  if (error) throw error;
  return (data ?? []).reverse().map((row) => {
    const item = row as Record<string, unknown>;
    return {
      chatJid: String(item.chat_jid),
      messageId: String(item.message_id),
      participantJid: stringValue(item.participant_jid),
      fromMe: item.is_from_me === true,
      messageType: stringValue(item.message_type) as WhatsAppMessageType ?? "unknown",
      text: stringValue(item.text_body),
      caption: stringValue(item.caption),
      mimeType: stringValue(item.mime_type),
      fileName: stringValue(item.file_name),
      latitude: numberValue(item.latitude),
      longitude: numberValue(item.longitude),
      locationName: stringValue(item.location_name),
      quotedMessageId: stringValue(item.quoted_message_id),
      status: stringValue(item.status) as WhatsAppMessageRecord["status"] ?? "received",
      sentAt: String(item.sent_at)
    };
  });
}

export async function getMessage(userId: string, jid: string, messageId: string): Promise<WhatsAppMessageRecord | null> {
  const { data, error } = await db().from("whatsapp_messages").select("*")
    .eq("user_id", userId).eq("chat_jid", jid).eq("message_id", messageId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const item = data as Record<string, unknown>;
  return {
    chatJid: String(item.chat_jid),
    messageId: String(item.message_id),
    participantJid: stringValue(item.participant_jid),
    fromMe: item.is_from_me === true,
    messageType: stringValue(item.message_type) as WhatsAppMessageType ?? "unknown",
    text: stringValue(item.text_body),
    caption: stringValue(item.caption),
    mimeType: stringValue(item.mime_type),
    fileName: stringValue(item.file_name),
    latitude: numberValue(item.latitude),
    longitude: numberValue(item.longitude),
    locationName: stringValue(item.location_name),
    quotedMessageId: stringValue(item.quoted_message_id),
    status: stringValue(item.status) as WhatsAppMessageRecord["status"] ?? "received",
    sentAt: String(item.sent_at)
  };
}

export async function updateChat(userId: string, jid: string, patch: Partial<Pick<WhatsAppChatSummary, "isArchived" | "isPinned" | "mutedUntil" | "labels" | "unreadCount">>): Promise<WhatsAppChatSummary | null> {
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.isArchived !== undefined) dbPatch.is_archived = patch.isArchived;
  if (patch.isPinned !== undefined) dbPatch.is_pinned = patch.isPinned;
  if (patch.mutedUntil !== undefined) dbPatch.muted_until = patch.mutedUntil;
  if (patch.labels !== undefined) dbPatch.labels = patch.labels;
  if (patch.unreadCount !== undefined) dbPatch.unread_count = Math.max(0, patch.unreadCount);
  const { data, error } = await db().from("whatsapp_chats").update(dbPatch).eq("user_id", userId).eq("jid", jid).select("*").maybeSingle();
  if (error) throw error;
  return data ? dbChatToApi(data as Record<string, unknown>) : null;
}

export async function searchInbox(userId: string, term: string, limit = 20): Promise<{ chats: WhatsAppChatSummary[]; messages: WhatsAppMessageRecord[]; contacts: WhatsAppContact[] }> {
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  const supabase = db();
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const [chatsByName, chatsByJid, chatsByPreview, messageMatches, contactsByName, contactsByNotify] = await Promise.all([
    supabase.from("whatsapp_chats").select("*").eq("user_id", userId).ilike("name", pattern).limit(safeLimit),
    supabase.from("whatsapp_chats").select("*").eq("user_id", userId).ilike("jid", pattern).limit(safeLimit),
    supabase.from("whatsapp_chats").select("*").eq("user_id", userId).ilike("last_message_text", pattern).limit(safeLimit),
    supabase.from("whatsapp_messages").select("*").eq("user_id", userId).ilike("text_body", pattern).order("sent_at", { ascending: false }).limit(safeLimit),
    supabase.from("whatsapp_contacts").select("*").eq("user_id", userId).ilike("name", pattern).limit(safeLimit),
    supabase.from("whatsapp_contacts").select("*").eq("user_id", userId).ilike("notify", pattern).limit(safeLimit)
  ]);
  const error = chatsByName.error ?? chatsByJid.error ?? chatsByPreview.error ?? messageMatches.error ?? contactsByName.error ?? contactsByNotify.error;
  if (error) throw error;
  const chatRows = [...(chatsByName.data ?? []), ...(chatsByJid.data ?? []), ...(chatsByPreview.data ?? [])];
  const uniqueChats = new Map<string, WhatsAppChatSummary>();
  for (const row of chatRows) uniqueChats.set(String(row.jid), dbChatToApi(row as Record<string, unknown>));
  const messageRows = (messageMatches.data ?? []) as unknown as Array<Record<string, unknown>>;
  const messages = messageRows.map((item) => ({
    chatJid: String(item.chat_jid), messageId: String(item.message_id), participantJid: stringValue(item.participant_jid),
    fromMe: item.is_from_me === true, messageType: stringValue(item.message_type) as WhatsAppMessageType ?? "unknown",
    text: stringValue(item.text_body), caption: stringValue(item.caption), mimeType: stringValue(item.mime_type),
    fileName: stringValue(item.file_name), latitude: numberValue(item.latitude), longitude: numberValue(item.longitude),
    locationName: stringValue(item.location_name), quotedMessageId: stringValue(item.quoted_message_id),
    status: stringValue(item.status) as WhatsAppMessageRecord["status"] ?? "received", sentAt: String(item.sent_at)
  }));
  const contactRows = [...(contactsByName.data ?? []), ...(contactsByNotify.data ?? [])] as unknown as Array<Record<string, unknown>>;
  const uniqueContacts = new Map<string, WhatsAppContact>();
  for (const row of contactRows) uniqueContacts.set(String(row.jid), {
    jid: String(row.jid), name: stringValue(row.name), notify: stringValue(row.notify),
    verifiedName: stringValue(row.verified_name), updatedAt: String(row.updated_at)
  });
  return { chats: [...uniqueChats.values()].slice(0, safeLimit), messages, contacts: [...uniqueContacts.values()].slice(0, safeLimit) };
}

export async function listContacts(userId: string, term?: string, limit = 200): Promise<WhatsAppContact[]> {
  let query = db().from("whatsapp_contacts").select("*").eq("user_id", userId);
  if (term?.trim()) {
    const pattern = `%${term.trim().replace(/[\\%_]/g, "\\$&")}%`;
    query = query.ilike("name", pattern);
  }
  const { data, error } = await query.order("name", { ascending: true, nullsFirst: false }).limit(Math.max(1, Math.min(limit, 500)));
  if (error) throw error;
  return (data ?? []).map((row) => ({
    jid: String(row.jid), name: stringValue(row.name), notify: stringValue(row.notify),
    verifiedName: stringValue(row.verified_name), updatedAt: String(row.updated_at)
  }));
}

export async function getLatestMessageKey(userId: string, jid: string): Promise<{ id: string; fromMe: boolean; participant?: string; messageTimestamp: number } | null> {
  const { data, error } = await db().from("whatsapp_messages").select("message_id,is_from_me,participant_jid,sent_at").eq("user_id", userId).eq("chat_jid", jid).order("sent_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: String(data.message_id),
    fromMe: data.is_from_me === true,
    ...(stringValue(data.participant_jid) ? { participant: String(data.participant_jid) } : {}),
    messageTimestamp: Math.floor(Date.parse(String(data.sent_at)) / 1000)
  };
}

export async function updateMessageStatus(userId: string, jid: string, messageId: string, status: WhatsAppMessageRecord["status"]): Promise<void> {
  const { error } = await db().from("whatsapp_messages").update({ status }).eq("user_id", userId).eq("chat_jid", jid).eq("message_id", messageId);
  if (error) throw error;
}

export async function saveHistory(userId: string, chats: Chat[], contacts: Contact[], messages: WAMessage[]): Promise<void> {
  await saveWhatsAppChats(userId, chats);
  await saveWhatsAppContacts(userId, contacts);
  await saveWhatsAppMessages(userId, messages);
}
