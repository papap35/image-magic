import type { GenerateImageParams, GenerateImageResult, ImageProvider } from "./types";

// gemini-2.5-flash-image ("Nano Banana") is Google's current image-output
// model, available on the Gemini API free tier (10 RPM / 250 RPD as of
// 2026-06). The previously used gemini-2.0-flash-preview-image-generation
// id has been retired and returns "is not found for API version v1beta, or
// is not supported for generateContent". It handles both text-to-image and
// image+text-to-image (img2img) through the same generateContent endpoint,
// unlike OpenAI/Hugging Face which split these into separate
// endpoints/models.
export const DEFAULT_MODEL = "gemini-2.5-flash-image";
export const MODEL_OPTIONS = ["gemini-2.5-flash-image"];
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Ids that used to be valid but Google has since retired. Users who saved
// one of these as their model override before it was retired would
// otherwise be stuck with a permanently broken provider until they noticed
// and manually changed it, so we fall back to DEFAULT_MODEL instead.
const RETIRED_MODELS = new Set(["gemini-2.0-flash-preview-image-generation"]);

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  error?: { message?: string };
}

function extractImage(raw: GeminiResponse): { mimeType: string; data: string } | undefined {
  const parts = raw.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData) {
      return part.inlineData;
    }
  }
  return undefined;
}

export class GeminiImageProvider implements ImageProvider {
  readonly name = "gemini";

  async generate(params: GenerateImageParams, credentials: Record<string, string>): Promise<GenerateImageResult> {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      throw new Error("Missing Gemini API key");
    }
    const requestedModel = credentials.model || DEFAULT_MODEL;
    const model = RETIRED_MODELS.has(requestedModel) ? DEFAULT_MODEL : requestedModel;

    const parts: GeminiPart[] = [{ text: params.prompt }];
    if (params.referenceImage) {
      parts.push({
        inlineData: { mimeType: params.referenceImage.mimeType, data: params.referenceImage.base64 },
      });
    }

    const response = await fetch(`${API_BASE_URL}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    });

    const raw: GeminiResponse = await response.json();
    if (!response.ok) {
      throw new Error(raw?.error?.message ?? `Gemini image generation failed (${response.status})`);
    }

    const image = extractImage(raw);
    if (!image) {
      throw new Error("Gemini response did not include an image");
    }

    return { url: `data:${image.mimeType};base64,${image.data}`, raw };
  }
}
