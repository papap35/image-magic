import type { ImageProvider, ProviderDefinition } from "./types";
import { HuggingFaceImageProvider, DEFAULT_MODEL as HF_DEFAULT_MODEL, MODEL_OPTIONS as HF_MODEL_OPTIONS } from "./huggingface";
import { OpenAiImageProvider, DEFAULT_MODEL as OPENAI_DEFAULT_MODEL, MODEL_OPTIONS as OPENAI_MODEL_OPTIONS } from "./openai";
import { GeminiImageProvider, DEFAULT_MODEL as GEMINI_DEFAULT_MODEL, MODEL_OPTIONS as GEMINI_MODEL_OPTIONS } from "./gemini";
import { FalImageProvider, DEFAULT_MODEL as FAL_DEFAULT_MODEL, MODEL_OPTIONS as FAL_MODEL_OPTIONS } from "./fal";

const providers: Record<string, ImageProvider> = {
  openai: new OpenAiImageProvider(),
  huggingface: new HuggingFaceImageProvider(),
  gemini: new GeminiImageProvider(),
  fal: new FalImageProvider(),
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
  {
    id: "openai",
    label: "OpenAI（自備 API Key）",
    authMode: "byok",
    defaultModel: OPENAI_DEFAULT_MODEL,
    modelOptions: OPENAI_MODEL_OPTIONS,
  },
  {
    id: "huggingface",
    label: "Hugging Face（自備 API Key）",
    authMode: "byok",
    defaultModel: HF_DEFAULT_MODEL,
    modelOptions: HF_MODEL_OPTIONS,
  },
  {
    id: "gemini",
    label: "Google Gemini（自備 API Key）",
    authMode: "byok",
    defaultModel: GEMINI_DEFAULT_MODEL,
    modelOptions: GEMINI_MODEL_OPTIONS,
  },
  {
    id: "fal",
    label: "fal.ai（FLUX，自備 API Key）",
    authMode: "byok",
    defaultModel: FAL_DEFAULT_MODEL,
    modelOptions: FAL_MODEL_OPTIONS,
  },
];

export type { ImageProvider, GenerateImageParams, GenerateImageResult, ProviderDefinition } from "./types";
