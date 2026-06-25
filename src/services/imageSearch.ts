import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Full-text keyword search over a user's images: title + description +
 * aiCaption + tag names. Tags live in a separate table, so the tsvector is
 * built on the fly via a per-image tag-name aggregate rather than a stored
 * generated column.
 */
export function searchImages(userId: string, query: string) {
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
      WITH image_tags AS (
        SELECT it."imageId", string_agg(t.name, ' ') AS tags_text
        FROM "ImageTag" it
        JOIN "Tag" t ON t.id = it."tagId"
        GROUP BY it."imageId"
      )
      SELECT i.id, i."userId", i."jobId", i."driveFileId", i."driveViewUrl",
             i."thumbnailUrl", i.title, i.description, i."aiCaption", i."createdAt"
      FROM "Image" i
      LEFT JOIN image_tags ON image_tags."imageId" = i.id
      WHERE i."userId" = ${userId}
        AND to_tsvector(
              'simple',
              coalesce(i.title, '') || ' ' || coalesce(i.description, '') || ' ' ||
              coalesce(i."aiCaption", '') || ' ' || coalesce(image_tags.tags_text, '')
            ) @@ plainto_tsquery('simple', ${query})
      ORDER BY i."createdAt" DESC
    `,
  );
}
