import crypto from "crypto";
import { signWebhook } from "./crypto";
import { env } from "../config/env";

describe("signWebhook", () => {
  it("should calculate correct HMAC-SHA256 signature for a standard payload", () => {
    const payload = '{"user_id": 123, "event": "message_received"}';
    const secret = "my_super_secret";
    const timestamp = "1680000000";

    const mac = crypto.createHmac("sha256", `${secret}.${env.WEBHOOK_SIGNING_PEPPER}`);
    mac.update(`${timestamp}.${payload}`);
    const expected = mac.digest("hex");

    const result = signWebhook(payload, secret, timestamp);

    expect(result).toBe(expected);
  });

  it("should match a specific known input with a manually pre-calculated HMAC signature", () => {
    // This test ensures that the internal mechanism (e.g. pepper, format) hasn't changed unexpectedly
    const payload = '{"hello":"world"}';
    const secret = "test_secret";
    const timestamp = "1234567890";

    // Calculated externally using node:
    // crypto.createHmac('sha256', 'test_secret.dev-insecure-webhook-pepper-change-me').update('1234567890.{"hello":"world"}').digest('hex')
    const expectedHex = "77eccc0e34a8b964d91302644660e79b979a8c6916225eacb7b2b734330f2d51";

    const result = signWebhook(payload, secret, timestamp);

    expect(result).toBe(expectedHex);
  });

  it("should calculate correct HMAC-SHA256 signature for an empty payload", () => {
    const payload = "";
    const secret = "my_super_secret";
    const timestamp = "1680000000";

    const mac = crypto.createHmac("sha256", `${secret}.${env.WEBHOOK_SIGNING_PEPPER}`);
    mac.update(`${timestamp}.${payload}`);
    const expected = mac.digest("hex");

    const result = signWebhook(payload, secret, timestamp);

    expect(result).toBe(expected);
  });

  it("should handle special Unicode characters in the payload correctly", () => {
    const payload = '{"message": "Hello 🌍! \\uD83D\\uDE00 öäü"}';
    const secret = "unicode_secret";
    const timestamp = "1680000001";

    const mac = crypto.createHmac("sha256", `${secret}.${env.WEBHOOK_SIGNING_PEPPER}`);
    mac.update(`${timestamp}.${payload}`);
    const expected = mac.digest("hex");

    const result = signWebhook(payload, secret, timestamp);

    expect(result).toBe(expected);
  });

  it("should calculate correct signature when secret is empty", () => {
    const payload = '{"test": true}';
    const secret = "";
    const timestamp = "1680000002";

    const mac = crypto.createHmac("sha256", `${secret}.${env.WEBHOOK_SIGNING_PEPPER}`);
    mac.update(`${timestamp}.${payload}`);
    const expected = mac.digest("hex");

    const result = signWebhook(payload, secret, timestamp);

    expect(result).toBe(expected);
  });

  it("should calculate correct signature when timestamp is empty", () => {
    const payload = '{"test": true}';
    const secret = "timestamp_secret";
    const timestamp = "";

    const mac = crypto.createHmac("sha256", `${secret}.${env.WEBHOOK_SIGNING_PEPPER}`);
    mac.update(`${timestamp}.${payload}`);
    const expected = mac.digest("hex");

    const result = signWebhook(payload, secret, timestamp);

    expect(result).toBe(expected);
  });

  it("should produce consistent output for the same input", () => {
    const payload = '{"test": true}';
    const secret = "test_secret";
    const timestamp = "1234567890";

    const result1 = signWebhook(payload, secret, timestamp);
    const result2 = signWebhook(payload, secret, timestamp);

    expect(result1).toBe(result2);
  });

  it("should produce different signatures for different payloads", () => {
    const secret = "test_secret";
    const timestamp = "1234567890";

    const result1 = signWebhook('{"test": 1}', secret, timestamp);
    const result2 = signWebhook('{"test": 2}', secret, timestamp);

    expect(result1).not.toBe(result2);
  });

  it("should produce different signatures for different secrets", () => {
    const payload = '{"test": true}';
    const timestamp = "1234567890";

    const result1 = signWebhook(payload, "secret_1", timestamp);
    const result2 = signWebhook(payload, "secret_2", timestamp);

    expect(result1).not.toBe(result2);
  });

  it("should produce different signatures for different timestamps", () => {
    const payload = '{"test": true}';
    const secret = "test_secret";

    const result1 = signWebhook(payload, secret, "1000");
    const result2 = signWebhook(payload, secret, "2000");

    expect(result1).not.toBe(result2);
  });
});
