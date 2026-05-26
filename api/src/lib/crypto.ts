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

/** Constant-time string comparison wrapper. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export type OtpAlphabet = "numeric" | "alphanumeric" | "alphabetic";

// Excludes ambiguous-looking characters (0/O, 1/I/L) for the non-numeric
// alphabets so codes are easier to read off a WhatsApp message.
const ALPHABET_CHARS: Record<OtpAlphabet, string> = {
  numeric: "0123456789",
  alphanumeric: "23456789ABCDEFGHJKLMNPQRSTUVWXYZ",
  alphabetic: "ABCDEFGHJKLMNPQRSTUVWXYZ"
};

/**
 * Generate an OTP of `length` chars. `alphabet` controls the character set;
 * defaults to numeric for backwards compatibility.
 *
 * Uses rejection sampling so the resulting code is unbiased across the chosen
 * alphabet (avoids modulo-bias when the byte range doesn't divide evenly).
 */
export function generateOtpCode(length: number, alphabet: OtpAlphabet = "numeric"): string {
  const chars = ALPHABET_CHARS[alphabet] ?? ALPHABET_CHARS.numeric;
  const n = chars.length;
  // Largest multiple of n that fits in a uint8 — bytes above this are rejected
  // to keep the distribution uniform.
  const cutoff = Math.floor(256 / n) * n;

  const out: string[] = [];
  while (out.length < length) {
    const buf = crypto.randomBytes(length * 2);
    for (let i = 0; i < buf.length && out.length < length; i++) {
      const b = buf[i];
      if (b < cutoff) out.push(chars[b % n]);
    }
  }
  return out.join("");
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
