import { verifySharedProviderPassword } from "@/lib/providerPassword";
import { PROVIDER_DEFINITIONS } from "@/services/imageProviders";
import { getUserProviderKey } from "@/services/providerKeys";

export interface CredentialError {
  ok: false;
  status: number;
  code: string;
  message: string;
}

export interface CredentialSuccess {
  ok: true;
  credentials: Record<string, string>;
}

/**
 * Resolve the secrets a provider needs to run, based on its auth mode:
 * - shared-password providers (e.g. "claude") use the site's own keys from
 *   env vars, gated by a shared password the caller must supply.
 * - BYOK providers (e.g. "openai") use the calling user's own saved key.
 */
export async function resolveProviderCredentials(
  userId: string,
  provider: string,
  input: { password?: string },
): Promise<CredentialSuccess | CredentialError> {
  const definition = PROVIDER_DEFINITIONS.find((def) => def.id === provider);
  if (!definition) {
    return { ok: false, status: 400, code: "unknown_provider", message: `Unknown provider: ${provider}` };
  }

  if (definition.authMode === "shared-password") {
    if (!verifySharedProviderPassword(input.password)) {
      return { ok: false, status: 401, code: "invalid_password", message: "Incorrect or missing provider password" };
    }
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const imageApiKey = process.env.AI_IMAGE_PROVIDER_API_KEY;
    if (!anthropicApiKey || !imageApiKey) {
      return { ok: false, status: 500, code: "provider_not_configured", message: "Default provider is not configured" };
    }
    return { ok: true, credentials: { anthropicApiKey, imageApiKey } };
  }

  // BYOK
  const apiKey = await getUserProviderKey(userId, provider);
  if (!apiKey) {
    return {
      ok: false,
      status: 400,
      code: "missing_api_key",
      message: `No saved API key for provider "${provider}" — save one via /api/provider-keys first`,
    };
  }
  return { ok: true, credentials: { apiKey } };
}
