import { describe, it, expect, beforeEach } from "vitest";
import { encryptToken, decryptToken } from "./tokenCrypto";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

describe("encryptToken / decryptToken", () => {
  beforeEach(() => {
    process.env.DRIVE_TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  it("正常情況：加密後可解密回原始字串", () => {
    const plaintext = "1//09abcDEFghijk-refresh-token";
    const encrypted = encryptToken(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it("正常情況：每次加密產生不同 ciphertext（隨機 iv）", () => {
    const plaintext = "same-token";
    const first = encryptToken(plaintext);
    const second = encryptToken(plaintext);
    expect(first).not.toBe(second);
    expect(decryptToken(first)).toBe(plaintext);
    expect(decryptToken(second)).toBe(plaintext);
  });

  it("邊界情況：缺少 DRIVE_TOKEN_ENCRYPTION_KEY 時拋出例外", () => {
    delete process.env.DRIVE_TOKEN_ENCRYPTION_KEY;
    expect(() => encryptToken("x")).toThrow();
  });

  it("邊界情況：密鑰長度不是 32 bytes 時拋出例外", () => {
    process.env.DRIVE_TOKEN_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    expect(() => encryptToken("x")).toThrow();
  });

  it("邊界情況：格式錯誤的加密字串解密時拋出例外", () => {
    expect(() => decryptToken("not-a-valid-format")).toThrow();
  });

  it("邊界情況：被竄改的 ciphertext 解密時拋出例外（auth tag 驗證失敗）", () => {
    const encrypted = encryptToken("token");
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const tampered = [iv, authTag, Buffer.from("tampered").toString("base64")].join(":");
    void ciphertext;
    expect(() => decryptToken(tampered)).toThrow();
  });
});
