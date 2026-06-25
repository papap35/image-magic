import { verifySharedProviderPassword } from "@/lib/providerPassword";

export interface PromptEnhancementError {
  ok: false;
  status: number;
  code: string;
  message: string;
}

export interface PromptEnhancementDisabled {
  ok: true;
  anthropicApiKey: null;
}

export interface PromptEnhancementEnabled {
  ok: true;
  anthropicApiKey: string;
}

/**
 * When the caller opts in to Claude-based prompt enhancement, verify the
 * shared password and return the site's own Anthropic key to use. Returns
 * `{ ok: true, anthropicApiKey: null }` when enhancement wasn't requested,
 * so callers can treat it uniformly as "skip enhancement" without a branch.
 */
export function resolvePromptEnhancementAuth(
  enabled: boolean,
  password: string | undefined,
): PromptEnhancementDisabled | PromptEnhancementEnabled | PromptEnhancementError {
  if (!enabled) {
    return { ok: true, anthropicApiKey: null };
  }

  if (!verifySharedProviderPassword(password)) {
    return { ok: false, status: 401, code: "invalid_password", message: "Incorrect or missing enhancement password" };
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return { ok: false, status: 500, code: "enhancement_not_configured", message: "Prompt enhancement is not configured" };
  }

  return { ok: true, anthropicApiKey };
}
