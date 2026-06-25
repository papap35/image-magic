import { describe, it, expect } from "vitest";
import { validateSearchQuery } from "./search";

describe("validateSearchQuery", () => {
  it("正常情況：一般關鍵字通過驗證並回傳 trim 後的結果", () => {
    expect(validateSearchQuery("  夕陽 海邊  ")).toEqual({ ok: true, query: "夕陽 海邊" });
  });

  it("邊界情況：空字串應回傳錯誤", () => {
    expect(validateSearchQuery("   ").ok).toBe(false);
  });

  it("邊界情況：未提供（undefined）應回傳錯誤", () => {
    expect(validateSearchQuery(undefined).ok).toBe(false);
  });

  it("邊界情況：超過 200 字應回傳錯誤", () => {
    expect(validateSearchQuery("a".repeat(201)).ok).toBe(false);
  });

  it("【防迴歸】剛好 200 字應通過驗證", () => {
    expect(validateSearchQuery("a".repeat(200)).ok).toBe(true);
  });
});
