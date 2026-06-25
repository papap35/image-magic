export interface TagValidationResult {
  ok: boolean;
  error?: string;
  name?: string;
}

const MAX_TAG_LENGTH = 50;

/**
 * Validate and normalize a tag name: trimmed, non-empty, length-bounded.
 * Returns the normalized name so callers store a consistent form.
 */
export function validateTagName(rawName: unknown): TagValidationResult {
  if (typeof rawName !== "string" || rawName.trim().length === 0) {
    return { ok: false, error: "name is required" };
  }
  const name = rawName.trim();
  if (name.length > MAX_TAG_LENGTH) {
    return { ok: false, error: `name must be at most ${MAX_TAG_LENGTH} characters` };
  }
  return { ok: true, name };
}
