import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { validatePromptFieldInput } from "@/lib/promptField";
import { createPromptField, listPromptFields } from "@/services/promptFields";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const fields = await listPromptFields(userId, params.id);
  if (fields === null) {
    return NextResponse.json({ error: { code: "not_found", message: "Style preset not found" } }, { status: 404 });
  }
  return NextResponse.json({ fields });
}

export async function POST(request: Request, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const validation = validatePromptFieldInput(body ?? {});
  if (!validation.valid) {
    return NextResponse.json({ error: { code: "invalid_input", message: validation.errors.join(", ") } }, { status: 400 });
  }

  const field = await createPromptField(userId, params.id, body);
  if (field === null) {
    return NextResponse.json({ error: { code: "not_found", message: "Style preset not found" } }, { status: 404 });
  }
  return NextResponse.json({ field }, { status: 201 });
}
