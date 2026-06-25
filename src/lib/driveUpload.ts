const BOUNDARY = "image_magic_drive_upload_boundary";

export interface DriveFileMetadata {
  name: string;
  parents?: string[];
  mimeType?: string;
}

export interface MultipartUploadBody {
  contentType: string;
  body: Buffer;
}

/**
 * Build a multipart/related request body for the Drive v3 upload endpoint
 * (metadata part + media part), per
 * https://developers.google.com/drive/api/guides/manage-uploads#multipart.
 */
export function buildMultipartUploadBody(
  metadata: DriveFileMetadata,
  fileBytes: Buffer,
  mimeType: string,
): MultipartUploadBody {
  const metadataPart = [
    `--${BOUNDARY}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    "",
  ].join("\r\n");

  const mediaHeader = [`--${BOUNDARY}`, `Content-Type: ${mimeType}`, "", ""].join("\r\n");

  const closing = `\r\n--${BOUNDARY}--`;

  const body = Buffer.concat([Buffer.from(metadataPart, "utf-8"), Buffer.from(mediaHeader, "utf-8"), fileBytes, Buffer.from(closing, "utf-8")]);

  return { contentType: `multipart/related; boundary=${BOUNDARY}`, body };
}

/**
 * Derive a Drive-safe file name for a generated image (timestamp + job id avoids collisions).
 */
export function buildGeneratedImageFileName(jobId: string, createdAt: Date, extension = "png"): string {
  const stamp = createdAt.toISOString().replace(/[:.]/g, "-");
  return `${stamp}_${jobId}.${extension}`;
}
