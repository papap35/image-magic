import { NextResponse } from "next/server";
import { validateTagName } from "@/lib/tag";
import { getCurrentUserId } from "@/lib/session";
import { addTagToImage, listImageTags } from "@/services/tags";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const tags = await listImageTags(userId, params.id);
  return NextResponse.json({ tags });
}

export async function POST(request: Request, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const validation = validateTagName(body?.name);
  if (!validation.ok || !validation.name) {
    return NextResponse.json({ error: { code: "invalid_input", message: validation.error } }, { status: 400 });
  }

  const tag = await addTagToImage(userId, params.id, validation.name);
  if (!tag) {
    return NextResponse.json({ error: { code: "not_found", message: "Image not found" } }, { status: 404 });
  }
  return NextResponse.json({ tag }, { status: 201 });
}
