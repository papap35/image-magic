import { describe, it, expect } from "vitest";
import { toUsageDateKey } from "./generationJob";

describe("toUsageDateKey", () => {
  it("正常情況：保留年月日，時間歸零（UTC）", () => {
    const result = toUsageDateKey(new Date("2026-06-25T15:42:10.123Z"));
    expect(result.toISOString()).toBe("2026-06-25T00:00:00.000Z");
  });

  it("邊界情況：跨日界線（UTC 23:59 不應進到下一天）", () => {
    const result = toUsageDateKey(new Date("2026-06-25T23:59:59.999Z"));
    expect(result.toISOString()).toBe("2026-06-25T00:00:00.000Z");
  });

  it("【防迴歸】同一天不同時間應產生相同的 key（用於 upsert 累計用量）", () => {
    const a = toUsageDateKey(new Date("2026-06-25T01:00:00.000Z"));
    const b = toUsageDateKey(new Date("2026-06-25T22:00:00.000Z"));
    expect(a.getTime()).toBe(b.getTime());
  });
});
