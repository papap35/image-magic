import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { deleteUserProviderKey, saveUserProviderModel } from "@/services/providerKeys";

export async function DELETE(_request: Request, { params }: { params: { provider: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  await deleteUserProviderKey(userId, params.provider);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: { provider: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const model = body?.model;
  if (model !== null && typeof model !== "string") {
    return NextResponse.json(
      { error: { code: "invalid_input", message: "model must be a string or null" } },
      { status: 400 },
    );
  }

  try {
    await saveUserProviderModel(userId, params.provider, model && model.trim() ? model.trim() : null);
  } catch {
    return NextResponse.json(
      { error: { code: "missing_api_key", message: `No saved API key for provider "${params.provider}"` } },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
