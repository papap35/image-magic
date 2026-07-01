import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { describeError } from "@/lib/errors";
import { toUsageDateKey } from "@/lib/generationJob";
import { getImageProvider } from "@/services/imageProviders";
import { ComfyUiImageProvider } from "@/services/imageProviders/comfyui";
import { uploadGeneratedImageToDrive } from "@/services/images";
import { runImageRecognition } from "@/services/imageRecognition";

export interface CreateGenerationJobInput {
  provider: string;
  promptFinal: string;
  params?: Record<string, unknown>;
  referenceImage?: { base64: string; mimeType: string };
}

export type ProviderCredentials = Record<string, string>;

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
export async function createAndRunGenerationJob(
  userId: string,
  input: CreateGenerationJobInput,
  credentials: ProviderCredentials,
) {
  const job = await prisma.generationJob.create({
    data: {
      userId,
      provider: input.provider,
      model: credentials.model,
      promptFinal: input.promptFinal,
      params: (input.params as Prisma.InputJsonValue | undefined) ?? undefined,
      status: "pending",
    },
  });

  const provider = getImageProvider(input.provider);
  if (!provider) {
    return prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "failed", error: `Unknown provider: ${input.provider}`, completedAt: new Date() },
    });
  }

  try {
    const result = await provider.generate(
      { prompt: input.promptFinal, referenceImage: input.referenceImage },
      credentials,
    );
    await incrementUsage(userId, input.provider);

    let image;
    try {
      image = await uploadGeneratedImageToDrive(userId, job.id, result.url);
    } catch (driveErr) {
      return prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          resultUrl: result.url,
          error: `Drive upload failed: ${describeError(driveErr)}`,
          completedAt: new Date(),
        },
      });
    }

    // Best-effort AI captioning/tag suggestions; never affects job status.
    await runImageRecognition(image.id);

    return prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "success", resultUrl: result.url, completedAt: new Date() },
    });
  } catch (err) {
    return prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "failed", error: describeError(err), completedAt: new Date() },
    });
  }
}

/**
 * ComfyUI-specific: submit the workflow and return the pending job immediately
 * (with comfyPromptId stored). The caller must poll checkAndFinalizeComfyJob
 * until the job reaches a terminal state.
 */
export async function submitComfyJob(
  userId: string,
  input: CreateGenerationJobInput,
  credentials: ProviderCredentials,
) {
  const job = await prisma.generationJob.create({
    data: {
      userId,
      provider: input.provider,
      model: credentials.model,
      promptFinal: input.promptFinal,
      params: (input.params as Prisma.InputJsonValue | undefined) ?? undefined,
      status: "pending",
    },
  });

  try {
    const provider = new ComfyUiImageProvider();
    const { promptId } = await provider.submit(
      { prompt: input.promptFinal, referenceImage: input.referenceImage },
      credentials,
    );
    return prisma.generationJob.update({
      where: { id: job.id },
      data: { comfyPromptId: promptId },
    });
  } catch (err) {
    return prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "failed", error: describeError(err), completedAt: new Date() },
    });
  }
}

/**
 * ComfyUI-specific: check ComfyUI once for the job result. If done, finalize
 * the job (upload to Drive, run recognition, mark success/failed). Returns the
 * updated job regardless of whether it changed.
 */
export async function checkAndFinalizeComfyJob(userId: string, jobId: string, credentials: ProviderCredentials) {
  const job = await prisma.generationJob.findFirst({ where: { id: jobId, userId } });
  if (!job || job.status !== "pending" || !job.comfyPromptId) {
    return job ?? null;
  }

  const baseUrl = credentials.apiKey ?? "";
  if (!baseUrl) {
    return job;
  }

  const provider = new ComfyUiImageProvider();
  let result;
  try {
    result = await provider.checkResult(baseUrl, job.comfyPromptId);
  } catch {
    return job;
  }

  if (!result) {
    return job;
  }

  await incrementUsage(userId, job.provider);

  let image;
  try {
    image = await uploadGeneratedImageToDrive(userId, job.id, result.url);
  } catch (driveErr) {
    return prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        resultUrl: result.url,
        error: `Drive upload failed: ${describeError(driveErr)}`,
        completedAt: new Date(),
      },
    });
  }

  await runImageRecognition(image.id);

  return prisma.generationJob.update({
    where: { id: job.id },
    data: { status: "success", resultUrl: result.url, completedAt: new Date() },
  });
}

export function listGenerationJobs(userId: string) {
  return prisma.generationJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteGenerationJob(userId: string, id: string) {
  const job = await prisma.generationJob.findFirst({ where: { id, userId } });
  if (!job) {
    return null;
  }
  await prisma.generationJob.delete({ where: { id } });
  return job;
}
