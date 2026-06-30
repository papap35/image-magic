import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { deleteGenerationJob } from "@/services/generationJobs";

interface RouteParams {
  params: { id: string };
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const job = await deleteGenerationJob(userId, params.id);
  if (!job) {
    return NextResponse.json({ error: { code: "not_found", message: "Generation job not found" } }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
