const PROMPT_REWRITE_INSTRUCTIONS =
  "Rewrite the following image generation prompt to be more vivid and detailed for an AI image generator. " +
  "Reply with only the rewritten prompt, no preamble or explanation.";

/**
 * Best-effort prompt rewrite via Claude (Anthropic Messages API). Claude has
 * no image generation API of its own — this only touches the text prompt,
 * never the actual image rendering. Any failure (network, API error, bad
 * response shape) falls back to the original prompt rather than blocking
 * generation.
 */
export async function enhancePromptWithClaude(prompt: string, anthropicApiKey: string): Promise<string> {
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
