export interface EmbeddingInputSource {
  title?: string | null;
  description?: string | null;
  aiCaption?: string | null;
}

/** Build the text fed into the embedding model from an image's text fields. */
export function buildEmbeddingInputText(source: EmbeddingInputSource): string {
  return [source.title, source.description, source.aiCaption]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim())
    .join(" ");
}

/** Format a numeric embedding vector as a pgvector literal, e.g. `[0.1,0.2]`. */
export function toPgVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}
