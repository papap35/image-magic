export interface PromptFieldKV {
  key: string;
  value: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a single dynamic key/value prompt field before persisting it.
 */
export function validatePromptFieldInput(input: Partial<PromptFieldKV>): ValidationResult {
  const errors: string[] = [];

  if (!input.key || input.key.trim().length === 0) {
    errors.push("key is required");
  }
  if (!input.value || input.value.trim().length === 0) {
    errors.push("value is required");
  }

  return { valid: errors.length === 0, errors };
}
