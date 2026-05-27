import { describe, it, expect } from "vitest";
import { hashOtp, verifyOtpHash } from "./crypto";

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
