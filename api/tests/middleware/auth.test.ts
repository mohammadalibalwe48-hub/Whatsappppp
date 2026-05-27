import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import { requireApiKey } from "../../src/middleware/auth";
import { HttpError } from "../../src/middleware/errors";

// Mock dependencies
vi.mock("../../src/lib/crypto", () => ({
  hashApiKey: vi.fn((key: string) => `hashed_${key}`)
}));

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateEq = vi.fn();

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === "api_keys") {
      return {
        select: mockSelect,
        update: mockUpdate
      };
    }
  })
};

vi.mock("../../src/lib/supabase", () => ({
  supabaseAvailable: vi.fn(() => true),
  getSupabase: vi.fn(() => mockSupabase)
}));

describe("requireApiKey middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      headers: {}
    };
    res = {};
    next = vi.fn();

    // Setup chained mocks
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });

    mockUpdate.mockReturnValue({ eq: mockUpdateEq });
    mockUpdateEq.mockReturnValue(Promise.resolve());
  });

  it("should fail if no API key is provided", async () => {
    const middleware = requireApiKey();
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(HttpError));
    const err = (next as any).mock.calls[0][0];
    expect(err.status).toBe(401);
    expect(err.message).toBe("Missing API key");
  });

  it("should fail if Supabase is not available", async () => {
    const { supabaseAvailable } = await import("../../src/lib/supabase");
    (supabaseAvailable as any).mockReturnValueOnce(false);

    req.headers!["x-api-key"] = "some-key";

    const middleware = requireApiKey();
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(HttpError));
    const err = (next as any).mock.calls[0][0];
    expect(err.status).toBe(500);
    expect(err.message).toBe("Server misconfigured");
  });

  it("should validate using x-api-key header", async () => {
    req.headers!["x-api-key"] = "valid-key";

    const mockData = {
      id: "key-1",
      user_id: "user-1",
      name: "Test Key",
      prefix: "test",
      revoked_at: null,
      default_otp_length: 6,
      default_otp_alphabet: "numeric"
    };

    mockMaybeSingle.mockResolvedValueOnce({ data: mockData, error: null });

    const middleware = requireApiKey();
    await middleware(req as Request, res as Response, next);

    const { hashApiKey } = await import("../../src/lib/crypto");
    expect(hashApiKey).toHaveBeenCalledWith("valid-key");
    expect(mockEq).toHaveBeenCalledWith("key_hash", "hashed_valid-key");

    expect(req.userId).toBe("user-1");
    expect(req.apiKey).toEqual({
      id: "key-1",
      userId: "user-1",
      name: "Test Key",
      prefix: "test",
      defaultOtpLength: 6,
      defaultOtpAlphabet: "numeric"
    });

    expect(mockUpdateEq).toHaveBeenCalledWith("id", "key-1");
    expect(next).toHaveBeenCalledWith(); // Called with no args (success)
  });

  it("should validate using Authorization Bearer header", async () => {
    req.headers!.authorization = "Bearer valid-key-2";

    const mockData = {
      id: "key-2",
      user_id: "user-2",
      name: "Test Key 2",
      prefix: "test",
      revoked_at: null,
      default_otp_length: null, // Test default fallback
      default_otp_alphabet: null
    };

    mockMaybeSingle.mockResolvedValueOnce({ data: mockData, error: null });

    const middleware = requireApiKey();
    await middleware(req as Request, res as Response, next);

    const { hashApiKey } = await import("../../src/lib/crypto");
    expect(hashApiKey).toHaveBeenCalledWith("valid-key-2");

    expect(req.userId).toBe("user-2");
    expect(req.apiKey?.defaultOtpLength).toBe(6); // Default
    expect(req.apiKey?.defaultOtpAlphabet).toBe("numeric"); // Default

    expect(next).toHaveBeenCalledWith();
  });

  it("should fail on DB query error", async () => {
    req.headers!["x-api-key"] = "error-key";

    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: new Error("DB Error") });

    const middleware = requireApiKey();
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(HttpError));
    const err = (next as any).mock.calls[0][0];
    expect(err.status).toBe(401);
    expect(err.message).toBe("Invalid API key");
  });

  it("should fail if key not found", async () => {
    req.headers!["x-api-key"] = "not-found-key";

    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const middleware = requireApiKey();
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(HttpError));
    const err = (next as any).mock.calls[0][0];
    expect(err.status).toBe(401);
    expect(err.message).toBe("Invalid API key");
  });

  it("should fail if key is revoked", async () => {
    req.headers!["x-api-key"] = "revoked-key";

    mockMaybeSingle.mockResolvedValueOnce({
      data: { revoked_at: "2023-01-01T00:00:00Z" },
      error: null
    });

    const middleware = requireApiKey();
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(HttpError));
    const err = (next as any).mock.calls[0][0];
    expect(err.status).toBe(401);
    expect(err.message).toBe("API key revoked");
  });

  it("should fail on unexpected exception", async () => {
    req.headers!["x-api-key"] = "exception-key";

    mockMaybeSingle.mockRejectedValueOnce(new Error("Network failure"));

    const middleware = requireApiKey();
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(HttpError));
    const err = (next as any).mock.calls[0][0];
    expect(err.status).toBe(500);
    expect(err.message).toBe("Failed to authenticate API key");
  });
});
