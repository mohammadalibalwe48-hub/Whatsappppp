import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: { code: "not_found", message: "Not found" } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "validation_error",
        message: "Invalid request",
        details: err.flatten()
      }
    });
  }
  if (err instanceof HttpError) {
    return res
      .status(err.status)
      .json({ error: { code: codeFromStatus(err.status), message: err.message, details: err.details } });
  }
  const anyErr = err as any;
  if (anyErr?.statusCode === 429) {
    res.setHeader("retry-after", String(anyErr.retryAfter ?? 30));
    return res.status(429).json({
      error: { code: "rate_limited", message: anyErr.message ?? "Rate limited", retryAfter: anyErr.retryAfter ?? 30 }
    });
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: { code: "internal_error", message: "Internal server error" } });
}

function codeFromStatus(status: number): string {
  switch (status) {
    case 400:
      return "bad_request";
    case 401:
      return "unauthenticated";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 429:
      return "rate_limited";
    default:
      return status >= 500 ? "internal_error" : "error";
  }
}
