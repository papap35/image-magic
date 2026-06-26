import type { GenerateImageParams, GenerateImageResult, ImageProvider } from "./types";

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
        prompt: params.prompt,
        size: params.size ?? "1024x1024",
        n: 1,
      }),
    });

    const raw = await response.json();
    if (!response.ok) {
      throw new Error(raw?.error?.message ?? `OpenAI image generation failed (${response.status})`);
    }

    const url = raw?.data?.[0]?.url;
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

    const url = raw?.data?.[0]?.url;
    if (!url) {
      throw new Error("OpenAI response did not include an image url");
    }

    return { url, raw };
  }
}
