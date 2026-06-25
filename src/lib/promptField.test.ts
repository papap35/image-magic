import { describe, it, expect } from "vitest";
import { validatePromptFieldInput } from "./promptField";

describe("validatePromptFieldInput", () => {
  it("正常情況：key 與 value 都有值時通過驗證", () => {
    const result = validatePromptFieldInput({ key: "主體", value: "貓" });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("邊界情況：key 為空字串時驗證失敗", () => {
    const result = validatePromptFieldInput({ key: "  ", value: "貓" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("key is required");
  });

  it("錯誤情況：兩個欄位都缺失時回傳兩個錯誤", () => {
    const result = validatePromptFieldInput({});
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(["key is required", "value is required"]);
  });

  it("【防迴歸】value 為純空白字串時應視為缺失，不能通過驗證", () => {
    const result = validatePromptFieldInput({ key: "背景", value: "   " });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("value is required");
  });
});
