export interface ReferenceImage {
  /** Base64-encoded image bytes, no data: URL prefix. */
  base64: string;
  mimeType: string;
}

export interface GenerateImageParams {
  prompt: string;
  size?: string;
  /** When present, generation is guided by this image (img2img) instead of pure text-to-image. */
  referenceImage?: ReferenceImage;
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
