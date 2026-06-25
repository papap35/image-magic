import { NextResponse } from "next/server";
import { validateTagName } from "@/lib/tag";
import { getCurrentUserId } from "@/lib/session";
import { findOrCreateTag, listTags } from "@/services/tags";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const tags = await listTags(userId);
  return NextResponse.json({ tags });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const validation = validateTagName(body?.name);
  if (!validation.ok || !validation.name) {
    return NextResponse.json({ error: { code: "invalid_input", message: validation.error } }, { status: 400 });
  }

  const tag = await findOrCreateTag(userId, validation.name);
  return NextResponse.json({ tag }, { status: 201 });
}
