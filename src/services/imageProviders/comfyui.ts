import type { GenerateImageParams, GenerateImageResult, ImageProvider } from "./types";

// ComfyUI runs locally (or on the user's own server/LAN), not as a hosted
// cloud API — there's no "API key" concept, so the BYOK key field is
// repurposed to hold the ComfyUI server's base URL (e.g.
// "http://192.168.1.50:8188"). The app server must be able to reach that URL
// over the network; if Image Magic itself is deployed remotely, the user's
// ComfyUI instance needs to be exposed (LAN access, VPN, or a tunnel).
export const DEFAULT_MODEL = "sd_xl_base_1.0.safetensors";
// These are just common checkpoint filenames to seed the dropdown — the
// value must exactly match a file already present in the user's ComfyUI
// `models/checkpoints` folder (use the custom-model field for anything else,
// e.g. a FLUX checkpoint).
export const MODEL_OPTIONS = ["sd_xl_base_1.0.safetensors", "flux1-dev.safetensors", "sd_xl_turbo_1.0.safetensors"];

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 60;

interface ComfyHistoryOutputImage {
  filename: string;
  subfolder: string;
  type: string;
}

interface ComfyHistoryEntry {
  outputs?: Record<string, { images?: ComfyHistoryOutputImage[] }>;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

// ComfyUI's own error responses are JSON, but a reverse proxy/gateway in
// front of it (or ComfyUI's request-size limit) can return a plain-text or
// HTML body instead (e.g. "Request Entity Too Large"). Parsing that as JSON
// throws a confusing "Unexpected token" SyntaxError, so read the body as text
// first and only parse it as JSON if it looks like JSON.
async function parseJsonResponse(response: Response): Promise<Record<string, unknown> | undefined> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`ComfyUI 回應非預期格式 (${response.status})：${text.slice(0, 200)}`);
  }
}

function buildTxt2ImgWorkflow(prompt: string, model: string, seed: number) {
  return {
    "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: model } },
    "5": { class_type: "EmptyLatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } },
    "6": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["4", 1] } },
    "7": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["4", 1] } },
    "3": {
      class_type: "KSampler",
      inputs: {
        seed,
        steps: 20,
        cfg: 8,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
    },
    "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
    "9": { class_type: "SaveImage", inputs: { filename_prefix: "ImageMagic", images: ["8", 0] } },
  };
}

// FLUX checkpoints aren't all-in-one .safetensors files loadable via
// CheckpointLoaderSimple — they ship as a separate UNET, a dual text encoder
// (T5 + CLIP-L), and a VAE, so they need a different node graph. We detect
// FLUX by filename convention (e.g. "flux1-dev.safetensors") since ComfyUI's
// /prompt API has no generic way to ask "what kind of checkpoint is this".
function isFluxModel(model: string): boolean {
  return /flux/i.test(model);
}

// Common filenames from the official FLUX.1 release (black-forest-labs);
// like DEFAULT_MODEL, these must exactly match files already present in the
// user's ComfyUI models folder (clip/, vae/) or the workflow submission will
// fail with a "node not found" style error from ComfyUI.
const FLUX_CLIP_NAME_1 = "t5xxl_fp16.safetensors";
const FLUX_CLIP_NAME_2 = "clip_l.safetensors";
const FLUX_VAE_NAME = "ae.safetensors";
const FLUX_GUIDANCE = 3.5;

function buildFluxTxt2ImgWorkflow(prompt: string, model: string, seed: number) {
  return {
    "12": { class_type: "UNETLoader", inputs: { unet_name: model, weight_dtype: "default" } },
    "11": { class_type: "DualCLIPLoader", inputs: { clip_name1: FLUX_CLIP_NAME_1, clip_name2: FLUX_CLIP_NAME_2, type: "flux" } },
    "10": { class_type: "VAELoader", inputs: { vae_name: FLUX_VAE_NAME } },
    "6": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["11", 0] } },
    "26": { class_type: "FluxGuidance", inputs: { conditioning: ["6", 0], guidance: FLUX_GUIDANCE } },
    "5": { class_type: "EmptyLatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } },
    "13": {
      class_type: "KSampler",
      inputs: {
        seed,
        steps: 20,
        cfg: 1,
        sampler_name: "euler",
        scheduler: "simple",
        denoise: 1,
        model: ["12", 0],
        positive: ["26", 0],
        negative: ["6", 0],
        latent_image: ["5", 0],
      },
    },
    "8": { class_type: "VAEDecode", inputs: { samples: ["13", 0], vae: ["10", 0] } },
    "9": { class_type: "SaveImage", inputs: { filename_prefix: "ImageMagic", images: ["8", 0] } },
  };
}

function buildFluxImg2ImgWorkflow(prompt: string, model: string, seed: number, uploadedFilename: string) {
  return {
    "12": { class_type: "UNETLoader", inputs: { unet_name: model, weight_dtype: "default" } },
    "11": { class_type: "DualCLIPLoader", inputs: { clip_name1: FLUX_CLIP_NAME_1, clip_name2: FLUX_CLIP_NAME_2, type: "flux" } },
    "10": { class_type: "VAELoader", inputs: { vae_name: FLUX_VAE_NAME } },
    "20": { class_type: "LoadImage", inputs: { image: uploadedFilename } },
    "21": { class_type: "VAEEncode", inputs: { pixels: ["20", 0], vae: ["10", 0] } },
    "6": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["11", 0] } },
    "26": { class_type: "FluxGuidance", inputs: { conditioning: ["6", 0], guidance: FLUX_GUIDANCE } },
    "13": {
      class_type: "KSampler",
      inputs: {
        seed,
        steps: 20,
        cfg: 1,
        sampler_name: "euler",
        scheduler: "simple",
        denoise: 0.75,
        model: ["12", 0],
        positive: ["26", 0],
        negative: ["6", 0],
        latent_image: ["21", 0],
      },
    },
    "8": { class_type: "VAEDecode", inputs: { samples: ["13", 0], vae: ["10", 0] } },
    "9": { class_type: "SaveImage", inputs: { filename_prefix: "ImageMagic", images: ["8", 0] } },
  };
}

function buildImg2ImgWorkflow(prompt: string, model: string, seed: number, uploadedFilename: string) {
  return {
    "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: model } },
    "10": { class_type: "LoadImage", inputs: { image: uploadedFilename } },
    "11": { class_type: "VAEEncode", inputs: { pixels: ["10", 0], vae: ["4", 2] } },
    "6": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["4", 1] } },
    "7": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["4", 1] } },
    "3": {
      class_type: "KSampler",
      inputs: {
        seed,
        steps: 20,
        cfg: 8,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 0.75,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["11", 0],
      },
    },
    "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
    "9": { class_type: "SaveImage", inputs: { filename_prefix: "ImageMagic", images: ["8", 0] } },
  };
}

export class ComfyUiImageProvider implements ImageProvider {
  readonly name = "comfyui";

  async generate(params: GenerateImageParams, credentials: Record<string, string>): Promise<GenerateImageResult> {
    const { baseUrl, promptId } = await this.submit(params, credentials);
    const output = await this.waitForOutput(baseUrl, promptId);
    return this.fetchOutputImage(baseUrl, output);
  }

  /** Submit a workflow to ComfyUI and return immediately with the promptId. */
  async submit(
    params: GenerateImageParams,
    credentials: Record<string, string>,
  ): Promise<{ baseUrl: string; promptId: string }> {
    const baseUrl = credentials.apiKey ? normalizeBaseUrl(credentials.apiKey) : "";
    if (!baseUrl) {
      throw new Error("Missing ComfyUI server URL");
    }
    const model = credentials.model || DEFAULT_MODEL;
    const seed = Math.floor(Math.random() * 1e15);
    const useFlux = isFluxModel(model);

    let workflow: Record<string, unknown>;
    if (params.referenceImage) {
      const uploadedFilename = await this.uploadReferenceImage(baseUrl, params.referenceImage);
      workflow = useFlux
        ? buildFluxImg2ImgWorkflow(params.prompt, model, seed, uploadedFilename)
        : buildImg2ImgWorkflow(params.prompt, model, seed, uploadedFilename);
    } else {
      workflow = useFlux ? buildFluxTxt2ImgWorkflow(params.prompt, model, seed) : buildTxt2ImgWorkflow(params.prompt, model, seed);
    }

    const promptId = await this.submitWorkflow(baseUrl, workflow);
    return { baseUrl, promptId };
  }

  /**
   * Check ComfyUI history once — returns the image result if the job is done,
   * or null if it's still processing. Never blocks; always returns quickly.
   */
  async checkResult(baseUrl: string, promptId: string): Promise<GenerateImageResult | null> {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/history/${promptId}`);
    if (!response.ok) {
      return null;
    }
    const raw = (await parseJsonResponse(response)) as Record<string, ComfyHistoryEntry> | undefined;
    const entry = raw?.[promptId];
    const images = Object.values(entry?.outputs ?? {}).flatMap((node) => node.images ?? []);
    if (images.length === 0) {
      return null;
    }
    return this.fetchOutputImage(normalizeBaseUrl(baseUrl), images[0]);
  }

  private async uploadReferenceImage(baseUrl: string, referenceImage: { base64: string; mimeType: string }): Promise<string> {
    const imageBytes = Buffer.from(referenceImage.base64, "base64");
    const form = new FormData();
    form.append("image", new Blob([imageBytes], { type: referenceImage.mimeType }), "reference.png");
    form.append("overwrite", "true");

    const response = await fetch(`${baseUrl}/upload/image`, { method: "POST", body: form });
    const raw = await parseJsonResponse(response);
    if (!response.ok || !raw?.name) {
      throw new Error((raw?.error as string | undefined) ?? `ComfyUI image upload failed (${response.status})`);
    }
    return raw.name as string;
  }

  private async submitWorkflow(baseUrl: string, workflow: Record<string, unknown>): Promise<string> {
    const response = await fetch(`${baseUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow, client_id: `image-magic-${Date.now()}` }),
    });
    const raw = await parseJsonResponse(response);
    if (!response.ok || !raw?.prompt_id) {
      const error = raw?.error as { message?: string } | string | undefined;
      const message = typeof error === "string" ? error : error?.message;
      throw new Error(message ?? `ComfyUI 提交工作流失敗 (${response.status})`);
    }
    return raw.prompt_id as string;
  }

  private async waitForOutput(baseUrl: string, promptId: string): Promise<ComfyHistoryOutputImage> {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      const response = await fetch(`${baseUrl}/history/${promptId}`);
      if (response.ok) {
        const raw = (await parseJsonResponse(response)) as Record<string, ComfyHistoryEntry> | undefined;
        const entry = raw?.[promptId];
        const images = Object.values(entry?.outputs ?? {}).flatMap((node) => node.images ?? []);
        if (images.length > 0) {
          return images[0];
        }
      }
      if (attempt < POLL_MAX_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }
    throw new Error("ComfyUI 圖片生成超時，請確認伺服器仍在執行且未卡住");
  }

  private async fetchOutputImage(baseUrl: string, output: ComfyHistoryOutputImage): Promise<GenerateImageResult> {
    const query = new URLSearchParams({ filename: output.filename, subfolder: output.subfolder, type: output.type });
    const response = await fetch(`${baseUrl}/view?${query.toString()}`);
    if (!response.ok) {
      throw new Error(`ComfyUI 下載輸出圖片失敗 (${response.status})`);
    }
    const mimeType = response.headers.get("content-type") ?? "image/png";
    const bytes = Buffer.from(await response.arrayBuffer());
    return { url: `data:${mimeType};base64,${bytes.toString("base64")}`, raw: output };
  }
}
