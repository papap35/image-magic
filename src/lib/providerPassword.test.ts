import { afterEach, describe, expect, it, vi } from "vitest";
import { verifySharedProviderPassword } from "./providerPassword";

describe("verifySharedProviderPassword", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("正常情況：密碼正確時通過", () => {
    vi.stubEnv("PROMPT_ENHANCEMENT_PASSWORD", "secret123");
    expect(verifySharedProviderPassword("secret123")).toBe(true);
  });

  it("邊界情況：密碼錯誤時拒絕", () => {
    vi.stubEnv("PROMPT_ENHANCEMENT_PASSWORD", "secret123");
    expect(verifySharedProviderPassword("wrong")).toBe(false);
  });

  it("邊界情況：未設定環境變數時一律拒絕", () => {
    vi.stubEnv("PROMPT_ENHANCEMENT_PASSWORD", "");
    expect(verifySharedProviderPassword("anything")).toBe(false);
  });

  it("【防迴歸】未提供輸入時不拋例外，回傳 false", () => {
    vi.stubEnv("PROMPT_ENHANCEMENT_PASSWORD", "secret123");
    expect(verifySharedProviderPassword(undefined)).toBe(false);
    expect(verifySharedProviderPassword(null)).toBe(false);
  });
});
