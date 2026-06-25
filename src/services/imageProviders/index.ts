import type { ImageProvider } from "./types";
import { OpenAiImageProvider } from "./openai";

const providers: Record<string, ImageProvider> = {
  openai: new OpenAiImageProvider(),
};

export function getImageProvider(name: string): ImageProvider | null {
  return providers[name] ?? null;
}

export type { ImageProvider, GenerateImageParams, GenerateImageResult } from "./types";
