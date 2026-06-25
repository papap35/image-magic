import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { deleteStylePreset, updateStylePreset } from "@/services/stylePresets";

interface RouteParams {
  params: { id: string };
}

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (body?.name !== undefined && isBlank(body.name)) {
    return NextResponse.json({ error: { code: "invalid_input", message: "name cannot be empty" } }, { status: 400 });
  }
  if (body?.basePrompt !== undefined && isBlank(body.basePrompt)) {
    return NextResponse.json({ error: { code: "invalid_input", message: "basePrompt cannot be empty" } }, { status: 400 });
  }

  const preset = await updateStylePreset(userId, params.id, body ?? {});
  if (!preset) {
    return NextResponse.json({ error: { code: "not_found", message: "Style preset not found" } }, { status: 404 });
  }
  return NextResponse.json({ preset });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const deleted = await deleteStylePreset(userId, params.id);
  if (!deleted) {
    return NextResponse.json({ error: { code: "not_found", message: "Style preset not found" } }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
