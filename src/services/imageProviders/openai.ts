import type { GenerateImageParams, GenerateImageResult, ImageProvider } from "./types";

// gpt-image-1 is OpenAI's current image model and supports both generation
// and edits (img2img) under the same account access. dall-e-2/dall-e-3 are
// being phased out and may not exist for newer API keys/projects.
const DEFAULT_MODEL = "gpt-image-1";

function extractImageUrl(raw: { data?: Array<{ url?: string; b64_json?: string }> }): string | undefined {
  const entry = raw?.data?.[0];
  if (!entry) {
    return undefined;
  }
  if (entry.url) {
    return entry.url;
  }
  // gpt-image-1 always returns base64 (no hosted url), unlike dall-e-2/3.
  if (entry.b64_json) {
    return `data:image/png;base64,${entry.b64_json}`;
  }
  return undefined;
}

export class OpenAiImageProvider implements ImageProvider {
  readonly name = "openai";

  async generate(params: GenerateImageParams, credentials: Record<string, string>): Promise<GenerateImageResult> {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      throw new Error("Missing OpenAI API key");
    }

    if (params.referenceImage) {
      return this.generateFromReference(params, params.referenceImage, apiKey);
    }

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        prompt: params.prompt,
        size: params.size ?? "1024x1024",
        n: 1,
      }),
    });

    const raw = await response.json();
    if (!response.ok) {
      throw new Error(raw?.error?.message ?? `OpenAI image generation failed (${response.status})`);
    }

    const url = extractImageUrl(raw);
    if (!url) {
      throw new Error("OpenAI response did not include an image url");
    }

    return { url, raw };
  }

  private async generateFromReference(
    params: GenerateImageParams,
    referenceImage: { base64: string; mimeType: string },
    apiKey: string,
  ): Promise<GenerateImageResult> {
    const imageBytes = Buffer.from(referenceImage.base64, "base64");
    const form = new FormData();
    form.append("model", DEFAULT_MODEL);
    form.append("image", new Blob([imageBytes], { type: referenceImage.mimeType }), "reference.png");
    form.append("prompt", params.prompt);
    form.append("size", params.size ?? "1024x1024");
    form.append("n", "1");

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    const raw = await response.json();
    if (!response.ok) {
      throw new Error(raw?.error?.message ?? `OpenAI image edit failed (${response.status})`);
    }

    const url = extractImageUrl(raw);
    if (!url) {
      throw new Error("OpenAI response did not include an image url");
    }

    return { url, raw };
  }
}
