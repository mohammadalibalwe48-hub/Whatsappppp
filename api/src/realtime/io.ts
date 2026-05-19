import { Server as HttpServer } from "http";
import { Server as IOServer, Socket } from "socket.io";
import { env } from "../config/env";
import { getSupabase, supabaseAvailable } from "../lib/supabase";
import { logger } from "../lib/logger";
import { sessionManager } from "../whatsapp/sessionManager";

export function attachRealtime(httpServer: HttpServer): IOServer {
  const io = new IOServer(httpServer, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    serveClient: false,
    transports: ["websocket", "polling"]
  });

  io.use(async (socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.query?.token as string | undefined);
    if (!token) return next(new Error("Missing auth token"));
    if (!supabaseAvailable()) return next(new Error("Supabase not configured"));
    try {
      const { data, error } = await getSupabase().auth.getUser(token);
      if (error || !data.user) return next(new Error("Invalid token"));
      (socket.data as { userId: string }).userId = data.user.id;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket.data as { userId: string }).userId;
    const room = `user:${userId}`;
    socket.join(room);

    // Send current snapshot immediately on connect.
    const state = sessionManager.getState(userId);
    if (state) socket.emit("session:state", state);

    socket.on("disconnect", () => {
      // No-op — rooms are cleaned automatically.
    });
  });

  // Fan out session state changes to whichever room the user is in.
  sessionManager.on("state", (state) => {
    io.to(`user:${state.userId}`).emit("session:state", state);
  });

  logger.info("Realtime (Socket.IO) attached");
  return io;
}
