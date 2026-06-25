import type { ImageProvider, ProviderDefinition } from "./types";
import { ClaudeAssistedImageProvider } from "./claude";
import { OpenAiImageProvider } from "./openai";

const providers: Record<string, ImageProvider> = {
  claude: new ClaudeAssistedImageProvider(),
  openai: new OpenAiImageProvider(),
};

export function getImageProvider(name: string): ImageProvider | null {
  return providers[name] ?? null;
}

/** Static metadata describing every selectable provider, for the UI/API to render options. */
export const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  { id: "claude", label: "Claude（站方提供，需輸入共用密碼）", authMode: "shared-password" },
  { id: "openai", label: "OpenAI（自備 API Key）", authMode: "byok" },
];

export type { ImageProvider, GenerateImageParams, GenerateImageResult, ProviderDefinition } from "./types";
