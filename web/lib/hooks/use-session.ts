"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { apiFetch, apiUrl, getAccessToken } from "@/lib/api";

export interface WhatsappSessionState {
  userId: string;
  status:
    | "initializing"
    | "qr"
    | "pairing"
    | "connected"
    | "disconnected"
    | "logged_out"
    | "error";
  qrDataUrl: string | null;
  phoneNumber: string | null;
  lastError: string | null;
  updatedAt: string;
}

export function useWhatsappSession() {
  const [state, setState] = useState<WhatsappSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const snapshot = await apiFetch<{ ok: true; session: WhatsappSessionState }>(
          "/dashboard/whatsapp/session"
        );
        if (!cancelled) setState(snapshot.session);
      } catch {
        // ignore — surfaced via UI
      } finally {
        if (!cancelled) setLoading(false);
      }

      const token = await getAccessToken();
      if (!token || cancelled) return;
      const socket = io(apiUrl, {
        auth: { token },
        transports: ["websocket", "polling"]
      });
      socketRef.current = socket;
      socket.on("session:state", (next: WhatsappSessionState) => {
        if (!cancelled) setState(next);
      });
    }

    bootstrap();
    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  async function start() {
    setLoading(true);
    try {
      const res = await apiFetch<{ ok: true; session: WhatsappSessionState }>(
        "/dashboard/whatsapp/session/start",
        { method: "POST" }
      );
      setState(res.session);
    } finally {
      setLoading(false);
    }
  }

  async function stop() {
    await apiFetch<{ ok: true }>("/dashboard/whatsapp/session/stop", { method: "POST" });
  }

  async function logout() {
    await apiFetch<{ ok: true }>("/dashboard/whatsapp/session/logout", { method: "POST" });
  }

  return { state, loading, start, stop, logout };
}
