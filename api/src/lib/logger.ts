import pino from "pino";
import { env } from "../config/env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV === "production"
      ? undefined
      : {
          target: "pino/file",
          options: { destination: 1 }
        },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers['x-api-key']",
      "*.api_key",
      "*.apiKey",
      "*.secret",
      "*.password",
      "*.otp",
      "*.code"
    ],
    censor: "[REDACTED]"
  }
});
