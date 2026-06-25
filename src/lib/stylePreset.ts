export interface StylePresetInput {
  name: string;
  basePrompt: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a style preset create/update payload before it reaches the DB.
 */
export function validateStylePresetInput(input: Partial<StylePresetInput>): ValidationResult {
  const errors: string[] = [];

  if (!input.name || input.name.trim().length === 0) {
    errors.push("name is required");
  }
  if (!input.basePrompt || input.basePrompt.trim().length === 0) {
    errors.push("basePrompt is required");
  }

  return { valid: errors.length === 0, errors };
}
