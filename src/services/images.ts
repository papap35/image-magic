import { prisma } from "@/lib/db";
import { buildGeneratedImageFileName } from "@/lib/driveUpload";
import { normalizeClearableText } from "@/lib/image";
import { decryptToken } from "@/lib/tokenCrypto";
import { ensureAppFolder, refreshAccessToken, uploadImageToDrive } from "@/services/googleDrive";
import { addTagToImage } from "@/services/tags";

/**
 * Download the provider's (temporary) result image and upload it into the
 * user's own Drive `ImageMagic` folder, persisting an `Image` row that links
 * back to the `GenerationJob`. Throws on any failure — the caller decides
 * how that affects the job's status.
 */
export async function uploadGeneratedImageToDrive(userId: string, jobId: string, resultUrl: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.driveRefreshToken) {
    throw new Error("User has not granted Drive access (missing refresh token)");
  }

  const accessToken = await refreshAccessToken(decryptToken(user.driveRefreshToken));
  const folderId = await ensureAppFolder(accessToken, user.driveFolderId);
  if (folderId !== user.driveFolderId) {
    await prisma.user.update({ where: { id: userId }, data: { driveFolderId: folderId } });
  }

  const imageResponse = await fetch(resultUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image (${imageResponse.status})`);
  }
  const mimeType = imageResponse.headers.get("content-type") ?? "image/png";
  const fileBytes = Buffer.from(await imageResponse.arrayBuffer());
  const fileName = buildGeneratedImageFileName(jobId, new Date(), mimeType.includes("jpeg") ? "jpg" : "png");

  const uploaded = await uploadImageToDrive(accessToken, folderId, fileName, mimeType, fileBytes);

  return prisma.image.create({
    data: {
      userId,
      jobId,
      driveFileId: uploaded.fileId,
      driveViewUrl: uploaded.viewUrl,
    },
  });
}

export function listImages(userId: string) {
  return prisma.image.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export interface UpdateImageInput {
  title?: string | null;
  description?: string | null;
}

export async function updateImage(userId: string, id: string, input: UpdateImageInput) {
  const existing = await prisma.image.findFirst({ where: { id, userId } });
  if (!existing) {
    return null;
  }
  return prisma.image.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: normalizeClearableText(input.title) } : {}),
      ...(input.description !== undefined ? { description: normalizeClearableText(input.description) } : {}),
    },
  });
}

/** Apply all AI-suggested tags as real tags on the image, then clear the suggestion list. */
export async function acceptAiTagSuggestions(userId: string, id: string) {
  const existing = await prisma.image.findFirst({ where: { id, userId } });
  if (!existing) {
    return null;
  }
  const suggestions = Array.isArray(existing.aiTagSuggestions) ? (existing.aiTagSuggestions as string[]) : [];
  for (const tagName of suggestions) {
    await addTagToImage(userId, id, tagName);
  }
  return prisma.image.update({ where: { id }, data: { aiTagSuggestions: [] } });
}

/** Discard the AI-suggested tags without applying them. */
export async function dismissAiTagSuggestions(userId: string, id: string) {
  const existing = await prisma.image.findFirst({ where: { id, userId } });
  if (!existing) {
    return null;
  }
  return prisma.image.update({ where: { id }, data: { aiTagSuggestions: [] } });
}
