import { describe, it, expect } from "vitest";
import { describeError } from "./errors";

describe("describeError", () => {
  it("正常情況：沒有 cause 時，直接回傳 error message", () => {
    expect(describeError(new Error("Billing hard limit has been reached."))).toBe(
      "Billing hard limit has been reached.",
    );
  });

  it("正常情況：有 cause 且帶 code 時，把 cause message 與 code 一起附加上去", () => {
    const cause = Object.assign(new Error("getaddrinfo ENOTFOUND api-inference.huggingface.co"), {
      code: "ENOTFOUND",
    });
    const err = new Error("fetch failed", { cause });
    expect(describeError(err)).toBe(
      "fetch failed: getaddrinfo ENOTFOUND api-inference.huggingface.co (ENOTFOUND)",
    );
  });

  it("正常情況：cause 不是 Error 時，轉成字串附加上去", () => {
    const err = new Error("fetch failed", { cause: "timeout" });
    expect(describeError(err)).toBe("fetch failed: timeout");
  });

  it("邊界情況：err 不是 Error 時，回傳 Unknown error", () => {
    expect(describeError("oops")).toBe("Unknown error");
  });
});
