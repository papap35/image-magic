import type { ImageProvider, ProviderDefinition } from "./types";
import { HuggingFaceImageProvider } from "./huggingface";
import { OpenAiImageProvider } from "./openai";

const providers: Record<string, ImageProvider> = {
  openai: new OpenAiImageProvider(),
  huggingface: new HuggingFaceImageProvider(),
};

export function getImageProvider(name: string): ImageProvider | null {
  return providers[name] ?? null;
}

/**
 * Static metadata describing every selectable image-generation provider,
 * for the UI/API to render options. Prompt enhancement via Claude is a
 * separate, provider-independent option — see `promptEnhancement.ts` — since
 * Claude has no image generation API of its own.
 */
export const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  { id: "openai", label: "OpenAI（自備 API Key）", authMode: "byok" },
  { id: "huggingface", label: "Hugging Face（自備 API Key）", authMode: "byok" },
];

export type { ImageProvider, GenerateImageParams, GenerateImageResult, ProviderDefinition } from "./types";
