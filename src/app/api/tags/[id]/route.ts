import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { deleteTag } from "@/services/tags";

interface RouteParams {
  params: { id: string };
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const deleted = await deleteTag(userId, params.id);
  if (!deleted) {
    return NextResponse.json({ error: { code: "not_found", message: "Tag not found" } }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
