import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toPgVectorLiteral } from "@/lib/embedding";
import { generateEmbedding } from "@/services/embeddings";

const MAX_RESULTS = 20;

/**
 * Semantic search over a user's images: embeds `query` and orders results by
 * cosine distance (`<=>`) against `Image.embedding`. Images without an
 * embedding yet (recognition pending/failed) are excluded.
 */
export async function semanticSearchImages(userId: string, query: string) {
  const values = await generateEmbedding(query);
  const literal = toPgVectorLiteral(values);

  return prisma.$queryRaw<
    Array<{
      id: string;
      userId: string;
      jobId: string | null;
      driveFileId: string | null;
      driveViewUrl: string | null;
      thumbnailUrl: string | null;
      title: string | null;
      description: string | null;
      aiCaption: string | null;
      createdAt: Date;
    }>
  >(
    Prisma.sql`
      SELECT i.id, i."userId", i."jobId", i."driveFileId", i."driveViewUrl",
             i."thumbnailUrl", i.title, i.description, i."aiCaption", i."createdAt"
      FROM "Image" i
      WHERE i."userId" = ${userId}
        AND i.embedding IS NOT NULL
      ORDER BY i.embedding <=> ${literal}::vector
      LIMIT ${MAX_RESULTS}
    `,
  );
}
