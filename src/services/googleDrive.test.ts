import { describe, it, expect, vi, afterEach } from "vitest";
import { uploadImageToDrive } from "./googleDrive";

describe("uploadImageToDrive", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("正常情況：上傳成功時回傳 fileId 與 viewUrl", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "file-1", webViewLink: "https://drive.google.com/file/d/file-1/view" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadImageToDrive("token", "folder-1", "a.png", "image/png", Buffer.from([1, 2, 3]));
    expect(result).toEqual({ fileId: "file-1", viewUrl: "https://drive.google.com/file/d/file-1/view" });
  });

  it("異常情況：回應不是 JSON 時，拋出可讀的錯誤訊息而不是 JSON.parse 例外", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Malformed multipart/related request",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadImageToDrive("token", "folder-1", "a.png", "image/png", Buffer.from([1, 2, 3])),
    ).rejects.toThrow("Malformed multipart/related request");
  });

  it("異常情況：回應為 JSON 錯誤時，使用 error.message 拋出例外", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: { message: "insufficient permission" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadImageToDrive("token", "folder-1", "a.png", "image/png", Buffer.from([1, 2, 3])),
    ).rejects.toThrow("insufficient permission");
  });
});
