import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { validateStylePresetInput } from "@/lib/stylePreset";
import { createStylePreset, listStylePresets } from "@/services/stylePresets";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const presets = await listStylePresets(userId);
  return NextResponse.json({ presets });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const validation = validateStylePresetInput(body ?? {});
  if (!validation.valid) {
    return NextResponse.json({ error: { code: "invalid_input", message: validation.errors.join(", ") } }, { status: 400 });
  }

  const preset = await createStylePreset(userId, body);
  return NextResponse.json({ preset }, { status: 201 });
}
