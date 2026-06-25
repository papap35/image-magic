import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { PROVIDER_DEFINITIONS } from "@/services/imageProviders";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  return NextResponse.json({ providers: PROVIDER_DEFINITIONS });
}
