import { describe, it, expect, vi, afterEach } from "vitest";
import { ComfyUiImageProvider } from "./comfyui";

function jsonResponse(ok: boolean, body: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
  };
}

function textResponse(ok: boolean, body: string, status = 200) {
  return {
    ok,
    status,
    text: async () => body,
    headers: { get: () => null },
  };
}

describe("ComfyUiImageProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("正常情況：沒有參考圖片時，提交工作流並輪詢歷史紀錄拿到輸出圖片", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(true, { prompt_id: "p1" })) // POST /prompt
      .mockResolvedValueOnce(
        jsonResponse(true, { p1: { outputs: { "9": { images: [{ filename: "a.png", subfolder: "", type: "output" }] } } } }),
      ) // GET /history/p1
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (key: string) => (key.toLowerCase() === "content-type" ? "image/png" : null) },
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      }); // GET /view
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ComfyUiImageProvider();
    const result = await provider.generate({ prompt: "a cat" }, { apiKey: "http://localhost:8188/" });

    const [promptUrl, promptOptions] = fetchMock.mock.calls[0];
    expect(promptUrl).toBe("http://localhost:8188/prompt");
    const workflow = JSON.parse(promptOptions.body).prompt;
    expect(workflow["6"].inputs.text).toBe("a cat");
    expect(workflow["4"].inputs.ckpt_name).toBe("sd_xl_base_1.0.safetensors");

    const [historyUrl] = fetchMock.mock.calls[1];
    expect(historyUrl).toBe("http://localhost:8188/history/p1");

    const [viewUrl] = fetchMock.mock.calls[2];
    expect(viewUrl).toContain("http://localhost:8188/view?");
    expect(result.url).toBe(`data:image/png;base64,${Buffer.from([1, 2, 3]).toString("base64")}`);
  });

  it("正常情況：有參考圖片時，先上傳圖片再以 LoadImage 節點組 img2img 工作流", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(true, { name: "uploaded.png" })) // POST /upload/image
      .mockResolvedValueOnce(jsonResponse(true, { prompt_id: "p1" })) // POST /prompt
      .mockResolvedValueOnce(
        jsonResponse(true, { p1: { outputs: { "9": { images: [{ filename: "b.png", subfolder: "", type: "output" }] } } } }),
      ) // GET /history/p1
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: (key: string) => (key.toLowerCase() === "content-type" ? "image/png" : null) },
        arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer,
      }); // GET /view
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ComfyUiImageProvider();
    const result = await provider.generate(
      { prompt: "make it sunset", referenceImage: { base64: "Zm9v", mimeType: "image/png" } },
      { apiKey: "http://localhost:8188" },
    );

    const [uploadUrl, uploadOptions] = fetchMock.mock.calls[0];
    expect(uploadUrl).toBe("http://localhost:8188/upload/image");
    expect(uploadOptions.body).toBeInstanceOf(FormData);

    const [, promptOptions] = fetchMock.mock.calls[1];
    const workflow = JSON.parse(promptOptions.body).prompt;
    expect(workflow["10"].inputs.image).toBe("uploaded.png");
    expect(result.url).toBe(`data:image/png;base64,${Buffer.from([4, 5, 6]).toString("base64")}`);
  });

  it("異常情況：缺少伺服器網址時拋出錯誤", async () => {
    const provider = new ComfyUiImageProvider();
    await expect(provider.generate({ prompt: "a cat" }, {})).rejects.toThrow("Missing ComfyUI server URL");
  });

  it("異常情況：提交工作流失敗時拋出例外", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(false, { error: "invalid workflow" }, 400));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ComfyUiImageProvider();
    await expect(provider.generate({ prompt: "a cat" }, { apiKey: "http://localhost:8188" })).rejects.toThrow(
      "invalid workflow",
    );
  });

  it("異常情況：伺服器回應非 JSON 內容（例如反向代理的 413 純文字）時拋出可讀的錯誤訊息", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(textResponse(false, "Request Entity Too Large", 413));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ComfyUiImageProvider();
    await expect(provider.generate({ prompt: "a cat" }, { apiKey: "http://localhost:8188" })).rejects.toThrow(
      "Request Entity Too Large",
    );
  });

  it("正常情況：credentials 帶有 model 時，改用該 checkpoint 檔名", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(true, { prompt_id: "p1" }))
      .mockResolvedValueOnce(
        jsonResponse(true, { p1: { outputs: { "9": { images: [{ filename: "a.png", subfolder: "", type: "output" }] } } } }),
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "image/png" },
        arrayBuffer: async () => new Uint8Array([1]).buffer,
      });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ComfyUiImageProvider();
    await provider.generate({ prompt: "a cat" }, { apiKey: "http://localhost:8188", model: "custom-checkpoint.safetensors" });

    const [, promptOptions] = fetchMock.mock.calls[0];
    const workflow = JSON.parse(promptOptions.body).prompt;
    expect(workflow["4"].inputs.ckpt_name).toBe("custom-checkpoint.safetensors");
  });

  it("正常情況：model 為 FLUX 系列檔名時，改用 UNETLoader/DualCLIPLoader 組 FLUX 工作流", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(true, { prompt_id: "p1" }))
      .mockResolvedValueOnce(
        jsonResponse(true, { p1: { outputs: { "9": { images: [{ filename: "a.png", subfolder: "", type: "output" }] } } } }),
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "image/png" },
        arrayBuffer: async () => new Uint8Array([1]).buffer,
      });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ComfyUiImageProvider();
    await provider.generate({ prompt: "a cat" }, { apiKey: "http://localhost:8188", model: "flux1-dev.safetensors" });

    const [, promptOptions] = fetchMock.mock.calls[0];
    const workflow = JSON.parse(promptOptions.body).prompt;
    expect(workflow["12"].class_type).toBe("UNETLoader");
    expect(workflow["12"].inputs.unet_name).toBe("flux1-dev.safetensors");
    expect(workflow["11"].class_type).toBe("DualCLIPLoader");
    expect(workflow["4"]).toBeUndefined();
  });

  it("正常情況：FLUX model 搭配參考圖片時，用 LoadImage 接到 FLUX 的 VAEEncode 組 img2img 工作流", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(true, { name: "uploaded.png" }))
      .mockResolvedValueOnce(jsonResponse(true, { prompt_id: "p1" }))
      .mockResolvedValueOnce(
        jsonResponse(true, { p1: { outputs: { "9": { images: [{ filename: "b.png", subfolder: "", type: "output" }] } } } }),
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "image/png" },
        arrayBuffer: async () => new Uint8Array([4]).buffer,
      });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ComfyUiImageProvider();
    await provider.generate(
      { prompt: "make it sunset", referenceImage: { base64: "Zm9v", mimeType: "image/png" } },
      { apiKey: "http://localhost:8188", model: "flux1-dev.safetensors" },
    );

    const [, promptOptions] = fetchMock.mock.calls[1];
    const workflow = JSON.parse(promptOptions.body).prompt;
    expect(workflow["20"].inputs.image).toBe("uploaded.png");
    expect(workflow["21"].class_type).toBe("VAEEncode");
    expect(workflow["12"].class_type).toBe("UNETLoader");
  });
});
