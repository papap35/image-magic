import { describe, it, expect, vi, afterEach } from "vitest";
import { GeminiImageProvider } from "./gemini";

describe("GeminiImageProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("正常情況：沒有參考圖片時，呼叫 generateContent 並只帶文字 part", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "Zm9v" } }] } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GeminiImageProvider();
    const result = await provider.generate({ prompt: "a cat" }, { apiKey: "key" });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("gemini-2.0-flash-preview-image-generation:generateContent");
    expect(options.headers["x-goog-api-key"]).toBe("key");
    expect(JSON.parse(options.body).contents[0].parts).toEqual([{ text: "a cat" }]);
    expect(result.url).toBe("data:image/png;base64,Zm9v");
  });

  it("正常情況：有參考圖片時，帶入文字與圖片兩個 part", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "YmFy" } }] } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GeminiImageProvider();
    const result = await provider.generate(
      { prompt: "make it sunset", referenceImage: { base64: "Zm9v", mimeType: "image/png" } },
      { apiKey: "key" },
    );

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body).contents[0].parts).toEqual([
      { text: "make it sunset" },
      { inlineData: { mimeType: "image/png", data: "Zm9v" } },
    ]);
    expect(result.url).toBe("data:image/png;base64,YmFy");
  });

  it("異常情況：缺少 apiKey 時拋出錯誤", async () => {
    const provider = new GeminiImageProvider();
    await expect(provider.generate({ prompt: "a cat" }, {})).rejects.toThrow("Missing Gemini API key");
  });

  it("異常情況：API 回應失敗時，使用錯誤訊息拋出例外", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "invalid api key" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GeminiImageProvider();
    await expect(provider.generate({ prompt: "a cat" }, { apiKey: "bad" })).rejects.toThrow("invalid api key");
  });
});
