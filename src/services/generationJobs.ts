import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toUsageDateKey } from "@/lib/generationJob";
import { getImageProvider } from "@/services/imageProviders";
import { uploadGeneratedImageToDrive } from "@/services/images";
import { runImageRecognition } from "@/services/imageRecognition";

export interface CreateGenerationJobInput {
  provider: string;
  promptFinal: string;
  params?: Record<string, unknown>;
}

async function incrementUsage(userId: string, provider: string) {
  const date = toUsageDateKey(new Date());
  await prisma.usageLog.upsert({
    where: { userId_provider_date: { userId, provider, date } },
    create: { userId, provider, date, count: 1 },
    update: { count: { increment: 1 } },
  });
}

/**
 * Create a GenerationJob, call the requested provider, persist the result
 * (success/failure), and record per-day usage. Failure does not throw —
 * it is recorded on the job row so the caller can inspect job.status.
 */
export async function createAndRunGenerationJob(userId: string, input: CreateGenerationJobInput) {
  const job = await prisma.generationJob.create({
    data: {
      userId,
      provider: input.provider,
      promptFinal: input.promptFinal,
      params: (input.params as Prisma.InputJsonValue | undefined) ?? undefined,
      status: "pending",
    },
  });

  const provider = getImageProvider(input.provider);
  if (!provider) {
    return prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "failed", error: `Unknown provider: ${input.provider}` },
    });
  }

  try {
    const result = await provider.generate({ prompt: input.promptFinal });
    await incrementUsage(userId, input.provider);

    let image;
    try {
      image = await uploadGeneratedImageToDrive(userId, job.id, result.url);
    } catch (driveErr) {
      const message = driveErr instanceof Error ? driveErr.message : "Unknown error";
      return prisma.generationJob.update({
        where: { id: job.id },
        data: { status: "failed", resultUrl: result.url, error: `Drive upload failed: ${message}` },
      });
    }

    // Best-effort AI captioning/tag suggestions; never affects job status.
    await runImageRecognition(image.id);

    return prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "success", resultUrl: result.url },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "failed", error: message },
    });
  }
}

export function listGenerationJobs(userId: string) {
  return prisma.generationJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}
