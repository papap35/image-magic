import { describe, it, expect, vi, afterEach } from "vitest";
import { FalImageProvider } from "./fal";

describe("FalImageProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("正常情況：沒有參考圖片時，呼叫 fal.run 的文字轉圖片端點", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ images: [{ url: "https://fal.media/a.png" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new FalImageProvider();
    const result = await provider.generate({ prompt: "a cat" }, { apiKey: "key" });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://fal.run/fal-ai/flux/dev");
    expect(options.headers.Authorization).toBe("Key key");
    expect(JSON.parse(options.body)).toEqual({ prompt: "a cat" });
    expect(result.url).toBe("https://fal.media/a.png");
  });

  it("正常情況：有參考圖片時，呼叫 image-to-image 端點並以 data URI 帶入圖片", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ images: [{ url: "https://fal.media/edited.png" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new FalImageProvider();
    const result = await provider.generate(
      { prompt: "make it sunset", referenceImage: { base64: "Zm9v", mimeType: "image/png" } },
      { apiKey: "key" },
    );

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://fal.run/fal-ai/flux/dev/image-to-image");
    expect(JSON.parse(options.body)).toEqual({
      prompt: "make it sunset",
      image_url: "data:image/png;base64,Zm9v",
    });
    expect(result.url).toBe("https://fal.media/edited.png");
  });

  it("異常情況：缺少 apiKey 時拋出錯誤", async () => {
    const provider = new FalImageProvider();
    await expect(provider.generate({ prompt: "a cat" }, {})).rejects.toThrow("Missing fal.ai API key");
  });

  it("異常情況：API 回應失敗時，使用錯誤訊息拋出例外", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ detail: "invalid api key" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new FalImageProvider();
    await expect(provider.generate({ prompt: "a cat" }, { apiKey: "bad" })).rejects.toThrow("invalid api key");
  });

  it("正常情況：credentials 帶有 model 時，改用該模型", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ images: [{ url: "https://fal.media/a.png" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new FalImageProvider();
    await provider.generate({ prompt: "a cat" }, { apiKey: "key", model: "fal-ai/flux/schnell" });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://fal.run/fal-ai/flux/schnell");
  });
});
