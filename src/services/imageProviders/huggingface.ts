import type { GenerateImageParams, GenerateImageResult, ImageProvider } from "./types";

const DEFAULT_MODEL = "stabilityai/stable-diffusion-xl-base-1.0";

/**
 * Hugging Face's Inference API returns the generated image bytes directly
 * (no hosted URL), unlike OpenAI which returns a temporary URL. We base64
 * encode the bytes into a data: URL so callers can treat both providers
 * uniformly as "{ url }" — the data URL is downloaded the same way a real
 * URL would be when uploading to the user's Drive.
 */
export class HuggingFaceImageProvider implements ImageProvider {
  readonly name = "huggingface";

  async generate(params: GenerateImageParams, credentials: Record<string, string>): Promise<GenerateImageResult> {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      throw new Error("Missing Hugging Face API key");
    }

    const response = await fetch(`https://api-inference.huggingface.co/models/${DEFAULT_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: params.prompt }),
    });

    if (!response.ok) {
      const raw = await response.json().catch(() => null);
      throw new Error(raw?.error ?? `Hugging Face image generation failed (${response.status})`);
    }

    const contentType = response.headers.get("content-type") ?? "image/png";
    const bytes = Buffer.from(await response.arrayBuffer());
    const url = `data:${contentType};base64,${bytes.toString("base64")}`;

    return { url, raw: { contentType } };
  }
}
