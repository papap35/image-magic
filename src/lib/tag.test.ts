import { describe, it, expect } from "vitest";
import { validateTagName } from "./tag";

describe("validateTagName", () => {
  it("正常情況：一般名稱通過驗證並回傳 trim 後的結果", () => {
    expect(validateTagName("  風景  ")).toEqual({ ok: true, name: "風景" });
  });

  it("邊界情況：空字串應回傳錯誤", () => {
    expect(validateTagName("   ").ok).toBe(false);
  });

  it("邊界情況：非字串輸入應回傳錯誤", () => {
    expect(validateTagName(undefined).ok).toBe(false);
  });

  it("邊界情況：超過 50 字應回傳錯誤", () => {
    expect(validateTagName("a".repeat(51)).ok).toBe(false);
  });

  it("【防迴歸】剛好 50 字應通過驗證", () => {
    expect(validateTagName("a".repeat(50)).ok).toBe(true);
  });
});
