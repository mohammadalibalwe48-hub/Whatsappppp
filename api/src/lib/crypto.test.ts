import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { hashOtp, verifyOtpHash, generateApiKey, hashApiKey } from "./crypto";

describe("generateApiKey and hashApiKey", () => {
  it("generateApiKey should return a valid API key object", () => {
    const keyObj = generateApiKey();
    expect(keyObj).toHaveProperty("publicKey");
    expect(keyObj).toHaveProperty("prefix");
    expect(keyObj).toHaveProperty("secret");
    expect(keyObj).toHaveProperty("hash");
  });

  it("generateApiKey should generate a valid prefix", () => {
    const keyObj = generateApiKey();
    expect(keyObj.prefix.startsWith("wo_live_")).toBe(true);
    // "wo_live_" is 8 chars, plus 4 bytes hex = 8 chars -> total 16 chars
    expect(keyObj.prefix.length).toBe(16);
  });

  it("generateApiKey should form publicKey from prefix and secret", () => {
    const keyObj = generateApiKey();
    expect(keyObj.publicKey).toBe(`${keyObj.prefix}.${keyObj.secret}`);
  });

  it("generateApiKey should generate correct SHA-256 hash", () => {
    const keyObj = generateApiKey();
    const expectedHash = crypto.createHash("sha256").update(keyObj.publicKey).digest("hex");
    expect(keyObj.hash).toBe(expectedHash);
  });

  it("generateApiKey should generate unique keys", () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1.publicKey).not.toBe(key2.publicKey);
    expect(key1.prefix).not.toBe(key2.prefix);
    expect(key1.secret).not.toBe(key2.secret);
    expect(key1.hash).not.toBe(key2.hash);
  });

  it("hashApiKey should correctly hash a public key", () => {
    const publicKey = "wo_live_1234abcd.secret1234567890";
    const expectedHash = crypto.createHash("sha256").update(publicKey).digest("hex");
    const result = hashApiKey(publicKey);
    expect(result).toBe(expectedHash);
  });
});

describe("hashOtp and verifyOtpHash", () => {
  it("hashOtp should generate a valid hash", async () => {
    const code = "123456";
    const hash = await hashOtp(code);
    expect(hash).toBeTruthy();
    expect(hash).not.toBe(code);
    expect(hash.startsWith("$2a$")).toBe(true);
  });

  it("verifyOtpHash should correctly verify a matching code", async () => {
    const code = "123456";
    const hash = await hashOtp(code);
    const isValid = await verifyOtpHash(code, hash);
    expect(isValid).toBe(true);
  });

  it("verifyOtpHash should reject a non-matching code", async () => {
    const code = "123456";
    const hash = await hashOtp(code);
    const isInvalid = await verifyOtpHash("654321", hash);
    expect(isInvalid).toBe(false);
  });

  it("verifyOtpHash should reject an empty string against a hash", async () => {
    const code = "123456";
    const hash = await hashOtp(code);
    const isInvalid = await verifyOtpHash("", hash);
    expect(isInvalid).toBe(false);
  });
});
