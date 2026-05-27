import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendOtp, verifyOtp } from "./service";
import { getKv } from "../lib/redis";
import { generateOtpCode, hashOtp, verifyOtpHash } from "../lib/crypto";
import { getSupabase, supabaseAvailable } from "../lib/supabase";
import { enqueueWebhook } from "../webhooks/dispatcher";

vi.mock("../lib/redis", () => ({
  getKv: vi.fn(),
}));

vi.mock("../lib/crypto", () => ({
  verifyOtpHash: vi.fn(),
  generateOtpCode: vi.fn(),
  hashOtp: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  getSupabase: vi.fn(),
  supabaseAvailable: vi.fn(),
}));

vi.mock("../webhooks/dispatcher", () => ({
  enqueueWebhook: vi.fn(),
}));

vi.mock("../lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../whatsapp/sessionManager", () => ({
  sessionManager: {
    sendMessage: vi.fn(),
  },
}));

import { sessionManager } from "../whatsapp/sessionManager";
import { env } from "../config/env";

describe("sendOtp", () => {
  let mockKv: any;
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockKv = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      ttl: vi.fn(),
    };
    (getKv as any).mockReturnValue(mockKv);

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({}),
    };
    (getSupabase as any).mockReturnValue(mockSupabase);
    (supabaseAvailable as any).mockReturnValue(true);

    (generateOtpCode as any).mockReturnValue("123456");
    (hashOtp as any).mockResolvedValue("mocked_hash");
    env.NODE_ENV = "test"; // To allow returning devCode
  });

  const baseInput = {
    userId: "user_123",
    apiKeyId: "key_123",
    phoneNumber: "+1 555-123-4567", // Non-normalized for test
    ip: "127.0.0.1",
    userAgent: "test-agent",
  };

  it("successfully generates OTP, saves it, sends a message, and logs audit", async () => {
    (sessionManager.sendMessage as any).mockResolvedValue("msg_id");

    const result = await sendOtp(baseInput);

    // Should return the correct shape
    expect(result).toHaveProperty("otpId");
    expect(result).toHaveProperty("expiresAt");
    expect(result).toHaveProperty("ttlSeconds", env.OTP_DEFAULT_TTL_SECONDS);
    expect(result).toHaveProperty("devCode", "123456"); // Returned outside production

    // Phone normalisation
    const expectedPhone = "15551234567";

    // Validates record saved to KV
    expect(mockKv.set).toHaveBeenCalledWith(
      expect.stringContaining(`otp:active:user_123:${expectedPhone}`),
      result.otpId,
      env.OTP_DEFAULT_TTL_SECONDS
    );

    // Session manager should be called
    expect(sessionManager.sendMessage).toHaveBeenCalledWith(
      "user_123",
      expectedPhone,
      expect.stringContaining("123456")
    );

    // Audit logs inserted once after delivery
    expect(mockSupabase.insert).toHaveBeenCalledTimes(1);
    expect(mockSupabase.insert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "pending", // Initially pending
        failure_reason: null,
        ip: "127.0.0.1",
        user_agent: "test-agent"
      })
    );

    // Webhook sent
    expect(enqueueWebhook).toHaveBeenCalledWith({
      userId: "user_123",
      event: "otp.sent",
      data: {
        otpId: result.otpId,
        phoneNumber: expectedPhone,
        expiresAt: result.expiresAt
      }
    });
  });

  it("respects custom inputs (length, alphabet, ttlSeconds, appName)", async () => {
    (generateOtpCode as any).mockReturnValue("ABCDEFGH");
    (sessionManager.sendMessage as any).mockResolvedValue("msg_id");

    const result = await sendOtp({
      ...baseInput,
      length: 8,
      alphabet: "alphabetic",
      ttlSeconds: 600,
      appName: "MyApp",
    });

    expect(generateOtpCode).toHaveBeenCalledWith(8, "alphabetic");
    expect(result.ttlSeconds).toBe(600);

    // Message should contain the custom app name
    expect(sessionManager.sendMessage).toHaveBeenCalledWith(
      "user_123",
      "15551234567",
      expect.stringContaining("MyApp")
    );
  });

  it("throws error and logs failure if message sending fails", async () => {
    const error = new Error("WhatsApp disconnected");
    (sessionManager.sendMessage as any).mockRejectedValue(error);

    await expect(sendOtp(baseInput)).rejects.toThrow("WhatsApp disconnected");

    // KV should have saved the failure status
    expect(mockKv.set).toHaveBeenCalledWith(
      expect.any(String), // otp:record:...
      expect.stringContaining('"status":"failed"'),
      expect.any(Number)
    );

    // Audit log should capture failure
    expect(mockSupabase.insert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        failure_reason: "WhatsApp disconnected",
        delivered_at: null,
      })
    );

    // Failure webhook enqueued
    expect(enqueueWebhook).toHaveBeenCalledWith({
      userId: "user_123",
      event: "otp.failed",
      data: {
        otpId: expect.any(String),
        phoneNumber: "15551234567",
        reason: "WhatsApp disconnected",
      }
    });
  });

  it("does not return devCode when NODE_ENV is production", async () => {
    const originalEnv = env.NODE_ENV;
    env.NODE_ENV = "production";

    (sessionManager.sendMessage as any).mockResolvedValue("msg_id");
    const result = await sendOtp(baseInput);

    expect(result.devCode).toBeUndefined();

    env.NODE_ENV = originalEnv;
  });

  it("throws when normalisePhone gets no digits", async () => {
    await expect(sendOtp({ ...baseInput, phoneNumber: "invalid" })).rejects.toThrow("phoneNumber must contain digits");
  });
});

describe("verifyOtp", () => {
  let mockKv: any;
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockKv = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      ttl: vi.fn(),
    };
    (getKv as any).mockReturnValue(mockKv);

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({}),
    };
    (getSupabase as any).mockReturnValue(mockSupabase);
    (supabaseAvailable as any).mockReturnValue(true);
  });

  const baseInput = {
    userId: "user_123",
    apiKeyId: "key_123",
    otpId: "otp_abc",
    code: "123456",
  };

  const baseRecord = {
    id: "otp_abc",
    userId: "user_123",
    apiKeyId: "key_123",
    phoneNumber: "15551234567",
    codeHash: "hash_abc",
    codeLength: 6,
    codeAlphabet: "numeric" as const,
    expiresAt: Date.now() + 10000,
    attempts: 0,
    maxAttempts: 3,
    status: "pending" as const,
    createdAt: Date.now(),
    resendCount: 0,
  };

  it("returns not_found when OTP record does not exist", async () => {
    mockKv.get.mockResolvedValue(null);

    const result = await verifyOtp(baseInput);

    expect(result).toEqual({ status: "not_found" });
    expect(mockKv.get).toHaveBeenCalledWith("otp:record:otp_abc");
  });

  it("returns not_found when looking up by phoneNumber and active ID is not found", async () => {
    mockKv.get.mockResolvedValue(null);

    const result = await verifyOtp({
      ...baseInput,
      otpId: undefined,
      phoneNumber: "+15551234567",
    });

    expect(result).toEqual({ status: "not_found" });
    expect(mockKv.get).toHaveBeenCalledWith("otp:active:user_123:15551234567");
  });

  it("returns not_found if record belongs to a different user", async () => {
    mockKv.get.mockResolvedValue(JSON.stringify({ ...baseRecord, userId: "user_999" }));

    const result = await verifyOtp(baseInput);

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns verified immediately if already verified", async () => {
    mockKv.get.mockResolvedValue(JSON.stringify({ ...baseRecord, status: "verified" }));

    const result = await verifyOtp(baseInput);

    expect(result).toEqual({
      status: "verified",
      otpId: "otp_abc",
      phoneNumber: "15551234567",
    });
    expect(mockKv.set).not.toHaveBeenCalled();
    expect(verifyOtpHash).not.toHaveBeenCalled();
  });

  it("returns expired if past expiresAt", async () => {
    mockKv.get.mockResolvedValue(JSON.stringify({ ...baseRecord, expiresAt: Date.now() - 1000 }));

    const result = await verifyOtp(baseInput);

    expect(result).toEqual({ status: "expired", otpId: "otp_abc" });
    expect(mockKv.set).toHaveBeenCalled(); // saves the "expired" status
    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({ status: "expired" }));
  });

  it("returns invalid (max_attempts) if attempts exceed maxAttempts", async () => {
    mockKv.get.mockResolvedValue(JSON.stringify({ ...baseRecord, attempts: 3, maxAttempts: 3 }));

    const result = await verifyOtp(baseInput);

    expect(result).toEqual({
      status: "invalid",
      otpId: "otp_abc",
      attemptsRemaining: 0,
      reason: "max_attempts",
    });
    expect(mockKv.set).toHaveBeenCalled(); // saves incremented attempt + status
    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", attempts: 4 }));
    expect(enqueueWebhook).toHaveBeenCalledWith(expect.objectContaining({
      event: "otp.failed",
      data: expect.objectContaining({ reason: "max_attempts" })
    }));
  });

  it("returns invalid (wrong_code) if verifyOtpHash fails", async () => {
    mockKv.get.mockResolvedValue(JSON.stringify(baseRecord));
    (verifyOtpHash as any).mockResolvedValue(false);

    const result = await verifyOtp(baseInput);

    expect(result).toEqual({
      status: "invalid",
      otpId: "otp_abc",
      attemptsRemaining: 2,
      reason: "wrong_code",
    });
    expect(verifyOtpHash).toHaveBeenCalledWith("123456", "hash_abc");
    expect(mockKv.set).toHaveBeenCalled(); // saves incremented attempts
    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({ attempts: 1 }));
  });

  it("capitalizes the input code if alphabet is not numeric", async () => {
    mockKv.get.mockResolvedValue(JSON.stringify({ ...baseRecord, codeAlphabet: "alphanumeric" }));
    (verifyOtpHash as any).mockResolvedValue(false);

    await verifyOtp({ ...baseInput, code: "abc" });

    expect(verifyOtpHash).toHaveBeenCalledWith("ABC", "hash_abc");
  });

  it("returns verified on success, deletes active KV, and sends webhook", async () => {
    mockKv.get.mockResolvedValue(JSON.stringify(baseRecord));
    (verifyOtpHash as any).mockResolvedValue(true);

    const result = await verifyOtp(baseInput);

    expect(result).toEqual({
      status: "verified",
      otpId: "otp_abc",
      phoneNumber: "15551234567",
    });

    // Validates hash
    expect(verifyOtpHash).toHaveBeenCalledWith("123456", "hash_abc");

    // Updates record status in KV and Supabase
    expect(mockKv.set).toHaveBeenCalledWith(
      "otp:record:otp_abc",
      expect.stringContaining('"status":"verified"'),
      expect.any(Number)
    );
    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "verified", verified_at: expect.any(String) })
    );

    // Deletes active reference
    expect(mockKv.del).toHaveBeenCalledWith("otp:active:user_123:15551234567");

    // Sends webhook
    expect(enqueueWebhook).toHaveBeenCalledWith({
      userId: "user_123",
      event: "otp.verified",
      data: { otpId: "otp_abc", phoneNumber: "15551234567" },
    });
  });
});
