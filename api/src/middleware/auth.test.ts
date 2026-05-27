import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { requireDashboardAuth } from "./auth";
import * as supabaseLib from "../lib/supabase";

vi.mock("../lib/supabase", () => ({
  getSupabase: vi.fn(),
  supabaseAvailable: vi.fn(),
}));

describe("requireDashboardAuth middleware", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(requireDashboardAuth());
    app.get("/", (req, res) => {
      res.json({ userId: req.userId });
    });
    // Error handler mock
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.status(err.status || 500).json({ error: err.message });
    });
  });

  it("should return 401 if no authorization header is present", async () => {
    const response = await request(app).get("/");
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Missing bearer token");
  });

  it("should return 500 if Supabase is not available", async () => {
    vi.mocked(supabaseLib.supabaseAvailable).mockReturnValue(false);
    const response = await request(app)
      .get("/")
      .set("Authorization", "Bearer something");
    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Supabase is not configured on the server");
  });

  it("should return 401 if token is invalid or expired", async () => {
    vi.mocked(supabaseLib.supabaseAvailable).mockReturnValue(true);
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ error: { message: "Invalid token" }, data: { user: null } }),
      },
    };
    vi.mocked(supabaseLib.getSupabase).mockReturnValue(mockSupabase as any);

    const response = await request(app)
      .get("/")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Invalid or expired token");
    expect(mockSupabase.auth.getUser).toHaveBeenCalledWith("invalid-token");
  });

  it("should call next and set req.userId if token is valid", async () => {
    vi.mocked(supabaseLib.supabaseAvailable).mockReturnValue(true);
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ error: null, data: { user: { id: "user-123" } } }),
      },
    };
    vi.mocked(supabaseLib.getSupabase).mockReturnValue(mockSupabase as any);

    const response = await request(app)
      .get("/")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.userId).toBe("user-123");
    expect(mockSupabase.auth.getUser).toHaveBeenCalledWith("valid-token");
  });

  it("should return 401 if getSupabase throws an error", async () => {
    vi.mocked(supabaseLib.supabaseAvailable).mockReturnValue(true);
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockRejectedValue(new Error("Network error")),
      },
    };
    vi.mocked(supabaseLib.getSupabase).mockReturnValue(mockSupabase as any);

    const response = await request(app)
      .get("/")
      .set("Authorization", "Bearer some-token");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Invalid token");
  });
});
