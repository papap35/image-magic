import { prisma } from "@/lib/db";
import type { PromptFieldKV } from "@/lib/promptField";

async function findOwnedStylePreset(userId: string, stylePresetId: string) {
  return prisma.stylePreset.findFirst({ where: { id: stylePresetId, userId } });
}

export async function listPromptFields(userId: string, stylePresetId: string) {
  const preset = await findOwnedStylePreset(userId, stylePresetId);
  if (!preset) {
    return null;
  }
  return prisma.promptField.findMany({
    where: { stylePresetId },
    orderBy: { order: "asc" },
  });
}

export async function createPromptField(
  userId: string,
  stylePresetId: string,
  input: PromptFieldKV & { order?: number },
) {
  const preset = await findOwnedStylePreset(userId, stylePresetId);
  if (!preset) {
    return null;
  }
  return prisma.promptField.create({
    data: {
      stylePresetId,
      key: input.key.trim(),
      value: input.value.trim(),
      order: input.order ?? 0,
    },
  });
}

async function findOwnedField(userId: string, stylePresetId: string, fieldId: string) {
  const preset = await findOwnedStylePreset(userId, stylePresetId);
  if (!preset) {
    return null;
  }
  return prisma.promptField.findFirst({ where: { id: fieldId, stylePresetId } });
}

export async function updatePromptField(
  userId: string,
  stylePresetId: string,
  fieldId: string,
  input: Partial<PromptFieldKV> & { order?: number },
) {
  const existing = await findOwnedField(userId, stylePresetId, fieldId);
  if (!existing) {
    return null;
  }
  return prisma.promptField.update({
    where: { id: fieldId },
    data: {
      ...(input.key !== undefined ? { key: input.key.trim() } : {}),
      ...(input.value !== undefined ? { value: input.value.trim() } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
    },
  });
}

export async function deletePromptField(userId: string, stylePresetId: string, fieldId: string) {
  const existing = await findOwnedField(userId, stylePresetId, fieldId);
  if (!existing) {
    return false;
  }
  await prisma.promptField.delete({ where: { id: fieldId } });
  return true;
}
