import { describe, it, expect } from "vitest";
import { checkRateLimit, type RateLimitEntry } from "./rateLimit";

describe("checkRateLimit", () => {
  it("正常情況：限制內的請求允許通過並累計次數", () => {
    const store = new Map<string, RateLimitEntry>();
    expect(checkRateLimit(store, "a", 3, 1000, 0).allowed).toBe(true);
    expect(checkRateLimit(store, "a", 3, 1000, 100).allowed).toBe(true);
    expect(checkRateLimit(store, "a", 3, 1000, 200).allowed).toBe(true);
  });

  it("邊界情況：超過限制次數的請求被拒絕", () => {
    const store = new Map<string, RateLimitEntry>();
    checkRateLimit(store, "a", 2, 1000, 0);
    checkRateLimit(store, "a", 2, 1000, 100);
    const result = checkRateLimit(store, "a", 2, 1000, 200);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(800);
  });

  it("邊界情況：超過時間窗口後重新計數", () => {
    const store = new Map<string, RateLimitEntry>();
    checkRateLimit(store, "a", 1, 1000, 0);
    const blocked = checkRateLimit(store, "a", 1, 1000, 500);
    expect(blocked.allowed).toBe(false);
    const afterWindow = checkRateLimit(store, "a", 1, 1000, 1000);
    expect(afterWindow.allowed).toBe(true);
  });

  it("【防迴歸】不同 key 的計數互不影響", () => {
    const store = new Map<string, RateLimitEntry>();
    checkRateLimit(store, "a", 1, 1000, 0);
    const otherKey = checkRateLimit(store, "b", 1, 1000, 0);
    expect(otherKey.allowed).toBe(true);
  });
});
