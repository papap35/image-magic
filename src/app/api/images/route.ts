import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { listImages } from "@/services/images";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const images = await listImages(userId);
  return NextResponse.json({ images });
}
