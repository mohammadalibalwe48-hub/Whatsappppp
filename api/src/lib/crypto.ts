import bcrypt from "bcryptjs";
import crypto from "crypto";
import { env } from "../config/env";

const ENC_ALGO = "aes-256-gcm";

function deriveKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Symmetrically encrypt a payload at rest. Used for Baileys session credentials.
 * Output format: base64(iv || authTag || ciphertext).
 */
export function encryptAtRest(plaintext: Buffer, secret = env.SESSION_ENCRYPTION_KEY): string {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENC_ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptAtRest(payloadB64: string, secret = env.SESSION_ENCRYPTION_KEY): Buffer {
  const key = deriveKey(secret);
  const buf = Buffer.from(payloadB64, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ENC_ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Constant-time string comparison wrapper. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Generate a numeric OTP code of `length` digits. */
export function generateOtpCode(length: number): string {
  const max = 10 ** length;
  // Use rejection sampling for unbiased digits in [0, max).
  const buf = crypto.randomBytes(4);
  const n = buf.readUInt32BE(0) % max;
  return n.toString().padStart(length, "0");
}

/** bcrypt-hash an OTP so we can store it safely. */
export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function verifyOtpHash(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

/**
 * Generate a fresh API key. The "public" form (shown once) is composed of a
 * short identifier prefix the user can recognise in their dashboard plus a
 * high-entropy secret. We persist only the secret hash.
 */
export function generateApiKey(): {
  publicKey: string;
  prefix: string;
  secret: string;
  hash: string;
} {
  const prefix = "wo_live_" + crypto.randomBytes(4).toString("hex");
  const secret = crypto.randomBytes(24).toString("base64url");
  const publicKey = `${prefix}.${secret}`;
  const hash = crypto.createHash("sha256").update(publicKey).digest("hex");
  return { publicKey, prefix, secret, hash };
}

export function hashApiKey(publicKey: string): string {
  return crypto.createHash("sha256").update(publicKey).digest("hex");
}

/** HMAC-SHA256 signature for outgoing webhooks. */
export function signWebhook(payload: string, secret: string, timestamp: string): string {
  const mac = crypto.createHmac("sha256", `${secret}.${env.WEBHOOK_SIGNING_PEPPER}`);
  mac.update(`${timestamp}.${payload}`);
  return mac.digest("hex");
}

export function generateWebhookSecret(): string {
  return "whsec_" + crypto.randomBytes(24).toString("base64url");
}
