export interface ParsedVisionResult {
  caption: string;
  tags: string[];
}

/**
 * Parse a vision model's free-form text response into { caption, tags }.
 * Models sometimes wrap JSON in markdown code fences or add surrounding
 * prose, so we extract the first `{...}` block rather than requiring the
 * whole response to be valid JSON.
 */
export function parseVisionResponseText(text: string): ParsedVisionResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Vision response did not contain a JSON object");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const caption = typeof parsed.caption === "string" ? parsed.caption.trim() : "";
  if (!caption) {
    throw new Error("Vision response missing caption");
  }

  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter((tag: unknown): tag is string => typeof tag === "string" && tag.trim().length > 0).map((tag: string) => tag.trim())
    : [];

  return { caption, tags };
}
