import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { dismissAiTagSuggestions } from "@/services/images";

interface RouteParams {
  params: { id: string };
}

export async function POST(_request: Request, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const image = await dismissAiTagSuggestions(userId, params.id);
  if (!image) {
    return NextResponse.json({ error: { code: "not_found", message: "Image not found" } }, { status: 404 });
  }
  return NextResponse.json({ image });
}
