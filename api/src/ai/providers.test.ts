import { afterEach, describe, expect, it, vi } from "vitest";
import { generateAiReply, listAiModels, validateCompatibleBaseUrl } from "./providers";

afterEach(() => vi.unstubAllGlobals());

describe("validateCompatibleBaseUrl", () => {
  it("accepts supported HTTPS provider endpoints and trims trailing slashes", () => {
    expect(validateCompatibleBaseUrl("https://api.groq.com/openai/v1/")).toBe("https://api.groq.com/openai/v1");
    expect(validateCompatibleBaseUrl("https://openrouter.ai/api/v1")).toBe("https://openrouter.ai/api/v1");
    expect(validateCompatibleBaseUrl("https://api.apinex.bond/v1/")).toBe("https://api.apinex.bond/v1");
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

  it("uses the Apinex OpenAI-compatible chat endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Connected." } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await generateAiReply({ provider: "openai_compatible", model: "apinex-chat", apiKey: "private-key", baseUrl: "https://api.apinex.bond/v1" }, [{ role: "user", content: "Hi" }]);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.apinex.bond/v1/chat/completions");
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer private-key");
  });
});

describe("listAiModels", () => {
  it("loads Gemini text-generation models with the API key in a header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ models: [
      { name: "models/gemini-2.5-flash", displayName: "Gemini 2.5 Flash", supportedGenerationMethods: ["generateContent"] },
      { name: "models/text-embedding-004", displayName: "Text Embedding", supportedGenerationMethods: ["embedContent"] }
    ] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const models = await listAiModels({ provider: "gemini", apiKey: "private-key" });
    expect(models).toEqual([{ id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" }]);
    expect(fetchMock.mock.calls[0][0]).toBe("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000");
    expect(fetchMock.mock.calls[0][1].headers["x-goog-api-key"]).toBe("private-key");
    expect(fetchMock.mock.calls[0][0]).not.toContain("private-key");
  });

  it("loads Groq models with bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [
      { id: "llama-3.3-70b-versatile" },
      { id: "gemma2-9b-it" }
    ] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const models = await listAiModels({ provider: "groq", apiKey: "private-key" });
    expect(models.map((model) => model.id)).toEqual(["gemma2-9b-it", "llama-3.3-70b-versatile"]);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.groq.com/openai/v1/models");
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer private-key");
  });

  it("loads Apinex models from its OpenAI-compatible model catalog", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "apinex-chat" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const models = await listAiModels({ provider: "openai_compatible", apiKey: "private-key", baseUrl: "https://api.apinex.bond/v1" });
    expect(models).toEqual([{ id: "apinex-chat", name: "apinex-chat" }]);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.apinex.bond/v1/models");
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer private-key");
  });
});
