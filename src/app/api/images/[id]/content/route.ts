import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { getImageContent } from "@/services/images";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  let content;
  try {
    content = await getImageContent(userId, params.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load image content";
    return NextResponse.json({ error: { code: "drive_error", message } }, { status: 502 });
  }

  if (!content) {
    return NextResponse.json({ error: { code: "not_found", message: "Image not found" } }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(content.bytes), {
    status: 200,
    headers: {
      "Content-Type": content.mimeType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
