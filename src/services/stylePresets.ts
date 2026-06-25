import { prisma } from "@/lib/db";
import type { StylePresetInput } from "@/lib/stylePreset";

export function listStylePresets(userId: string) {
  return prisma.stylePreset.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export function createStylePreset(userId: string, input: StylePresetInput) {
  return prisma.stylePreset.create({
    data: { userId, name: input.name.trim(), basePrompt: input.basePrompt.trim() },
  });
}

export async function updateStylePreset(userId: string, id: string, input: Partial<StylePresetInput>) {
  const existing = await prisma.stylePreset.findFirst({ where: { id, userId } });
  if (!existing) {
    return null;
  }
  return prisma.stylePreset.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.basePrompt !== undefined ? { basePrompt: input.basePrompt.trim() } : {}),
    },
  });
}

export async function deleteStylePreset(userId: string, id: string) {
  const existing = await prisma.stylePreset.findFirst({ where: { id, userId } });
  if (!existing) {
    return false;
  }
  await prisma.stylePreset.delete({ where: { id } });
  return true;
}
