import { describe, it, expect } from "vitest";
import { validateStylePresetInput } from "./stylePreset";

describe("validateStylePresetInput", () => {
  it("正常情況：name 與 basePrompt 都有值時通過驗證", () => {
    const result = validateStylePresetInput({ name: "日系插畫", basePrompt: "anime style" });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("邊界情況：name 為空字串時驗證失敗", () => {
    const result = validateStylePresetInput({ name: "  ", basePrompt: "anime style" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("name is required");
  });

  it("錯誤情況：兩個欄位都缺失時回傳兩個錯誤", () => {
    const result = validateStylePresetInput({});
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(["name is required", "basePrompt is required"]);
  });

  it("【防迴歸】basePrompt 為純空白字串時應視為缺失，不能通過驗證", () => {
    const result = validateStylePresetInput({ name: "風格", basePrompt: "   " });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("basePrompt is required");
  });
});
