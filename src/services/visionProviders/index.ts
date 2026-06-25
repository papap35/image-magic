import { OpenAiVisionProvider } from "./openai";
import type { VisionProvider } from "./types";

const registry: Record<string, VisionProvider> = {
  "openai-vision": new OpenAiVisionProvider(),
};

export function getVisionProvider(name: string): VisionProvider | null {
  return registry[name] ?? null;
}

export type { RecognizeImageParams, RecognizeImageResult, VisionProvider } from "./types";
