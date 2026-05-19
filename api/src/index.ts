import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import http from "http";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { getKv } from "./lib/redis";
import { errorHandler, notFound } from "./middleware/errors";
import { publicApiRouter } from "./routes/publicApi";
import { dashboardRouter } from "./routes/dashboard";
import { attachRealtime } from "./realtime/io";
import { sessionManager } from "./whatsapp/sessionManager";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(
  cors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
  })
);
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", async (_req, res) => {
  const kv = getKv();
  let kvReady = kv.ready;
  try {
    await kv.set("__healthcheck__", "1", 5);
  } catch {
    kvReady = false;
  }
  res.json({
    ok: true,
    service: "otpwave-api",
    env: env.NODE_ENV,
    kvReady,
    supabaseConfigured: env.hasSupabase,
    time: new Date().toISOString()
  });
});

app.use("/v1", publicApiRouter);
app.use("/dashboard", dashboardRouter);

app.use(notFound);
app.use(errorHandler);

const httpServer = http.createServer(app);
attachRealtime(httpServer);

httpServer.listen(env.API_PORT, async () => {
  logger.info({ port: env.API_PORT, env: env.NODE_ENV }, "OtpWave API listening");
  // Kick off restoration of previously persisted WhatsApp sessions.
  try {
    const restored = await sessionManager.restoreAll();
    if (restored > 0) logger.info({ restored }, "Restored WhatsApp sessions");
  } catch (err) {
    logger.warn({ err }, "Failed to restore sessions on boot");
  }
});

// Graceful shutdown ---------------------------------------------------------

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => logger.error({ reason }, "Unhandled rejection"));
process.on("uncaughtException", (err) => logger.error({ err }, "Uncaught exception"));

export default app;
