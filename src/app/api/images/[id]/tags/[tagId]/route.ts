import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { removeTagFromImage } from "@/services/tags";

interface RouteParams {
  params: { id: string; tagId: string };
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const removed = await removeTagFromImage(userId, params.id, params.tagId);
  if (!removed) {
    return NextResponse.json({ error: { code: "not_found", message: "Image or tag not found" } }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
