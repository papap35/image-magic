import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { deletePromptField, updatePromptField } from "@/services/promptFields";

interface RouteParams {
  params: { id: string; fieldId: string };
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
  if (body?.key !== undefined && isBlank(body.key)) {
    return NextResponse.json({ error: { code: "invalid_input", message: "key cannot be empty" } }, { status: 400 });
  }
  if (body?.value !== undefined && isBlank(body.value)) {
    return NextResponse.json({ error: { code: "invalid_input", message: "value cannot be empty" } }, { status: 400 });
  }

  const field = await updatePromptField(userId, params.id, params.fieldId, body ?? {});
  if (!field) {
    return NextResponse.json({ error: { code: "not_found", message: "Prompt field not found" } }, { status: 404 });
  }
  return NextResponse.json({ field });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const deleted = await deletePromptField(userId, params.id, params.fieldId);
  if (!deleted) {
    return NextResponse.json({ error: { code: "not_found", message: "Prompt field not found" } }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
