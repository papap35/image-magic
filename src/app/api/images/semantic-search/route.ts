import { NextResponse } from "next/server";
import { validateSearchQuery } from "@/lib/search";
import { getCurrentUserId } from "@/lib/session";
import { semanticSearchImages } from "@/services/imageSemanticSearch";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const validation = validateSearchQuery(searchParams.get("q"));
  if (!validation.ok || !validation.query) {
    return NextResponse.json({ error: { code: "invalid_input", message: validation.error } }, { status: 400 });
  }

  const images = await semanticSearchImages(userId, validation.query);
  return NextResponse.json({ images });
}
