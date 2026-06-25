import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { deleteUserProviderKey } from "@/services/providerKeys";

export async function DELETE(_request: Request, { params }: { params: { provider: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  await deleteUserProviderKey(userId, params.provider);
  return NextResponse.json({ ok: true });
}
