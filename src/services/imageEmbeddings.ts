import { prisma } from "@/lib/db";
import { buildEmbeddingInputText, toPgVectorLiteral } from "@/lib/embedding";
import { generateEmbedding } from "@/services/embeddings";

/**
 * Generate and store the semantic-search embedding for an image. Best-effort,
 * like AI recognition: failures are swallowed since this is an enhancement
 * on top of keyword search, not part of the critical generation path. The
 * `embedding` column is an `Unsupported("vector(1536)")` Prisma field, so it
 * can only be written via raw SQL.
 */
export async function generateAndStoreImageEmbedding(imageId: string): Promise<void> {
  const image = await prisma.image.findUnique({ where: { id: imageId } });
  if (!image) {
    return;
  }

  const text = buildEmbeddingInputText(image);
  if (!text) {
    return;
  }

  try {
    const values = await generateEmbedding(text);
    const literal = toPgVectorLiteral(values);
    await prisma.$executeRaw`UPDATE "Image" SET embedding = ${literal}::vector WHERE id = ${imageId}`;
  } catch {
    // Best-effort: leave embedding unset on failure, no error field needed
    // since semantic search simply excludes images without an embedding.
  }
}
