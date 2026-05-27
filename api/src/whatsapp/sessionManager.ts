import {
  default as makeWASocket,
  ConnectionState,
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import EventEmitter from "events";
import fs from "fs/promises";
import path from "path";
import QRCode from "qrcode";
import pino from "pino";
import { env } from "../config/env";
import { logger } from "../lib/logger";

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
  phoneNumber: string | null;
  lastError: string | null;
  updatedAt: string;
}

interface InternalSession extends WhatsappSessionState {
  socket: WASocket | null;
  reconnectAttempts: number;
  closing: boolean;
}

interface SessionEvents {
  state: (state: WhatsappSessionState) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
declare interface SessionManager {
  on<K extends keyof SessionEvents>(event: K, listener: SessionEvents[K]): this;
  emit<K extends keyof SessionEvents>(event: K, ...args: Parameters<SessionEvents[K]>): boolean;
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
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
class SessionManager extends EventEmitter {
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

  getAllStates(): WhatsappSessionState[] {
    return Array.from(this.sessions.values()).map((s) => this.publicState(s));
  }

  private publicState(s: InternalSession): WhatsappSessionState {
    return {
      userId: s.userId,
      status: s.status,
      qrDataUrl: s.qrDataUrl,
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
      session = {
        userId,
        status: "initializing",
        qrDataUrl: null,
        phoneNumber: null,
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
        syncFullHistory: false,
        markOnlineOnConnect: false,
        emitOwnEvents: false,
        defaultQueryTimeoutMs: 60_000
      });

      session.socket = sock;

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
        await this.handleConnectionUpdate(session, update);
      });
    } catch (err) {
      const message = (err as Error).message ?? "Failed to start WhatsApp session";
      logger.error({ err, userId: session.userId }, "WhatsApp session start failed");
      this.touch(session, { status: "error", lastError: message });
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
      const phoneNumber = me?.id?.split(":")[0]?.split("@")[0] ?? null;
      this.touch(session, {
        status: "connected",
        qrDataUrl: null,
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
    if (!session || !session.socket || session.status !== "connected") {
      throw new Error(`WhatsApp session for user ${userId} is not connected`);
    }

    const jid = this.toJid(phoneNumber);
    const result = await session.socket.sendMessage(jid, { text });
    return result?.key?.id ?? "";
  }

  private toJid(phoneNumber: string) {
    const digits = phoneNumber.replace(/\D/g, "");
    return `${digits}@s.whatsapp.net`;
  }

  /**
   * Stop a session and wipe its credentials. Used when the user explicitly
   * disconnects from the dashboard.
   */
  async logout(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (!session) return;
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
