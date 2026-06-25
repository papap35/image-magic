import { describe, it, expect } from "vitest";
import { buildEmbeddingInputText, toPgVectorLiteral } from "./embedding";

describe("buildEmbeddingInputText", () => {
  it("正常情況：合併 title/description/aiCaption", () => {
    expect(buildEmbeddingInputText({ title: "夕陽", description: "海邊", aiCaption: "一張海邊夕陽照片" })).toBe(
      "夕陽 海邊 一張海邊夕陽照片",
    );
  });

  it("邊界情況：缺少部分欄位時忽略 null/undefined", () => {
    expect(buildEmbeddingInputText({ title: "夕陽", description: null, aiCaption: undefined })).toBe("夕陽");
  });

  it("邊界情況：所有欄位皆空時回傳空字串", () => {
    expect(buildEmbeddingInputText({ title: null, description: null, aiCaption: null })).toBe("");
  });

  it("邊界情況：空白字串欄位視為無內容", () => {
    expect(buildEmbeddingInputText({ title: "   ", description: "海邊" })).toBe("海邊");
  });
});

describe("toPgVectorLiteral", () => {
  it("正常情況：數字陣列轉成 pgvector literal 字串", () => {
    expect(toPgVectorLiteral([0.1, 0.2, 0.3])).toBe("[0.1,0.2,0.3]");
  });

  it("邊界情況：空陣列回傳空向量字串", () => {
    expect(toPgVectorLiteral([])).toBe("[]");
  });
});
