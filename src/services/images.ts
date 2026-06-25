import { prisma } from "@/lib/db";
import { buildGeneratedImageFileName } from "@/lib/driveUpload";
import { ensureAppFolder, refreshAccessToken, uploadImageToDrive } from "@/services/googleDrive";

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

  const accessToken = await refreshAccessToken(user.driveRefreshToken);
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
