import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { PROVIDER_DEFINITIONS } from "@/services/imageProviders";
import { listUserProviderKeyNames, saveUserProviderKey } from "@/services/providerKeys";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const savedProviders = await listUserProviderKeyNames(userId);
  return NextResponse.json({ savedProviders });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const provider = body?.provider;
  const apiKey = body?.apiKey;
  if (typeof provider !== "string" || typeof apiKey !== "string" || !apiKey.trim()) {
    return NextResponse.json(
      { error: { code: "invalid_input", message: "provider and apiKey are required" } },
      { status: 400 },
    );
  }

  const definition = PROVIDER_DEFINITIONS.find((def) => def.id === provider);
  if (!definition || definition.authMode !== "byok") {
    return NextResponse.json(
      { error: { code: "invalid_provider", message: `Provider "${provider}" does not accept a user-supplied key` } },
      { status: 400 },
    );
  }

  await saveUserProviderKey(userId, provider, apiKey.trim());
  return NextResponse.json({ ok: true }, { status: 201 });
}
