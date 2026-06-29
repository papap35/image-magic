import { PROVIDER_DEFINITIONS } from "@/services/imageProviders";
import { getUserProviderKey, getUserProviderModel } from "@/services/providerKeys";

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

/** Resolve the API key a BYOK image-generation provider needs, from the user's saved key. */
export async function resolveProviderCredentials(
  userId: string,
  provider: string,
): Promise<CredentialSuccess | CredentialError> {
  const definition = PROVIDER_DEFINITIONS.find((def) => def.id === provider);
  if (!definition) {
    return { ok: false, status: 400, code: "unknown_provider", message: `Unknown provider: ${provider}` };
  }

  const apiKey = await getUserProviderKey(userId, provider);
  if (!apiKey) {
    return {
      ok: false,
      status: 400,
      code: "missing_api_key",
      message: `No saved API key for provider "${provider}" — save one via /api/provider-keys first`,
    };
  }
  const model = await getUserProviderModel(userId, provider);
  return { ok: true, credentials: model ? { apiKey, model } : { apiKey } };
}
