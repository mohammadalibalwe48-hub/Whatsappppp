import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { errorHandler, HttpError } from "../errors";
import { logger } from "../../lib/logger";

// Mock the logger to avoid polluting test output
vi.mock("../../lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("errorHandler middleware", () => {
  const app = express();

  // A dummy route that throws a ZodError
  app.get("/zod-error", () => {
    const schema = z.object({
      name: z.string().min(3),
    });
    schema.parse({ name: "a" }); // This will throw ZodError
  });

  // A dummy route that throws an HttpError
  app.get("/http-error", () => {
    throw new HttpError(403, "Custom forbidden message", { extra: "info" });
  });

  // A dummy route that throws a rate limit error
  app.get("/rate-limit", () => {
    const error: any = new Error("Too many requests");
    error.statusCode = 429;
    error.retryAfter = 60;
    throw error;
  });

  // A dummy route that throws a general error
  app.get("/unhandled-error", () => {
    throw new Error("Something went completely wrong");
  });

  // Attach the error handler at the end
  app.use(errorHandler);

  it("should handle ZodError and return 400 with formatted details", async () => {
    const response = await request(app).get("/zod-error");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "validation_error",
        message: "Invalid request",
        details: expect.objectContaining({
          fieldErrors: {
            name: ["String must contain at least 3 character(s)"],
          },
        }),
      },
    });
  });

  it("should handle HttpError and return its status and message", async () => {
    const response = await request(app).get("/http-error");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: "forbidden",
        message: "Custom forbidden message",
        details: { extra: "info" },
      },
    });
  });

  it("should handle rate limit error (statusCode 429) and return retry-after header", async () => {
    const response = await request(app).get("/rate-limit");

    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBe("60");
    expect(response.body).toEqual({
      error: {
        code: "rate_limited",
        message: "Too many requests",
        retryAfter: 60,
      },
    });
  });

  it("should handle unhandled errors, log them, and return 500", async () => {
    const response = await request(app).get("/unhandled-error");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: "internal_error",
        message: "Internal server error",
      },
    });
    expect(logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Unhandled error"
    );
  });
});
