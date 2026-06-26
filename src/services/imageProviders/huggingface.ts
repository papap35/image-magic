import type { GenerateImageParams, GenerateImageResult, ImageProvider, ReferenceImage } from "./types";

// Hugging Face deprecated api-inference.huggingface.co in favor of the
// Inference Providers router; the hf-inference provider keeps the same
// request/response shape as the old serverless Inference API.
const INFERENCE_BASE_URL = "https://router.huggingface.co/hf-inference/models";

const DEFAULT_MODEL = "stabilityai/stable-diffusion-xl-base-1.0";
// instruct-pix2pix is an instruction-guided image-editing model — it takes a
// source image plus a text instruction, which matches the img2img contract
// (prompt steering an existing image) better than a generic SDXL img2img
// pipeline would.
const DEFAULT_IMG2IMG_MODEL = "timbrooks/instruct-pix2pix";

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

    const response = params.referenceImage
      ? await this.requestImg2Img(params.prompt, params.referenceImage, apiKey)
      : await this.requestTextToImage(params.prompt, apiKey);

    if (!response.ok) {
      const raw = await response.json().catch(() => null);
      throw new Error(raw?.error ?? `Hugging Face image generation failed (${response.status})`);
    }

    const contentType = response.headers.get("content-type") ?? "image/png";
    const bytes = Buffer.from(await response.arrayBuffer());
    const url = `data:${contentType};base64,${bytes.toString("base64")}`;

    return { url, raw: { contentType } };
  }

  private requestTextToImage(prompt: string, apiKey: string) {
    return fetch(`${INFERENCE_BASE_URL}/${DEFAULT_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt }),
    });
  }

  private requestImg2Img(prompt: string, referenceImage: ReferenceImage, apiKey: string) {
    return fetch(`${INFERENCE_BASE_URL}/${DEFAULT_IMG2IMG_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: `data:${referenceImage.mimeType};base64,${referenceImage.base64}`,
        parameters: { prompt },
      }),
    });
  }
}
