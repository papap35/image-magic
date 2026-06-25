import { timingSafeEqual } from "crypto";

/**
 * Constant-time comparison against the shared password gating Claude-based
 * prompt enhancement (which uses the site's own ANTHROPIC_API_KEY),
 * configured via PROMPT_ENHANCEMENT_PASSWORD. Returns false (never throws)
 * when the env var is unset or the input is missing/wrong length, so
 * callers can treat any falsy result as "denied".
 */
export function verifySharedProviderPassword(input: string | undefined | null): boolean {
  const expected = process.env.PROMPT_ENHANCEMENT_PASSWORD;
  if (!expected || !input) {
    return false;
  }
  const a = Buffer.from(input, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
