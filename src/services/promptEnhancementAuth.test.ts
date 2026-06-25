import { afterEach, describe, expect, it, vi } from "vitest";
import { resolvePromptEnhancementAuth } from "./promptEnhancementAuth";

describe("resolvePromptEnhancementAuth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("正常情況：未啟用改寫時直接放行，不需要密碼", () => {
    const result = resolvePromptEnhancementAuth(false, undefined);
    expect(result).toEqual({ ok: true, anthropicApiKey: null });
  });

  it("正常情況：啟用且密碼正確時回傳站方的 Anthropic key", () => {
    vi.stubEnv("PROMPT_ENHANCEMENT_PASSWORD", "secret123");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const result = resolvePromptEnhancementAuth(true, "secret123");
    expect(result).toEqual({ ok: true, anthropicApiKey: "sk-ant-test" });
  });

  it("邊界情況：啟用但密碼錯誤時拒絕並回傳 401", () => {
    vi.stubEnv("PROMPT_ENHANCEMENT_PASSWORD", "secret123");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const result = resolvePromptEnhancementAuth(true, "wrong");
    expect(result).toEqual({
      ok: false,
      status: 401,
      code: "invalid_password",
      message: "Incorrect or missing enhancement password",
    });
  });

  it("【防迴歸】密碼正確但站方未設定 ANTHROPIC_API_KEY 時回傳 500", () => {
    vi.stubEnv("PROMPT_ENHANCEMENT_PASSWORD", "secret123");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const result = resolvePromptEnhancementAuth(true, "secret123");
    expect(result).toEqual({
      ok: false,
      status: 500,
      code: "enhancement_not_configured",
      message: "Prompt enhancement is not configured",
    });
  });
});
