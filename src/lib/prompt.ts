export interface PromptFieldInput {
  key: string;
  value: string;
}

/**
 * Combine a base style prompt with ordered key/value fields into the
 * final prompt sent to an image generation provider.
 */
export function buildFinalPrompt(basePrompt: string, fields: PromptFieldInput[]): string {
  const trimmedBase = basePrompt.trim();
  const parts = fields
    .filter((f) => f.key.trim().length > 0 && f.value.trim().length > 0)
    .map((f) => `${f.key.trim()}: ${f.value.trim()}`);

  if (parts.length === 0) {
    return trimmedBase;
  }

  return [trimmedBase, ...parts].filter((p) => p.length > 0).join(", ");
}
