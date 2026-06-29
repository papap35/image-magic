import type { GenerateImageParams, GenerateImageResult, ImageProvider } from "./types";

// gemini-2.0-flash-preview-image-generation is Google's image-output-capable
// Gemini model, available on the Gemini API free tier. It handles both
// text-to-image and image+text-to-image (img2img) through the same
// generateContent endpoint, unlike OpenAI/Hugging Face which split these
// into separate endpoints/models.
const DEFAULT_MODEL = "gemini-2.0-flash-preview-image-generation";
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

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

    const parts: GeminiPart[] = [{ text: params.prompt }];
    if (params.referenceImage) {
      parts.push({
        inlineData: { mimeType: params.referenceImage.mimeType, data: params.referenceImage.base64 },
      });
    }

    const response = await fetch(`${API_BASE_URL}/${DEFAULT_MODEL}:generateContent`, {
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
