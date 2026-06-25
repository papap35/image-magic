const EMBEDDING_MODEL = "text-embedding-3-small";

/** Calls OpenAI's embeddings endpoint to turn `text` into a 1536-dim vector. */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.AI_IMAGE_PROVIDER_API_KEY ?? "";
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });

  const raw = await response.json();
  if (!response.ok) {
    throw new Error(raw?.error?.message ?? `Embedding generation failed (${response.status})`);
  }

  const embedding = raw?.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new Error("Embedding response did not include a vector");
  }

  return embedding;
}
