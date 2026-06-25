import { describe, it, expect } from "vitest";
import { buildFinalPrompt } from "./prompt";

describe("buildFinalPrompt", () => {
  it("正常情況：basePrompt + fields 依序串接", () => {
    const result = buildFinalPrompt("日系插畫風格", [
      { key: "主體", value: "貓" },
      { key: "背景", value: "夜景" },
    ]);
    expect(result).toBe("日系插畫風格, 主體: 貓, 背景: 夜景");
  });

  it("邊界情況：fields 為空陣列時只回傳 basePrompt", () => {
    expect(buildFinalPrompt("日系插畫風格", [])).toBe("日系插畫風格");
  });

  it("邊界情況：忽略 key 或 value 為空字串的欄位", () => {
    const result = buildFinalPrompt("風格", [
      { key: "", value: "貓" },
      { key: "背景", value: "" },
      { key: "光線", value: "霓虹" },
    ]);
    expect(result).toBe("風格, 光線: 霓虹");
  });

  it("錯誤情況：basePrompt 為空字串，僅回傳 fields", () => {
    const result = buildFinalPrompt("", [{ key: "主體", value: "貓" }]);
    expect(result).toBe("主體: 貓");
  });

  it("【防迴歸】basePrompt 與 fields 前後空白應被 trim，避免多餘逗號", () => {
    const result = buildFinalPrompt("  風格  ", [{ key: " 主體 ", value: " 貓 " }]);
    expect(result).toBe("風格, 主體: 貓");
  });
});
