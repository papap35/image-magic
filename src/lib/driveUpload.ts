/**
 * Derive a Drive-safe file name for a generated image (timestamp + job id avoids collisions).
 */
export function buildGeneratedImageFileName(jobId: string, createdAt: Date, extension = "png"): string {
  const stamp = createdAt.toISOString().replace(/[:.]/g, "-");
  return `${stamp}_${jobId}.${extension}`;
}
