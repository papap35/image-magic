import { describe, it, expect } from "vitest";
import { buildGeneratedImageFileName } from "./driveUpload";

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
