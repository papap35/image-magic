import { describe, it, expect } from "vitest";
import { buildMultipartUploadBody, buildGeneratedImageFileName } from "./driveUpload";

describe("buildMultipartUploadBody", () => {
  it("正常情況：body 包含 JSON metadata 與原始檔案位元組", () => {
    const fileBytes = Buffer.from([1, 2, 3, 4]);
    const { contentType, body } = buildMultipartUploadBody({ name: "a.png", parents: ["folder1"] }, fileBytes, "image/png");

    expect(contentType).toContain("multipart/related; boundary=");
    expect(body.toString("latin1")).toContain(JSON.stringify({ name: "a.png", parents: ["folder1"] }));
    expect(body.includes(fileBytes)).toBe(true);
  });

  it("邊界情況：空檔案位元組仍能組出合法 body（含 metadata 與收尾 boundary）", () => {
    const { body } = buildMultipartUploadBody({ name: "empty.png" }, Buffer.alloc(0), "image/png");
    const text = body.toString("latin1");
    expect(text).toContain("Content-Type: application/json");
    expect(text.trim().endsWith("--")).toBe(true);
  });
});

describe("buildGeneratedImageFileName", () => {
  it("正常情況：產生包含時間戳與 jobId 的檔名", () => {
    const name = buildGeneratedImageFileName("job123", new Date("2026-06-25T10:20:00.000Z"));
    expect(name).toBe("2026-06-25T10-20-00-000Z_job123.png");
  });

  it("【防迴歸】不同副檔名應正確反映在檔名結尾", () => {
    const name = buildGeneratedImageFileName("job123", new Date("2026-06-25T10:20:00.000Z"), "jpg");
    expect(name.endsWith(".jpg")).toBe(true);
  });
});
