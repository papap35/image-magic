import { NextResponse } from "next/server";
import { validateImageUpdateInput } from "@/lib/image";
import { getCurrentUserId } from "@/lib/session";
import { updateImage } from "@/services/images";

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const validation = validateImageUpdateInput(body ?? {});
  if (!validation.ok) {
    return NextResponse.json({ error: { code: "invalid_input", message: validation.error } }, { status: 400 });
  }

  const image = await updateImage(userId, params.id, body ?? {});
  if (!image) {
    return NextResponse.json({ error: { code: "not_found", message: "Image not found" } }, { status: 404 });
  }
  return NextResponse.json({ image });
}
