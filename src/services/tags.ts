import { prisma } from "@/lib/db";

export function listTags(userId: string) {
  return prisma.tag.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
}

/** Get-or-create a tag by name for the user (names are unique per user). */
export function findOrCreateTag(userId: string, name: string) {
  return prisma.tag.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name },
    update: {},
  });
}

export async function deleteTag(userId: string, id: string) {
  const existing = await prisma.tag.findFirst({ where: { id, userId } });
  if (!existing) {
    return false;
  }
  await prisma.tag.delete({ where: { id } });
  return true;
}

export function listImageTags(userId: string, imageId: string) {
  return prisma.tag.findMany({
    where: { userId, images: { some: { imageId } } },
    orderBy: { name: "asc" },
  });
}

/** Attach a tag (by name, auto-creating it) to an image owned by the same user. */
export async function addTagToImage(userId: string, imageId: string, tagName: string) {
  const image = await prisma.image.findFirst({ where: { id: imageId, userId } });
  if (!image) {
    return null;
  }
  const tag = await findOrCreateTag(userId, tagName);
  await prisma.imageTag.upsert({
    where: { imageId_tagId: { imageId, tagId: tag.id } },
    create: { imageId, tagId: tag.id },
    update: {},
  });
  return tag;
}

export async function removeTagFromImage(userId: string, imageId: string, tagId: string) {
  const image = await prisma.image.findFirst({ where: { id: imageId, userId } });
  const tag = await prisma.tag.findFirst({ where: { id: tagId, userId } });
  if (!image || !tag) {
    return false;
  }
  await prisma.imageTag.deleteMany({ where: { imageId, tagId } });
  return true;
}
