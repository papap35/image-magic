import type { GenerateImageParams, GenerateImageResult, ImageProvider } from "./types";

// fal.ai hosts Black Forest Labs' FLUX models, which rank highly for
// photorealism/prompt adherence but aren't available through Hugging Face's
// hf-inference router (FLUX is only served via fal's own API there). fal.run
// is the synchronous endpoint — it blocks until the image is ready instead
// of requiring a submit/poll/fetch queue dance, which matches the
// request/response style the other providers in this app already use.
const SYNC_BASE_URL = "https://fal.run";

export const DEFAULT_MODEL = "fal-ai/flux/dev";
export const MODEL_OPTIONS = ["fal-ai/flux/dev", "fal-ai/flux/schnell", "fal-ai/flux-pro/v1.1-ultra"];
// FLUX's image-to-image variant is a different model path than its
// text-to-image one (same convention as Hugging Face's separate img2img
// model in this app) — kept fixed rather than user-overridable since there's
// only one good FLUX img2img option per base model tier.
const IMG2IMG_MODEL = "fal-ai/flux/dev/image-to-image";

interface FalImage {
  url?: string;
  content_type?: string;
}

interface FalResponse {
  images?: FalImage[];
  detail?: string;
  error?: string;
}

export class FalImageProvider implements ImageProvider {
  readonly name = "fal";

  async generate(params: GenerateImageParams, credentials: Record<string, string>): Promise<GenerateImageResult> {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      throw new Error("Missing fal.ai API key");
    }
    const model = credentials.model || DEFAULT_MODEL;

    const response = params.referenceImage
      ? await this.requestImageToImage(params, apiKey)
      : await this.requestTextToImage(params, apiKey, model);

    const raw: FalResponse = await response.json();
    if (!response.ok) {
      throw new Error(raw?.detail ?? raw?.error ?? `fal.ai image generation failed (${response.status})`);
    }

    const url = raw.images?.[0]?.url;
    if (!url) {
      throw new Error("fal.ai response did not include an image url");
    }

    return { url, raw };
  }

  private requestTextToImage(params: GenerateImageParams, apiKey: string, model: string) {
    return fetch(`${SYNC_BASE_URL}/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: params.prompt }),
    });
  }

  private requestImageToImage(params: GenerateImageParams, apiKey: string) {
    const referenceImage = params.referenceImage!;
    return fetch(`${SYNC_BASE_URL}/${IMG2IMG_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: params.prompt,
        image_url: `data:${referenceImage.mimeType};base64,${referenceImage.base64}`,
      }),
    });
  }
}
