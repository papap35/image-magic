import { describe, it, expect, vi, afterEach } from "vitest";
import { uploadImageToDrive } from "./googleDrive";

describe("uploadImageToDrive", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("正常情況：先建立檔案再上傳內容，成功時回傳 fileId 與 viewUrl", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: "file-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: "file-1", webViewLink: "https://drive.google.com/file/d/file-1/view" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadImageToDrive("token", "folder-1", "a.png", "image/png", Buffer.from([1, 2, 3]));

    expect(result).toEqual({ fileId: "file-1", viewUrl: "https://drive.google.com/file/d/file-1/view" });
    const [createUrl, createOptions] = fetchMock.mock.calls[0];
    expect(createUrl).toBe("https://www.googleapis.com/drive/v3/files?fields=id");
    expect(JSON.parse(createOptions.body)).toEqual({ name: "a.png", parents: ["folder-1"] });
    const [uploadUrl, uploadOptions] = fetchMock.mock.calls[1];
    expect(uploadUrl).toBe("https://www.googleapis.com/upload/drive/v3/files/file-1?uploadType=media&fields=id,webViewLink");
    expect(uploadOptions.method).toBe("PATCH");
    expect(uploadOptions.headers["Content-Type"]).toBe("image/png");
  });

  it("異常情況：建立檔案的回應不是 JSON 時，拋出可讀的錯誤訊息而不是 JSON.parse 例外", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "Malformed request",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadImageToDrive("token", "folder-1", "a.png", "image/png", Buffer.from([1, 2, 3])),
    ).rejects.toThrow("Malformed request");
  });

  it("異常情況：上傳內容的回應為 JSON 錯誤時，使用 error.message 拋出例外", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: "file-1" }),
      })
      .mockResolvedValueOnce({
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
