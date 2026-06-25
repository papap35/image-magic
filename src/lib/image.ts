export interface ImageUpdateInput {
  title?: string | null;
  description?: string | null;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

/**
 * Validate a partial image title/description update. Both fields are
 * optional and clearable: an empty/blank string means "clear this field"
 * (normalized to null), not a validation error.
 */
export function validateImageUpdateInput(input: ImageUpdateInput): ValidationResult {
  if (input.title !== undefined && input.title !== null && input.title.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: `title must be at most ${MAX_TITLE_LENGTH} characters` };
  }
  if (input.description !== undefined && input.description !== null && input.description.length > MAX_DESCRIPTION_LENGTH) {
    return { ok: false, error: `description must be at most ${MAX_DESCRIPTION_LENGTH} characters` };
  }
  return { ok: true };
}

/** Normalize a clearable text field: blank/whitespace-only becomes null, otherwise trimmed. */
export function normalizeClearableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
