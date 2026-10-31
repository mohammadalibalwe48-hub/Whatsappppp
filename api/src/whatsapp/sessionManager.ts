import {
  default as makeWASocket,
  ConnectionState,
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  fetchLatestBaileysVersion,
  type AnyMessageContent,
  type ChatModification,
  type Contact,
  type WAMessage
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import EventEmitter from "events";
import fs from "fs/promises";
import path from "path";
import QRCode from "qrcode";
import pino from "pino";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import {
  ensureChat,
  getActiveWhatsAppAccount,
  getChat,
  getWhatsAppContactNames,
  getLatestMessageKey,
  getMessage,
  saveHistory,
  saveWhatsAppChats,
  saveWhatsAppContacts,
  saveWhatsAppMessages,
  registerWhatsAppAccount,
  resolveWhatsAppAccount,
  updateChat,
  updateMessageStatus,
  type WhatsAppChatSummary,
  type WhatsAppMessageRecord
} from "./inboxStore";

export type WhatsappSessionStatus =
  | "initializing"
  | "qr"
  | "pairing"
  | "connected"
  | "disconnected"
  | "logged_out"
  | "error";

export interface WhatsappSessionState {
  userId: string;
  status: WhatsappSessionStatus;
  qrDataUrl: string | null;
  accountJid: string | null;
  phoneNumber: string | null;
  lastError: string | null;
  updatedAt: string;
}

interface InternalSession extends WhatsappSessionState {
  socket: WASocket | null;
  reconnectAttempts: number;
  closing: boolean;
}

type SessionEvents = {
  state: [state: WhatsappSessionState];
  chat: [event: { userId: string; chat: WhatsAppChatSummary }];
  message: [event: { userId: string; message: WhatsAppMessageRecord; origin: "assistant" | "human" | "system" | "external" }];
  "ai-control": [event: { userId: string; accountJid: string; chatJid: string; mode: "inherit" | "enabled" | "paused" | "blocked" | "human"; handoffReason: string | null; workflowState: { fieldIndex: number; values: Record<string, string>; completed?: boolean; workflowName?: string; completedAt?: string } | null }];
};

export type WhatsAppChatAction = "mark_read" | "mark_unread" | "archive" | "unarchive" | "pin" | "unpin" | "mute" | "unmute";

export function normalizeWhatsappJid(value: string): string {
  const trimmed = value.trim();
  if (trimmed.includes("@")) {
    if (!/^[A-Za-z0-9._:-]{1,150}@(s\.whatsapp\.net|g\.us|lid)$/.test(trimmed)) {
      throw new Error("Invalid WhatsApp chat ID.");
    }
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) throw new Error("Enter a WhatsApp number with country code.");
  return `${digits}@s.whatsapp.net`;
}

function accountJidFromSocketId(value: string | undefined): string | null {
  if (!value) return null;
  const [address, server] = value.split("@");
  if (!address || !server || !["s.whatsapp.net", "lid"].includes(server)) return null;
  return `${address.split(":")[0]}@${server}`;
}

/**
 * Owns Baileys WhatsApp sockets for every user. One process can hold many
 * concurrent sessions; each one is keyed by Supabase user id.
 *
 * Responsibilities:
 *  - Materialise multi-file auth state on disk (encrypted-at-rest via the
 *    underlying filesystem; production deployments should mount an encrypted
 *    volume or use an external secret store).
 *  - Reconnect automatically on transient disconnects.
 *  - Emit "state" events whenever the session lifecycle changes so the realtime
 *    layer (Socket.IO) can fan out updates to the dashboard.
 */
class SessionManager extends EventEmitter<SessionEvents> {
  private sessions = new Map<string, InternalSession>();

  private dirFor(userId: string) {
    return path.resolve(env.WHATSAPP_SESSIONS_DIR, `user_${userId}`);
  }

  private async ensureDir(userId: string) {
    await fs.mkdir(this.dirFor(userId), { recursive: true });
  }

  getState(userId: string): WhatsappSessionState | null {
    const s = this.sessions.get(userId);
    if (!s) return null;
    return this.publicState(s);
  }

  async getStateForUser(userId: string): Promise<WhatsappSessionState> {
    const session = this.sessions.get(userId);
    if (session) return this.publicState(session);
    const active = await getActiveWhatsAppAccount(userId);
    return {
      userId,
      status: "disconnected",
      qrDataUrl: null,
      accountJid: active?.accountJid ?? null,
      phoneNumber: active?.phoneNumber ?? null,
      lastError: null,
      updatedAt: active?.lastConnectedAt ?? new Date().toISOString()
    };
  }

  async getAccountJid(userId: string, requestedAccountJid?: string | null): Promise<string | null> {
    return resolveWhatsAppAccount(userId, requestedAccountJid);
  }

  getCurrentAccountJid(userId: string): string | null {
    return this.sessions.get(userId)?.accountJid ?? null;
  }

  getAllStates(): WhatsappSessionState[] {
    return Array.from(this.sessions.values()).map((s) => this.publicState(s));
  }

  private publicState(s: InternalSession): WhatsappSessionState {
    return {
      userId: s.userId,
      status: s.status,
      qrDataUrl: s.qrDataUrl,
      accountJid: s.accountJid,
      phoneNumber: s.phoneNumber,
      lastError: s.lastError,
      updatedAt: s.updatedAt
    };
  }

  private touch(s: InternalSession, patch: Partial<InternalSession>) {
    Object.assign(s, patch, { updatedAt: new Date().toISOString() });
    this.emit("state", this.publicState(s));
  }

  /**
   * Start (or restart) a session for the user. Idempotent — calling start
   * while the socket is already connected is a no-op.
   */
  async start(userId: string): Promise<WhatsappSessionState> {
    let session = this.sessions.get(userId);
    if (session && session.socket && (session.status === "connected" || session.status === "qr")) {
      return this.publicState(session);
    }

    if (!session) {
      const active = await getActiveWhatsAppAccount(userId);
      session = {
        userId,
        status: "initializing",
        qrDataUrl: null,
        accountJid: active?.accountJid ?? null,
        phoneNumber: active?.phoneNumber ?? null,
        lastError: null,
        updatedAt: new Date().toISOString(),
        socket: null,
        reconnectAttempts: 0,
        closing: false
      };
      this.sessions.set(userId, session);
    } else {
      this.touch(session, { status: "initializing", lastError: null });
    }

    await this.ensureDir(userId);
    await this.connect(session);
    return this.publicState(session);
  }

  private async connect(session: InternalSession) {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.dirFor(session.userId));
      const { version } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 1015901307] as [number, number, number]
      }));

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "warn" }) as any,
        browser: ["OtpWave", "Chrome", "1.0.0"],
        syncFullHistory: true,
        markOnlineOnConnect: false,
        emitOwnEvents: false,
        defaultQueryTimeoutMs: 60_000
      });

      session.socket = sock;

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
        try {
          await this.handleConnectionUpdate(session, update);
        } catch (err) {
          logger.warn({ err, userId: session.userId }, "Failed to update WhatsApp session state");
          this.touch(session, { status: "error", lastError: (err as Error).message ?? "Failed to update WhatsApp session." });
        }
      });

      sock.ev.on("messaging-history.set", (history) => {
        void this.persistHistory(session, history).catch((err) => {
          logger.warn({ err, userId: session.userId }, "Failed to persist WhatsApp history");
        });
      });
      sock.ev.on("chats.upsert", (chats) => {
        void this.persistChats(session, chats).catch((err) => {
          logger.warn({ err, userId: session.userId }, "Failed to persist WhatsApp chats");
        });
      });
      sock.ev.on("chats.update", (chats) => {
        void this.persistChats(session, chats).catch((err) => {
          logger.warn({ err, userId: session.userId }, "Failed to persist WhatsApp chat updates");
        });
      });
      sock.ev.on("contacts.upsert", (contacts) => {
        void Promise.resolve().then(() => saveWhatsAppContacts(session.userId, this.sessionAccountJid(session), contacts)).catch((err) => {
          logger.warn({ err, userId: session.userId }, "Failed to persist WhatsApp contacts");
        });
      });
      sock.ev.on("contacts.update", (contacts) => {
        void Promise.resolve().then(() => saveWhatsAppContacts(session.userId, this.sessionAccountJid(session), contacts)).catch((err) => {
          logger.warn({ err, userId: session.userId }, "Failed to persist WhatsApp contact updates");
        });
      });
      sock.ev.on("messages.upsert", ({ messages, type }) => {
        void this.persistMessages(session, messages, type === "notify").catch((err) => {
          logger.warn({ err, userId: session.userId }, "Failed to persist WhatsApp messages");
        });
      });
      sock.ev.on("messages.update", (updates) => {
        void this.persistMessageUpdates(session, updates).catch((err) => {
          logger.warn({ err, userId: session.userId }, "Failed to persist WhatsApp message status");
        });
      });
    } catch (err) {
      const message = (err as Error).message ?? "Failed to start WhatsApp session";
      logger.error({ err, userId: session.userId }, "WhatsApp session start failed");
      this.touch(session, { status: "error", lastError: message });
    }
  }

  private async persistHistory(
    session: InternalSession,
    history: { chats: import("@whiskeysockets/baileys").Chat[]; contacts: Contact[]; messages: WAMessage[] }
  ) {
    const accountJid = this.sessionAccountJid(session);
    const chats = await saveWhatsAppChats(session.userId, accountJid, history.chats);
    await saveHistory(session.userId, accountJid, [], history.contacts, history.messages);
    for (const chat of chats) this.emit("chat", { userId: session.userId, chat });
  }

  private async persistChats(session: InternalSession, chats: Array<Partial<import("@whiskeysockets/baileys").Chat>>) {
    const saved = await saveWhatsAppChats(session.userId, this.sessionAccountJid(session), chats);
    for (const chat of saved) this.emit("chat", { userId: session.userId, chat });
  }

  private async persistMessages(session: InternalSession, messages: WAMessage[], emitLive: boolean) {
    const accountJid = this.sessionAccountJid(session);
    const saved = await saveWhatsAppMessages(session.userId, accountJid, messages);
    if (!emitLive) return;
    for (const message of saved) {
      this.emit("message", { userId: session.userId, message, origin: message.fromMe ? "human" : "external" });
      const chat = await getChat(session.userId, accountJid, message.chatJid);
      if (chat) this.emit("chat", { userId: session.userId, chat });
    }
  }

  private async persistMessageUpdates(
    session: InternalSession,
    updates: Array<{ key: { remoteJid?: string | null; id?: string | null }; update: { status?: number | null } }>
  ) {
    for (const item of updates) {
      const jid = item.key.remoteJid;
      const id = item.key.id;
      const statusValue = item.update.status;
      if (!jid || !id || statusValue === undefined || statusValue === null) continue;
      const status: WhatsAppMessageRecord["status"] = statusValue >= 4 ? "read" : statusValue >= 3 ? "delivered" : "sent";
      await updateMessageStatus(session.userId, this.sessionAccountJid(session), jid, id, status);
    }
  }

  private async handleConnectionUpdate(
    session: InternalSession,
    update: Partial<ConnectionState>
  ) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
      this.touch(session, { status: "qr", qrDataUrl });
    }

    if (connection === "open") {
      const sock = session.socket!;
      const me = sock.user;
      const accountJid = accountJidFromSocketId(me?.id);
      if (!accountJid) {
        this.touch(session, { status: "error", lastError: "WhatsApp connected without an account identifier." });
        return;
      }
      const phoneNumber = accountJid.endsWith("@s.whatsapp.net") ? `+${accountJid.split("@")[0]}` : null;
      await registerWhatsAppAccount(session.userId, accountJid, phoneNumber);
      this.touch(session, {
        status: "connected",
        qrDataUrl: null,
        accountJid,
        phoneNumber,
        lastError: null,
        reconnectAttempts: 0
      });
      logger.info({ userId: session.userId, phoneNumber }, "WhatsApp session connected");
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      const message = (lastDisconnect?.error as Error | undefined)?.message ?? "Disconnected";

      if (loggedOut) {
        await this.clearOnDisk(session.userId);
        this.touch(session, {
          status: "logged_out",
          qrDataUrl: null,
          phoneNumber: null,
          lastError: message
        });
        return;
      }

      if (session.closing) {
        this.touch(session, { status: "disconnected", qrDataUrl: null });
        return;
      }

      const attempt = session.reconnectAttempts + 1;
      const backoffMs = Math.min(30_000, 1_500 * Math.pow(2, attempt));
      this.touch(session, {
        status: "disconnected",
        lastError: message,
        reconnectAttempts: attempt
      });

      logger.warn(
        { userId: session.userId, attempt, backoffMs, code },
        "WhatsApp session disconnected — scheduling reconnect"
      );

      setTimeout(() => {
        if (!session.closing) this.connect(session).catch(() => undefined);
      }, backoffMs);
    }
  }

  /**
   * Send a plain-text WhatsApp message to a phone number, returning the
   * Baileys message id. Throws if the session is not connected.
   */
  async sendMessage(userId: string, phoneNumber: string, text: string): Promise<string> {
    const session = this.sessions.get(userId);
    if (!session?.accountJid) throw new Error("WhatsApp is not connected. Connect your account first.");
    const result = await this.sendChatText(userId, session.accountJid, normalizeWhatsappJid(phoneNumber), text, undefined, "system");
    return result.messageId;
  }

  private connectedSocket(userId: string, expectedAccountJid?: string): WASocket {
    const session = this.sessions.get(userId);
    if (!session?.socket || session.status !== "connected" || !session.accountJid) {
      throw new Error("WhatsApp is not connected. Connect your account first.");
    }
    if (expectedAccountJid && session.accountJid !== expectedAccountJid) {
      throw new Error("This chat belongs to a different WhatsApp number. Switch to that number and reconnect before sending.");
    }
    return session.socket;
  }

  private sessionAccountJid(session: InternalSession): string {
    const accountJid = session.accountJid ?? accountJidFromSocketId(session.socket?.user?.id);
    if (!accountJid) throw new Error("The connected WhatsApp account could not be identified yet.");
    return accountJid;
  }

  private async emitSavedMessage(userId: string, accountJid: string, message: WAMessage, origin: "assistant" | "human" | "system" = "human"): Promise<WhatsAppMessageRecord> {
    const [saved] = await saveWhatsAppMessages(userId, accountJid, [message]);
    if (!saved) throw new Error("WhatsApp accepted the message but its message ID was missing.");
    this.emit("message", { userId, message: saved, origin });
    const chat = await getChat(userId, accountJid, saved.chatJid);
    if (chat) this.emit("chat", { userId, chat });
    return saved;
  }

  private async quoteMessage(userId: string, accountJid: string, jid: string, messageId?: string): Promise<WAMessage | undefined> {
    if (!messageId) return undefined;
    const stored = await getMessage(userId, accountJid, jid, messageId);
    if (!stored) throw new Error("The message to reply to is no longer available.");
    const preview = stored.text ?? stored.caption ?? stored.fileName ?? `[${stored.messageType}]`;
    return {
      key: {
        remoteJid: jid,
        id: stored.messageId,
        fromMe: stored.fromMe,
        ...(stored.participantJid ? { participant: stored.participantJid } : {})
      },
      message: { conversation: preview }
    };
  }

  async sendChatText(userId: string, accountJid: string, chatJid: string, text: string, quotedMessageId?: string, origin: "assistant" | "human" | "system" = "human"): Promise<WhatsAppMessageRecord> {
    const jid = normalizeWhatsappJid(chatJid);
    const socket = this.connectedSocket(userId, accountJid);
    await ensureChat(userId, accountJid, jid, null, jid.endsWith("@g.us"));
    const quoted = await this.quoteMessage(userId, accountJid, jid, quotedMessageId);
    const sent = await socket.sendMessage(jid, { text }, quoted ? { quoted } : undefined);
    if (!sent) throw new Error("WhatsApp did not return the sent message.");
    return this.emitSavedMessage(userId, accountJid, sent as WAMessage, origin);
  }

  async sendMedia(
    userId: string,
    accountJid: string,
    chatJid: string,
    mediaType: "image" | "document" | "audio",
    buffer: Buffer,
    mimeType: string,
    fileName?: string,
    caption?: string,
    quotedMessageId?: string
  ): Promise<WhatsAppMessageRecord> {
    const jid = normalizeWhatsappJid(chatJid);
    const socket = this.connectedSocket(userId, accountJid);
    await ensureChat(userId, accountJid, jid, null, jid.endsWith("@g.us"));
    const quoted = await this.quoteMessage(userId, accountJid, jid, quotedMessageId);
    let content: AnyMessageContent;
    if (mediaType === "image") content = { image: buffer, mimetype: mimeType, ...(caption ? { caption } : {}) };
    else if (mediaType === "audio") content = { audio: buffer, mimetype: mimeType, ptt: mimeType.includes("ogg") };
    else content = { document: buffer, mimetype: mimeType, fileName: fileName || "attachment", ...(caption ? { caption } : {}) };
    const sent = await socket.sendMessage(jid, content, quoted ? { quoted } : undefined);
    if (!sent) throw new Error("WhatsApp did not return the sent media message.");
    return this.emitSavedMessage(userId, accountJid, sent as WAMessage);
  }

  async sendLocation(
    userId: string,
    accountJid: string,
    chatJid: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string
  ): Promise<WhatsAppMessageRecord> {
    const jid = normalizeWhatsappJid(chatJid);
    const socket = this.connectedSocket(userId, accountJid);
    await ensureChat(userId, accountJid, jid, null, jid.endsWith("@g.us"));
    const sent = await socket.sendMessage(jid, {
      location: {
        degreesLatitude: latitude,
        degreesLongitude: longitude,
        ...(name ? { name } : {}),
        ...(address ? { address } : {})
      }
    });
    if (!sent) throw new Error("WhatsApp did not return the location message.");
    return this.emitSavedMessage(userId, accountJid, sent as WAMessage);
  }

  async reactToMessage(userId: string, accountJid: string, chatJid: string, messageId: string, reaction: string): Promise<WhatsAppMessageRecord> {
    const jid = normalizeWhatsappJid(chatJid);
    const socket = this.connectedSocket(userId, accountJid);
    const target = await getMessage(userId, accountJid, jid, messageId);
    if (!target) throw new Error("Message not found in this chat.");
    const sent = await socket.sendMessage(jid, {
      react: {
        text: reaction,
        key: {
          remoteJid: jid,
          id: target.messageId,
          fromMe: target.fromMe,
          ...(target.participantJid ? { participant: target.participantJid } : {})
        }
      }
    });
    if (!sent) throw new Error("WhatsApp did not return the reaction message.");
    return this.emitSavedMessage(userId, accountJid, sent as WAMessage);
  }

  async modifyChat(
    userId: string,
    accountJid: string,
    chatJid: string,
    action: WhatsAppChatAction | "labels",
    options: { durationMinutes?: number; labels?: string[] } = {}
  ): Promise<WhatsAppChatSummary | null> {
    const jid = normalizeWhatsappJid(chatJid);
    if (action === "labels") {
      const chat = await updateChat(userId, accountJid, jid, { labels: options.labels ?? [] });
      if (chat) this.emit("chat", { userId, chat });
      return chat;
    }

    const socket = this.connectedSocket(userId, accountJid);
    const lastMessage = await getLatestMessageKey(userId, accountJid, jid);
    const lastMessages = lastMessage ? [{
      key: {
        remoteJid: jid,
        id: lastMessage.id,
        fromMe: lastMessage.fromMe,
        ...(lastMessage.participant ? { participant: lastMessage.participant } : {})
      },
      messageTimestamp: lastMessage.messageTimestamp
    }] : [];
    let modification: ChatModification;
    const patch: Parameters<typeof updateChat>[3] = {};

    switch (action) {
      case "mark_read":
        modification = { markRead: true, lastMessages };
        patch.unreadCount = 0;
        break;
      case "mark_unread":
        modification = { markRead: false, lastMessages };
        patch.unreadCount = Math.max(1, (await getChat(userId, accountJid, jid))?.unreadCount ?? 0);
        break;
      case "archive":
        modification = { archive: true, lastMessages };
        patch.isArchived = true;
        break;
      case "unarchive":
        modification = { archive: false, lastMessages };
        patch.isArchived = false;
        break;
      case "pin":
        modification = { pin: true };
        patch.isPinned = true;
        break;
      case "unpin":
        modification = { pin: false };
        patch.isPinned = false;
        break;
      case "mute": {
        const durationMinutes = Math.max(1, Math.min(options.durationMinutes ?? 480, 10080));
        modification = { mute: durationMinutes * 60 * 1000 };
        patch.mutedUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
        break;
      }
      case "unmute":
        modification = { mute: null };
        patch.mutedUntil = null;
        break;
    }

    await socket.chatModify(modification, jid);
    const chat = await updateChat(userId, accountJid, jid, patch);
    if (chat) this.emit("chat", { userId, chat });
    return chat;
  }

  async createGroup(userId: string, subject: string, phoneNumbers: string[]) {
    const socket = this.connectedSocket(userId);
    const accountJid = this.sessionAccountJid(this.sessions.get(userId)!);
    const participants = [...new Set(phoneNumbers.map((value) => normalizeWhatsappJid(value)))];
    if (participants.some((jid) => !jid.endsWith("@s.whatsapp.net"))) throw new Error("Group participants must be phone numbers.");
    const group = await socket.groupCreate(subject, participants);
    await ensureChat(userId, accountJid, group.id, group.subject || subject, true);
    if (group.participants.length > 0) await saveWhatsAppContacts(userId, accountJid, group.participants);
    const chat = await getChat(userId, accountJid, group.id);
    if (chat) this.emit("chat", { userId, chat });
    return { jid: group.id, subject: group.subject, participantCount: group.participants.length };
  }

  async getGroupMembers(userId: string, chatJid: string) {
    const jid = normalizeWhatsappJid(chatJid);
    if (!jid.endsWith("@g.us")) throw new Error("This chat is not a WhatsApp group.");
    const session = this.sessions.get(userId);
    const accountJid = session ? this.sessionAccountJid(session) : null;
    if (!accountJid) throw new Error("WhatsApp is not connected. Connect your account first.");
    const metadata = await this.connectedSocket(userId).groupMetadata(jid);
    const names = await getWhatsAppContactNames(userId, accountJid, metadata.participants.map((participant) => participant.id));
    return {
      jid: metadata.id,
      subject: metadata.subject,
      participants: metadata.participants.map((participant) => ({
        jid: participant.id,
        name: names.get(participant.id) ?? null,
        admin: participant.admin ?? null
      }))
    };
  }

  /**
   * Stop a session and wipe its credentials. Used when the user explicitly
   * disconnects from the dashboard.
   */
  async logout(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (!session) {
      await this.clearOnDisk(userId);
      return;
    }
    session.closing = true;
    try {
      await session.socket?.logout();
    } catch {
      // ignore: socket may already be gone
    }
    try {
      session.socket?.end(undefined);
    } catch {
      // ignore
    }
    await this.clearOnDisk(userId);
    this.touch(session, {
      status: "logged_out",
      qrDataUrl: null,
      phoneNumber: null,
      lastError: null
    });
    this.sessions.delete(userId);
  }

  /** Disconnect without wiping credentials, so the next `start` reuses them. */
  async stop(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (!session) return;
    session.closing = true;
    try {
      session.socket?.end(undefined);
    } catch {
      // ignore
    }
    this.touch(session, { status: "disconnected", qrDataUrl: null });
  }

  private async clearOnDisk(userId: string) {
    try {
      await fs.rm(this.dirFor(userId), { recursive: true, force: true });
    } catch (err) {
      logger.warn({ err, userId }, "Failed to wipe WhatsApp session directory");
    }
  }

  /**
   * Re-open previously persisted sessions on boot. Looks for any directories
   * matching `user_<id>` inside the sessions folder and tries to reconnect.
   */
  async restoreAll(): Promise<number> {
    let restored = 0;
    try {
      await fs.mkdir(env.WHATSAPP_SESSIONS_DIR, { recursive: true });
      const entries = await fs.readdir(env.WHATSAPP_SESSIONS_DIR, { withFileTypes: true });

      const promises = entries.map(async (entry) => {
        if (!entry.isDirectory() || !entry.name.startsWith("user_")) return;
        const userId = entry.name.slice("user_".length);
        try {
          await this.start(userId);
          restored++;
        } catch (err) {
          logger.warn({ err, userId }, "Failed to restore WhatsApp session");
        }
      });

      await Promise.all(promises);
    } catch (err) {
      logger.warn({ err }, "Failed to read sessions directory");
    }
    return restored;
  }
}

export const sessionManager = new SessionManager();
