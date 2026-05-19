import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Try to load from project root .env and from api/.env, in that order.
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_CORS_ORIGINS: z.string().default("http://localhost:3000"),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),

  REDIS_URL: z.string().default("redis://localhost:6379"),

  SESSION_ENCRYPTION_KEY: z
    .string()
    .min(16, "SESSION_ENCRYPTION_KEY must be at least 16 chars")
    .default("dev-insecure-session-encryption-key-change-me"),
  WEBHOOK_SIGNING_PEPPER: z
    .string()
    .min(8)
    .default("dev-insecure-webhook-pepper-change-me"),

  WHATSAPP_SESSIONS_DIR: z.string().default("./sessions"),

  OTP_DEFAULT_LENGTH: z.coerce.number().int().min(4).max(10).default(6),
  OTP_DEFAULT_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(30),

  RATE_LIMIT_SEND_PER_MIN: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_VERIFY_PER_MIN: z.coerce.number().int().positive().default(60)
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", parsed.error.flatten());
  throw new Error("Invalid environment configuration");
}

const supabaseUrl = parsed.data.SUPABASE_URL ?? parsed.data.NEXT_PUBLIC_SUPABASE_URL;
const corsOrigins = parsed.data.API_CORS_ORIGINS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const env = {
  ...parsed.data,
  SUPABASE_URL: supabaseUrl,
  CORS_ORIGINS: corsOrigins,
  hasSupabase: Boolean(supabaseUrl && parsed.data.SUPABASE_SERVICE_ROLE_KEY)
};

export type Env = typeof env;
