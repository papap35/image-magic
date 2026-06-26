import { describe, it, expect, vi, afterEach } from "vitest";
import { OpenAiImageProvider } from "./openai";

describe("OpenAiImageProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("正常情況：沒有參考圖片時，呼叫 generations endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ url: "https://example.com/a.png" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiImageProvider();
    const result = await provider.generate({ prompt: "a cat" }, { apiKey: "key" });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/images/generations");
    expect(JSON.parse(options.body).model).toBe("dall-e-2");
    expect(result.url).toBe("https://example.com/a.png");
  });

  it("正常情況：有參考圖片時，呼叫 edits endpoint 並以 multipart form 帶入圖片與 prompt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ url: "https://example.com/edited.png" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiImageProvider();
    const result = await provider.generate(
      { prompt: "make it sunset", referenceImage: { base64: "Zm9v", mimeType: "image/png" } },
      { apiKey: "key" },
    );

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/images/edits");
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get("model")).toBe("dall-e-2");
    expect(options.body.get("prompt")).toBe("make it sunset");
    expect(result.url).toBe("https://example.com/edited.png");
  });
});
