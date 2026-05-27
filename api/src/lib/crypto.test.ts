import { describe, it } from "node:test";
import assert from "node:assert";
import { generateOtpCode } from "./crypto";

describe("generateOtpCode", () => {
  it("should generate a numeric code of the specified length", () => {
    const code = generateOtpCode(6);
    assert.strictEqual(code.length, 6);
    assert.match(code, /^[0-9]+$/);
  });

  it("should generate a numeric code by default", () => {
    const code = generateOtpCode(8);
    assert.strictEqual(code.length, 8);
    assert.match(code, /^[0-9]+$/);
  });

  it("should generate an alphanumeric code", () => {
    const code = generateOtpCode(10, "alphanumeric");
    assert.strictEqual(code.length, 10);
    assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]+$/);
  });

  it("should generate an alphabetic code", () => {
    const code = generateOtpCode(10, "alphabetic");
    assert.strictEqual(code.length, 10);
    assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ]+$/);
  });

  it("should handle large lengths", () => {
    const code = generateOtpCode(100);
    assert.strictEqual(code.length, 100);
    assert.match(code, /^[0-9]+$/);
  });

  it("should distribute reasonably across characters (sanity check)", () => {
    const code = generateOtpCode(1000, "numeric");
    const counts: Record<string, number> = {};
    for (const char of code) {
      counts[char] = (counts[char] || 0) + 1;
    }
    // With 1000 chars and 10 possibilities, expect roughly 100 of each.
    // We just assert that all 10 digits appear at least once to avoid flaky tests,
    // though rejection sampling should be uniform.
    for (let i = 0; i <= 9; i++) {
        assert.ok(counts[String(i)] > 0, `Character ${i} is missing`);
    }
  });
});
