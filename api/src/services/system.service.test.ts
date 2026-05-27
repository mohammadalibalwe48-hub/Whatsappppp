import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { getSystemStatus } from "./system.service";
import { getKv } from "../lib/redis";
import { getSupabase } from "../lib/supabase";
import { sessionManager } from "../whatsapp/sessionManager";

vi.mock("../lib/redis");
vi.mock("../lib/supabase");
vi.mock("../whatsapp/sessionManager");

describe("system.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return system status with healthy dependencies", async () => {
    const mockKvSet = vi.fn().mockResolvedValue("OK");
    (getKv as Mock).mockReturnValue({
      ready: true,
      set: mockKvSet,
    });

    const mockSupabaseLimit = vi.fn().mockResolvedValue({ error: null });
    const mockSupabaseSelect = vi.fn().mockReturnValue({ limit: mockSupabaseLimit });
    const mockSupabaseFrom = vi.fn().mockReturnValue({ select: mockSupabaseSelect });
    (getSupabase as Mock).mockReturnValue({
      from: mockSupabaseFrom,
    });

    (sessionManager.getAllStates as Mock).mockReturnValue([
      { status: "connected" },
      { status: "qr" },
      { status: "disconnected" },
    ]);

    const status = await getSystemStatus();

    expect(status.kv.ready).toBe(true);
    expect(typeof status.kv.pingMs).toBe("number");
    expect(status.supabase.ready).toBe(true);
    expect(typeof status.supabase.pingMs).toBe("number");
    expect(status.whatsapp).toEqual({
      totalActive: 3,
      connected: 1,
      qr: 1,
      disconnected: 1,
    });
  });

  it("should handle kv and supabase failures gracefully", async () => {
    (getKv as Mock).mockReturnValue({
      ready: false,
      set: vi.fn().mockRejectedValue(new Error("Redis offline")),
    });

    const mockSupabaseLimit = vi.fn().mockRejectedValue(new Error("Supabase offline"));
    const mockSupabaseSelect = vi.fn().mockReturnValue({ limit: mockSupabaseLimit });
    const mockSupabaseFrom = vi.fn().mockReturnValue({ select: mockSupabaseSelect });
    (getSupabase as Mock).mockReturnValue({
      from: mockSupabaseFrom,
    });

    (sessionManager.getAllStates as Mock).mockReturnValue([]);

    const status = await getSystemStatus();

    expect(status.kv.ready).toBe(false);
    expect(status.kv.pingMs).toBeNull();
    expect(status.supabase.ready).toBe(false);
    expect(status.supabase.pingMs).toBeNull();
    expect(status.whatsapp).toEqual({
      totalActive: 0,
      connected: 0,
      qr: 0,
      disconnected: 0,
    });
  });
});
