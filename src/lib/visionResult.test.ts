import { describe, it, expect } from "vitest";
import { parseVisionResponseText } from "./visionResult";

describe("parseVisionResponseText", () => {
  it("正常情況：純 JSON 字串可正確解析 caption 與 tags", () => {
    const result = parseVisionResponseText('{"caption": "一隻貓在沙發上", "tags": ["貓", "沙發"]}');
    expect(result).toEqual({ caption: "一隻貓在沙發上", tags: ["貓", "沙發"] });
  });

  it("正常情況：包裹在 markdown code fence 中的 JSON 也能解析", () => {
    const text = '這是結果：\n```json\n{"caption": "山景", "tags": ["山", "風景"]}\n```';
    expect(parseVisionResponseText(text)).toEqual({ caption: "山景", tags: ["山", "風景"] });
  });

  it("邊界情況：tags 不是陣列時應回傳空陣列而非拋錯", () => {
    expect(parseVisionResponseText('{"caption": "貓", "tags": "not-an-array"}')).toEqual({ caption: "貓", tags: [] });
  });

  it("邊界情況：tags 內含非字串元素時應過濾掉", () => {
    expect(parseVisionResponseText('{"caption": "貓", "tags": ["貓", 123, null, "  "]}')).toEqual({ caption: "貓", tags: ["貓"] });
  });

  it("【防迴歸】缺少 caption 應拋出錯誤", () => {
    expect(() => parseVisionResponseText('{"tags": ["貓"]}')).toThrow();
  });

  it("【防迴歸】完全沒有 JSON 內容應拋出錯誤", () => {
    expect(() => parseVisionResponseText("抱歉，我無法辨識這張圖片")).toThrow();
  });
});
