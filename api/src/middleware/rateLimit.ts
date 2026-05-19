import { NextFunction, Request, Response } from "express";
import { getKv } from "../lib/redis";

interface Options {
  bucket: string;
  windowSeconds: number;
  limit: number;
  identify?: (req: Request) => string;
}

/**
 * Redis-backed sliding-window rate limiter (per-API-key by default, falls back
 * to IP). Adds standard rate-limit headers and returns 429 when exceeded.
 */
export function rateLimit(opts: Options) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const id =
      (opts.identify?.(req)) ??
      req.apiKey?.id ??
      req.userId ??
      req.ip ??
      "anon";
    const kv = getKv();
    const key = `rl:${opts.bucket}:${id}`;
    const count = await kv.incr(key, opts.windowSeconds);
    const remaining = Math.max(0, opts.limit - count);
    res.setHeader("x-ratelimit-limit", String(opts.limit));
    res.setHeader("x-ratelimit-remaining", String(remaining));
    res.setHeader("x-ratelimit-window", `${opts.windowSeconds}s`);
    if (count > opts.limit) {
      const ttl = await kv.ttl(key);
      const retryAfter = Math.max(1, ttl);
      res.setHeader("retry-after", String(retryAfter));
      return res
        .status(429)
        .json({ error: { code: "rate_limited", message: "Rate limit exceeded", retryAfter } });
    }
    next();
  };
}
