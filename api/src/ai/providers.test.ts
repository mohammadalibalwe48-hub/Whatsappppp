import { afterEach, describe, expect, it, vi } from "vitest";
import { generateAiReply, validateCompatibleBaseUrl } from "./providers";

afterEach(() => vi.unstubAllGlobals());

describe("validateCompatibleBaseUrl", () => {
  it("accepts supported HTTPS provider endpoints and trims trailing slashes", () => {
    expect(validateCompatibleBaseUrl("https://api.groq.com/openai/v1/")).toBe("https://api.groq.com/openai/v1");
    expect(validateCompatibleBaseUrl("https://openrouter.ai/api/v1")).toBe("https://openrouter.ai/api/v1");
  });

  it.each([
    "http://api.openai.com/v1",
    "https://localhost/v1",
    "https://127.0.0.1/v1",
    "https://api.openai.com/v1?key=secret",
    "https://user:pass@api.openai.com/v1",
    "https://attacker.example/v1"
  ])("rejects unsafe or unsupported endpoint %s", (url) => {
    expect(() => validateCompatibleBaseUrl(url)).toThrow();
  });
});

describe("generateAiReply", () => {
  it("sends Gemini keys in a header and extracts the generated text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Hello there." }] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const reply = await generateAiReply({ provider: "gemini", model: "gemini-2.5-flash", apiKey: "private-key" }, [{ role: "user", content: "Hi" }]);
    expect(reply).toBe("Hello there.");
    expect(fetchMock.mock.calls[0][0]).not.toContain("private-key");
    expect(fetchMock.mock.calls[0][1].headers["x-goog-api-key"]).toBe("private-key");
  });

  it("uses bearer auth for OpenAI-compatible providers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Thanks for reaching out." } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const reply = await generateAiReply({ provider: "openai_compatible", model: "gpt-4o-mini", apiKey: "private-key", baseUrl: "https://api.openai.com/v1" }, [{ role: "user", content: "Hi" }]);
    expect(reply).toBe("Thanks for reaching out.");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.openai.com/v1/chat/completions");
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer private-key");
  });
});
