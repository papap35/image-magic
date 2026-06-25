export interface GenerateImageParams {
  prompt: string;
  size?: string;
}

export interface GenerateImageResult {
  url: string;
  raw: unknown;
}

export interface ImageProvider {
  readonly name: string;
  /** `credentials` keys depend on the provider — see each implementation. */
  generate(params: GenerateImageParams, credentials: Record<string, string>): Promise<GenerateImageResult>;
}

export type ProviderAuthMode = "shared-password" | "byok";

export interface ProviderDefinition {
  id: string;
  label: string;
  authMode: ProviderAuthMode;
}
