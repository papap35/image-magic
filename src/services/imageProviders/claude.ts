import type { GenerateImageParams, GenerateImageResult, ImageProvider } from "./types";
import { OpenAiImageProvider } from "./openai";

const PROMPT_REWRITE_INSTRUCTIONS =
  "Rewrite the following image generation prompt to be more vivid and detailed for an AI image generator. " +
  "Reply with only the rewritten prompt, no preamble or explanation.";

/**
 * Claude has no image generation API. This provider uses Claude (Messages
 * API) to rewrite/enhance the user's prompt, then hands the result to
 * OpenAI's image generation API to actually produce the image.
 */
export class ClaudeAssistedImageProvider implements ImageProvider {
  readonly name = "claude";

  private readonly imageProvider = new OpenAiImageProvider();

  async generate(params: GenerateImageParams, credentials: Record<string, string>): Promise<GenerateImageResult> {
    const anthropicApiKey = credentials.anthropicApiKey;
    const imageApiKey = credentials.imageApiKey;
    if (!anthropicApiKey || !imageApiKey) {
      throw new Error("Missing Claude/image provider credentials");
    }

    const rewrittenPrompt = await this.rewritePrompt(params.prompt, anthropicApiKey);

    return this.imageProvider.generate({ ...params, prompt: rewrittenPrompt }, { apiKey: imageApiKey });
  }

  /** Best-effort: any failure (network, API error, bad response shape) falls back to the original prompt. */
  private async rewritePrompt(prompt: string, anthropicApiKey: string): Promise<string> {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          messages: [{ role: "user", content: `${PROMPT_REWRITE_INSTRUCTIONS}\n\nPrompt: ${prompt}` }],
        }),
      });

      const raw = await response.json();
      if (!response.ok) {
        return prompt;
      }

      const text = raw?.content?.[0]?.text;
      return typeof text === "string" && text.trim() ? text.trim() : prompt;
    } catch {
      return prompt;
    }
  }
}
