import { describe, it, expect } from "vitest";
import { validateImageUpdateInput, normalizeClearableText } from "./image";

describe("validateImageUpdateInput", () => {
  it("正常情況：合理長度的 title/description 通過驗證", () => {
    expect(validateImageUpdateInput({ title: "我的圖", description: "一段描述" })).toEqual({ ok: true });
  });

  it("正常情況：空字串（清空欄位）視為合法", () => {
    expect(validateImageUpdateInput({ title: "", description: "" })).toEqual({ ok: true });
  });

  it("邊界情況：title 超過 200 字應回傳錯誤", () => {
    const result = validateImageUpdateInput({ title: "a".repeat(201) });
    expect(result.ok).toBe(false);
  });

  it("邊界情況：description 超過 2000 字應回傳錯誤", () => {
    const result = validateImageUpdateInput({ description: "a".repeat(2001) });
    expect(result.ok).toBe(false);
  });

  it("【防迴歸】未提供的欄位（undefined）不應觸發驗證錯誤", () => {
    expect(validateImageUpdateInput({})).toEqual({ ok: true });
  });
});

describe("normalizeClearableText", () => {
  it("正常情況：一般文字會被 trim", () => {
    expect(normalizeClearableText("  hello  ")).toBe("hello");
  });

  it("邊界情況：空白字串會被正規化為 null（清空欄位）", () => {
    expect(normalizeClearableText("   ")).toBe(null);
  });

  it("【防迴歸】undefined 應維持 undefined（代表未提供，不更動欄位）", () => {
    expect(normalizeClearableText(undefined)).toBe(undefined);
  });
});
