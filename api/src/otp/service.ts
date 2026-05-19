import { env } from "../config/env";
import type { OtpAlphabet } from "../lib/crypto";
import { generateOtpCode, hashOtp, verifyOtpHash } from "../lib/crypto";
import { getKv } from "../lib/redis";
import { logger } from "../lib/logger";
import { getSupabase, supabaseAvailable } from "../lib/supabase";
import { sessionManager } from "../whatsapp/sessionManager";
import { renderOtpMessage } from "./templates";
import { enqueueWebhook } from "../webhooks/dispatcher";

export interface SendOtpInput {
  userId: string;
  apiKeyId: string;
  phoneNumber: string;
  appName?: string;
  length?: number;
  alphabet?: OtpAlphabet;
  ttlSeconds?: number;
  ip?: string | null;
  userAgent?: string | null;
}

export interface SendOtpResult {
  otpId: string;
  expiresAt: string;
  ttlSeconds: number;
  /** The plaintext code is ONLY returned in development for easy testing. */
  devCode?: string;
}

export interface VerifyOtpInput {
  userId: string;
  apiKeyId: string;
  otpId?: string;
  phoneNumber?: string;
  code: string;
  ip?: string | null;
  userAgent?: string | null;
}

export type VerifyOtpResult =
  | { status: "verified"; otpId: string; phoneNumber: string }
  | { status: "invalid"; otpId?: string; attemptsRemaining?: number; reason: string }
  | { status: "expired"; otpId?: string }
  | { status: "rate_limited"; retryAfter: number }
  | { status: "not_found" };

interface OtpRecord {
  id: string;
  userId: string;
  apiKeyId: string;
  phoneNumber: string;
  codeHash: string;
  /** Length the original code was generated with (for resend continuity). */
  codeLength: number;
  /** Alphabet the original code was generated with (for resend continuity). */
  codeAlphabet: OtpAlphabet;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  status: "pending" | "verified" | "expired" | "failed";
  createdAt: number;
  resendCount: number;
  appName?: string | null;
}

const ACTIVE_PREFIX = "otp:active:"; // active OTP per (userId|phone)
const RECORD_PREFIX = "otp:record:"; // record by id
const RESEND_PREFIX = "otp:resend:"; // resend cooldown

function key(prefix: string, ...parts: string[]) {
  return prefix + parts.join(":");
}

function newOtpId(): string {
  return "otp_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) throw new Error("phoneNumber must contain digits");
  return digits;
}

async function saveRecord(rec: OtpRecord) {
  const kv = getKv();
  const ttl = Math.max(60, Math.ceil((rec.expiresAt - Date.now()) / 1000));
  await kv.set(key(RECORD_PREFIX, rec.id), JSON.stringify(rec), ttl + 3600);
}

async function getRecord(id: string): Promise<OtpRecord | null> {
  const kv = getKv();
  const raw = await kv.get(key(RECORD_PREFIX, id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OtpRecord;
  } catch {
    return null;
  }
}

async function persistAuditLog(rec: OtpRecord, fields: Record<string, unknown>) {
  if (!supabaseAvailable()) return;
  try {
    const supabase = getSupabase();
    await supabase.from("otp_logs").insert({
      id: rec.id,
      user_id: rec.userId,
      api_key_id: rec.apiKeyId,
      phone_number: rec.phoneNumber,
      app_name: rec.appName ?? null,
      status: rec.status,
      attempts: rec.attempts,
      resend_count: rec.resendCount,
      expires_at: new Date(rec.expiresAt).toISOString(),
      created_at: new Date(rec.createdAt).toISOString(),
      ...fields
    });
  } catch (err) {
    logger.warn({ err, otpId: rec.id }, "Failed to persist OTP audit log");
  }
}

async function updateAuditLog(rec: OtpRecord, patch: Record<string, unknown>) {
  if (!supabaseAvailable()) return;
  try {
    const supabase = getSupabase();
    await supabase.from("otp_logs").update(patch).eq("id", rec.id);
  } catch (err) {
    logger.warn({ err, otpId: rec.id }, "Failed to update OTP audit log");
  }
}

export async function sendOtp(input: SendOtpInput): Promise<SendOtpResult> {
  const phoneNumber = normalisePhone(input.phoneNumber);
  const length = input.length ?? env.OTP_DEFAULT_LENGTH;
  const alphabet: OtpAlphabet = input.alphabet ?? "numeric";
  const ttlSeconds = input.ttlSeconds ?? env.OTP_DEFAULT_TTL_SECONDS;

  const code = generateOtpCode(length, alphabet);
  const codeHash = await hashOtp(code);
  const id = newOtpId();
  const now = Date.now();
  const expiresAt = now + ttlSeconds * 1000;

  const rec: OtpRecord = {
    id,
    userId: input.userId,
    apiKeyId: input.apiKeyId,
    phoneNumber,
    codeHash,
    codeLength: length,
    codeAlphabet: alphabet,
    expiresAt,
    attempts: 0,
    maxAttempts: env.OTP_MAX_ATTEMPTS,
    status: "pending",
    createdAt: now,
    resendCount: 0,
    appName: input.appName ?? null
  };

  const kv = getKv();
  await saveRecord(rec);
  await kv.set(key(ACTIVE_PREFIX, input.userId, phoneNumber), id, ttlSeconds);

  const message = renderOtpMessage({ code, appName: input.appName, ttlSeconds });

  try {
    await sessionManager.sendMessage(input.userId, phoneNumber, message);
  } catch (err) {
    rec.status = "failed";
    await saveRecord(rec);
    await persistAuditLog(rec, {
      failure_reason: (err as Error).message,
      delivered_at: null,
      ip: input.ip,
      user_agent: input.userAgent
    });
    enqueueWebhook({
      userId: input.userId,
      event: "otp.failed",
      data: { otpId: id, phoneNumber, reason: (err as Error).message }
    });
    throw err;
  }

  await persistAuditLog(rec, {
    delivered_at: new Date().toISOString(),
    failure_reason: null,
    ip: input.ip,
    user_agent: input.userAgent
  });

  enqueueWebhook({
    userId: input.userId,
    event: "otp.sent",
    data: { otpId: id, phoneNumber, expiresAt: new Date(expiresAt).toISOString() }
  });

  return {
    otpId: id,
    expiresAt: new Date(expiresAt).toISOString(),
    ttlSeconds,
    devCode: env.NODE_ENV !== "production" ? code : undefined
  };
}

export async function resendOtp(args: {
  userId: string;
  apiKeyId: string;
  otpId?: string;
  phoneNumber?: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<SendOtpResult> {
  const kv = getKv();
  let phone = args.phoneNumber ? normalisePhone(args.phoneNumber) : null;
  let prev: OtpRecord | null = null;

  if (args.otpId) {
    prev = await getRecord(args.otpId);
    if (prev && prev.userId !== args.userId) prev = null;
  } else if (phone) {
    const activeId = await kv.get(key(ACTIVE_PREFIX, args.userId, phone));
    if (activeId) prev = await getRecord(activeId);
  }

  if (!prev) throw new Error("No active OTP found to resend");
  phone = prev.phoneNumber;

  const cooldownKey = key(RESEND_PREFIX, args.userId, phone);
  const recent = await kv.get(cooldownKey);
  if (recent) {
    const ttl = await kv.ttl(cooldownKey);
    const err: any = new Error("Resend cooldown active");
    err.statusCode = 429;
    err.retryAfter = Math.max(1, ttl);
    throw err;
  }
  await kv.set(cooldownKey, "1", env.OTP_RESEND_COOLDOWN_SECONDS);

  const result = await sendOtp({
    userId: args.userId,
    apiKeyId: args.apiKeyId,
    phoneNumber: phone,
    appName: prev.appName ?? undefined,
    length: prev.codeLength,
    alphabet: prev.codeAlphabet,
    ip: args.ip,
    userAgent: args.userAgent
  });

  // Bump resend count on the new record so we keep a useful history.
  const fresh = await getRecord(result.otpId);
  if (fresh) {
    fresh.resendCount = (prev.resendCount ?? 0) + 1;
    await saveRecord(fresh);
    await updateAuditLog(fresh, { resend_count: fresh.resendCount });
  }

  return result;
}

export async function verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
  const kv = getKv();
  let rec: OtpRecord | null = null;

  if (input.otpId) {
    rec = await getRecord(input.otpId);
    if (rec && rec.userId !== input.userId) rec = null;
  } else if (input.phoneNumber) {
    const phone = normalisePhone(input.phoneNumber);
    const activeId = await kv.get(key(ACTIVE_PREFIX, input.userId, phone));
    if (activeId) rec = await getRecord(activeId);
  }

  if (!rec) return { status: "not_found" };

  if (rec.status === "verified") {
    return { status: "verified", otpId: rec.id, phoneNumber: rec.phoneNumber };
  }

  if (rec.expiresAt <= Date.now()) {
    rec.status = "expired";
    await saveRecord(rec);
    await updateAuditLog(rec, { status: "expired" });
    return { status: "expired", otpId: rec.id };
  }

  rec.attempts += 1;
  if (rec.attempts > rec.maxAttempts) {
    rec.status = "failed";
    await saveRecord(rec);
    await updateAuditLog(rec, { status: "failed", attempts: rec.attempts });
    enqueueWebhook({
      userId: rec.userId,
      event: "otp.failed",
      data: { otpId: rec.id, phoneNumber: rec.phoneNumber, reason: "max_attempts" }
    });
    return { status: "invalid", otpId: rec.id, attemptsRemaining: 0, reason: "max_attempts" };
  }

  // Codes for non-numeric alphabets are uppercase; uppercase the user's input
  // so they can type lowercase without failing verification. Numeric codes
  // are unaffected (digits have no case).
  const userCode = (rec.codeAlphabet ?? "numeric") === "numeric"
    ? input.code
    : input.code.toUpperCase();
  const ok = await verifyOtpHash(userCode, rec.codeHash);
  if (!ok) {
    await saveRecord(rec);
    await updateAuditLog(rec, { attempts: rec.attempts });
    return {
      status: "invalid",
      otpId: rec.id,
      attemptsRemaining: Math.max(0, rec.maxAttempts - rec.attempts),
      reason: "wrong_code"
    };
  }

  rec.status = "verified";
  await saveRecord(rec);
  await updateAuditLog(rec, {
    status: "verified",
    attempts: rec.attempts,
    verified_at: new Date().toISOString()
  });
  await kv.del(key(ACTIVE_PREFIX, rec.userId, rec.phoneNumber));

  enqueueWebhook({
    userId: rec.userId,
    event: "otp.verified",
    data: { otpId: rec.id, phoneNumber: rec.phoneNumber }
  });

  return { status: "verified", otpId: rec.id, phoneNumber: rec.phoneNumber };
}

export async function lookupOtp(args: { userId: string; otpId: string }) {
  const rec = await getRecord(args.otpId);
  if (!rec || rec.userId !== args.userId) return null;
  return {
    id: rec.id,
    phoneNumber: rec.phoneNumber,
    status: rec.status,
    attempts: rec.attempts,
    maxAttempts: rec.maxAttempts,
    resendCount: rec.resendCount,
    expiresAt: new Date(rec.expiresAt).toISOString(),
    createdAt: new Date(rec.createdAt).toISOString()
  };
}
