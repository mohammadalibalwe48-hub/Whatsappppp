import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { lookupOtp, resendOtp, sendOtp, verifyOtp } from "../otp/service";
import { requireApiKey } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { HttpError } from "../middleware/errors";

export const publicApiRouter = Router();

const phoneNumberSchema = z
  .string()
  .min(6, "phoneNumber too short")
  .max(20, "phoneNumber too long")
  .regex(/^[+\d][\d\s\-()]*$/, "phoneNumber must be digits (optionally with + and separators)");

const sendSchema = z.object({
  phoneNumber: phoneNumberSchema,
  appName: z.string().max(60).optional(),
  length: z.number().int().min(4).max(10).optional(),
  alphabet: z.enum(["numeric", "alphanumeric", "alphabetic"]).optional(),
  ttlSeconds: z.number().int().min(30).max(60 * 60).optional()
});

const verifySchema = z
  .object({
    otpId: z.string().optional(),
    phoneNumber: phoneNumberSchema.optional(),
    code: z.string().min(4).max(10)
  })
  .refine((v) => v.otpId || v.phoneNumber, {
    message: "Either otpId or phoneNumber is required",
    path: ["otpId"]
  });

const resendSchema = z
  .object({
    otpId: z.string().optional(),
    phoneNumber: phoneNumberSchema.optional()
  })
  .refine((v) => v.otpId || v.phoneNumber, {
    message: "Either otpId or phoneNumber is required",
    path: ["otpId"]
  });

publicApiRouter.post(
  "/otp/send",
  requireApiKey(),
  rateLimit({ bucket: "otp_send", windowSeconds: 60, limit: env.RATE_LIMIT_SEND_PER_MIN }),
  async (req, res, next) => {
    try {
      const body = sendSchema.parse(req.body ?? {});
      const result = await sendOtp({
        userId: req.userId!,
        apiKeyId: req.apiKey!.id,
        phoneNumber: body.phoneNumber,
        appName: body.appName,
        // Per-send values override the API key's per-key defaults.
        length: body.length ?? req.apiKey!.defaultOtpLength,
        alphabet: body.alphabet ?? req.apiKey!.defaultOtpAlphabet,
        ttlSeconds: body.ttlSeconds,
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? null
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

publicApiRouter.post(
  "/otp/verify",
  requireApiKey(),
  rateLimit({ bucket: "otp_verify", windowSeconds: 60, limit: env.RATE_LIMIT_VERIFY_PER_MIN }),
  async (req, res, next) => {
    try {
      const body = verifySchema.parse(req.body ?? {});
      const result = await verifyOtp({
        userId: req.userId!,
        apiKeyId: req.apiKey!.id,
        otpId: body.otpId,
        phoneNumber: body.phoneNumber,
        code: body.code,
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? null
      });
      if (result.status === "verified") return res.json({ ok: true, ...result });
      if (result.status === "not_found") throw new HttpError(404, "OTP not found");
      if (result.status === "expired") return res.status(410).json({ ok: false, ...result });
      if (result.status === "rate_limited") {
        res.setHeader("retry-after", String(result.retryAfter));
        return res.status(429).json({ ok: false, ...result });
      }
      return res.status(400).json({ ok: false, ...result });
    } catch (err) {
      next(err);
    }
  }
);

publicApiRouter.post(
  "/otp/resend",
  requireApiKey(),
  rateLimit({ bucket: "otp_send", windowSeconds: 60, limit: env.RATE_LIMIT_SEND_PER_MIN }),
  async (req, res, next) => {
    try {
      const body = resendSchema.parse(req.body ?? {});
      const result = await resendOtp({
        userId: req.userId!,
        apiKeyId: req.apiKey!.id,
        otpId: body.otpId,
        phoneNumber: body.phoneNumber,
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? null
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

publicApiRouter.get("/otp/:id", requireApiKey(), async (req, res, next) => {
  try {
    const record = await lookupOtp({ userId: req.userId!, otpId: req.params.id });
    if (!record) throw new HttpError(404, "OTP not found");
    res.json({ ok: true, otp: record });
  } catch (err) {
    next(err);
  }
});
