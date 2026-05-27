import test from "node:test";
import assert from "node:assert";
import { hashOtp, verifyOtpHash } from "./crypto";

test("hashOtp and verifyOtpHash", async (t) => {
  await t.test("hashOtp should generate a valid hash", async () => {
    const code = "123456";
    const hash = await hashOtp(code);
    assert.ok(hash);
    assert.notStrictEqual(hash, code);
    assert.strictEqual(hash.startsWith("$2a$"), true, "Hash should be a bcrypt hash");
  });

  await t.test("verifyOtpHash should correctly verify a matching code", async () => {
    const code = "123456";
    const hash = await hashOtp(code);
    const isValid = await verifyOtpHash(code, hash);
    assert.strictEqual(isValid, true, "Valid code should be verified");
  });

  await t.test("verifyOtpHash should reject a non-matching code", async () => {
    const code = "123456";
    const hash = await hashOtp(code);
    const isInvalid = await verifyOtpHash("654321", hash);
    assert.strictEqual(isInvalid, false, "Invalid code should not be verified");
  });

  await t.test("verifyOtpHash should reject an empty string against a hash", async () => {
    const code = "123456";
    const hash = await hashOtp(code);
    const isInvalid = await verifyOtpHash("", hash);
    assert.strictEqual(isInvalid, false, "Empty string should not be verified");
  });
});
