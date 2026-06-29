import { describe, it, expect, vi, afterEach } from "vitest";
import { HuggingFaceImageProvider } from "./huggingface";

describe("HuggingFaceImageProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("正常情況：沒有參考圖片時，呼叫文字生圖模型", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new HuggingFaceImageProvider();
    await provider.generate({ prompt: "a cat" }, { apiKey: "key" });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("stabilityai/stable-diffusion-2");
    expect(JSON.parse(options.body)).toEqual({ inputs: "a cat" });
  });

  it("正常情況：有參考圖片時，呼叫 img2img 模型並帶入 base64 圖片與 prompt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer,
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new HuggingFaceImageProvider();
    await provider.generate(
      { prompt: "make it sunset", referenceImage: { base64: "Zm9v", mimeType: "image/png" } },
      { apiKey: "key" },
    );

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("timbrooks/instruct-pix2pix");
    expect(JSON.parse(options.body)).toEqual({
      inputs: "data:image/png;base64,Zm9v",
      parameters: { prompt: "make it sunset" },
    });
  });

  it("正常情況：credentials 帶有 model 時，文字生圖改用該模型", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new HuggingFaceImageProvider();
    await provider.generate({ prompt: "a cat" }, { apiKey: "key", model: "stabilityai/stable-diffusion-2-1" });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("stabilityai/stable-diffusion-2-1");
  });
});
