import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encryptAtRest, decryptAtRest } from "./crypto";

describe("crypto at-rest encryption", () => {
  it("should encrypt and decrypt back to original plaintext", () => {
    const secret = "01234567890123456789012345678901";
    const plaintext = Buffer.from("hello world, this is a secret payload");

    const ciphertext = encryptAtRest(plaintext, secret);
    assert.notEqual(ciphertext.includes("hello world"), true);

    const decrypted = decryptAtRest(ciphertext, secret);
    assert.deepEqual(decrypted, plaintext);
  });

  it("should generate different ciphertexts for the same plaintext due to random IV", () => {
    const secret = "01234567890123456789012345678901";
    const plaintext = Buffer.from("hello world");

    const ciphertext1 = encryptAtRest(plaintext, secret);
    const ciphertext2 = encryptAtRest(plaintext, secret);

    assert.notEqual(ciphertext1, ciphertext2);

    // Both should still decrypt correctly
    assert.deepEqual(decryptAtRest(ciphertext1, secret), plaintext);
    assert.deepEqual(decryptAtRest(ciphertext2, secret), plaintext);
  });

  it("should fail to decrypt with incorrect secret", () => {
    const secret1 = "01234567890123456789012345678901";
    const secret2 = "wrong-secret-0123456789012345678";
    const plaintext = Buffer.from("hello world");

    const ciphertext = encryptAtRest(plaintext, secret1);

    assert.throws(() => {
      decryptAtRest(ciphertext, secret2);
    });
  });

  it("should fail to decrypt tampered ciphertext", () => {
    const secret = "01234567890123456789012345678901";
    const plaintext = Buffer.from("hello world");

    const ciphertext = encryptAtRest(plaintext, secret);

    // Tamper with the base64 string
    const tampered = ciphertext.substring(0, ciphertext.length - 2) + "==";

    assert.throws(() => {
      decryptAtRest(tampered, secret);
    });
  });
});
