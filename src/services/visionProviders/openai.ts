import { parseVisionResponseText } from "@/lib/visionResult";
import type { RecognizeImageParams, RecognizeImageResult, VisionProvider } from "./types";

const PROMPT =
  'Describe this image in one concise sentence and suggest up to 5 short tags. Respond ONLY with JSON in this exact shape: {"caption": string, "tags": string[]}.';

export class OpenAiVisionProvider implements VisionProvider {
  readonly name = "openai-vision";

  constructor(private readonly apiKey: string = process.env.AI_IMAGE_PROVIDER_API_KEY ?? "") {}

  async recognize(params: RecognizeImageParams): Promise<RecognizeImageResult> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: params.imageUrl } },
            ],
          },
        ],
      }),
    });

    const raw = await response.json();
    if (!response.ok) {
      throw new Error(raw?.error?.message ?? `Vision recognition failed (${response.status})`);
    }

    const text = raw?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("Vision response did not include content");
    }

    const { caption, tags } = parseVisionResponseText(text);
    return { caption, tags, raw };
  }
}
