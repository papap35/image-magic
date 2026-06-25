import { describe, it, expect } from "vitest";
import { buildUserUpsertData } from "./auth";

describe("buildUserUpsertData", () => {
  it("正常情況：完整 profile 對應到 User 欄位", () => {
    const result = buildUserUpsertData({
      sub: "google-123",
      email: "test@example.com",
      name: "Test User",
      picture: "https://example.com/avatar.png",
    });
    expect(result).toEqual({
      googleId: "google-123",
      email: "test@example.com",
      name: "Test User",
      avatarUrl: "https://example.com/avatar.png",
    });
  });

  it("邊界情況：name 與 picture 缺失時回傳 null（不是 undefined）", () => {
    const result = buildUserUpsertData({
      sub: "google-456",
      email: "noname@example.com",
    });
    expect(result.name).toBeNull();
    expect(result.avatarUrl).toBeNull();
  });

  it("【防迴歸】picture 為 null 時不應拋出例外，應正規化為 null", () => {
    const result = buildUserUpsertData({
      sub: "google-789",
      email: "a@b.com",
      name: null,
      picture: null,
    });
    expect(result).toEqual({
      googleId: "google-789",
      email: "a@b.com",
      name: null,
      avatarUrl: null,
    });
  });
});
