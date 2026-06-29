import { buildMultipartUploadBody, type DriveFileMetadata } from "@/lib/driveUpload";

const APP_FOLDER_NAME = "ImageMagic";

export interface DriveUploadResult {
  fileId: string;
  viewUrl: string;
}

/**
 * Drive/OAuth endpoints normally return JSON, but on some failures (e.g. a
 * malformed multipart request) they return a plain-text body instead, which
 * crashes a bare `response.json()`. Parse defensively so callers get a
 * readable error message instead of a JSON.parse SyntaxError.
 */
interface DriveJsonResponse {
  access_token?: string;
  error_description?: string;
  trashed?: boolean;
  files?: Array<{ id?: string }>;
  id?: string;
  webViewLink?: string;
  error?: { message?: string };
}

async function parseJsonResponse(response: Response): Promise<DriveJsonResponse> {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Drive API 回應非 JSON 格式（HTTP ${response.status}）：${text.slice(0, 200)}`);
  }
}

/** Exchange a stored Google refresh token for a fresh Drive-scoped access token. */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const raw = await parseJsonResponse(response);
  if (!response.ok || !raw?.access_token) {
    throw new Error(raw?.error_description ?? "Failed to refresh Google access token");
  }
  return raw.access_token as string;
}

/**
 * Find the user's `ImageMagic` app folder by id, or by name, or create it if
 * it doesn't exist yet. Returns the folder id to persist on `User.driveFolderId`.
 */
export async function ensureAppFolder(accessToken: string, existingFolderId?: string | null): Promise<string> {
  if (existingFolderId) {
    const check = await fetch(`https://www.googleapis.com/drive/v3/files/${existingFolderId}?fields=id,trashed`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (check.ok) {
      const data = await parseJsonResponse(check);
      if (!data.trashed) return existingFolderId;
    }
  }

  const query = encodeURIComponent(`name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const search = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const searchData = await parseJsonResponse(search);
  if (search.ok && searchData?.files?.[0]?.id) {
    return searchData.files[0].id as string;
  }

  const create = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: APP_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  const createData = await parseJsonResponse(create);
  if (!create.ok || !createData?.id) {
    throw new Error(createData?.error?.message ?? "Failed to create Drive app folder");
  }
  return createData.id as string;
}

/** Upload raw image bytes into the given Drive folder, returning the file id and a viewable URL. */
export async function uploadImageToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  mimeType: string,
  fileBytes: Buffer,
): Promise<DriveUploadResult> {
  const metadata: DriveFileMetadata = { name: fileName, parents: [folderId] };
  const { contentType, body } = buildMultipartUploadBody(metadata, fileBytes, mimeType);

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
    },
    body: new Uint8Array(body),
  });

  const raw = await parseJsonResponse(response);
  if (!response.ok || !raw?.id) {
    throw new Error(raw?.error?.message ?? "Failed to upload image to Drive");
  }

  return { fileId: raw.id as string, viewUrl: raw.webViewLink ?? `https://drive.google.com/file/d/${raw.id}/view` };
}
