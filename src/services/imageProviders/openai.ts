import type { GenerateImageParams, GenerateImageResult, ImageProvider } from "./types";

// gpt-image-2 is OpenAI's current flagship image model (released 2026-04,
// best prompt adherence/photorealism). gpt-image-1.5 and gpt-image-1-mini are
// still-supported predecessors; gpt-image-1 is scheduled for deprecation on
// 2026-10-23. All four support both /images/generations and /images/edits
// (img2img) under the same account access. dall-e-2/dall-e-3 were fully
// removed from the API on 2026-05-12 and are deliberately not listed here —
// they would just 404.
export const DEFAULT_MODEL = "gpt-image-2";
export const MODEL_OPTIONS = ["gpt-image-2", "gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini"];

function extractImageUrl(raw: { data?: Array<{ url?: string; b64_json?: string }> }): string | undefined {
  const entry = raw?.data?.[0];
  if (!entry) {
    return undefined;
  }
  if (entry.url) {
    return entry.url;
  }
  // gpt-image-* models always return base64 (no hosted url), unlike the
  // now-retired dall-e-2/3.
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

    const model = credentials.model || DEFAULT_MODEL;

    if (params.referenceImage) {
      return this.generateFromReference(params, params.referenceImage, apiKey, model);
    }

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
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
    model: string,
  ): Promise<GenerateImageResult> {
    const imageBytes = Buffer.from(referenceImage.base64, "base64");
    const form = new FormData();
    form.append("model", model);
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
