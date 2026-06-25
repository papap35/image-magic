import type { GenerateImageParams, GenerateImageResult, ImageProvider } from "./types";

export class OpenAiImageProvider implements ImageProvider {
  readonly name = "openai";

  async generate(params: GenerateImageParams, credentials: Record<string, string>): Promise<GenerateImageResult> {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      throw new Error("Missing OpenAI API key");
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
}
