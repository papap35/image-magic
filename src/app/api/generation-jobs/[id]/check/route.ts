import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { checkAndFinalizeComfyJob } from "@/services/generationJobs";
import { resolveProviderCredentials } from "@/services/providerCredentials";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const { id } = await params;
  const credentials = await resolveProviderCredentials(userId, "comfyui");
  if (!credentials.ok) {
    return NextResponse.json({ error: { code: credentials.code, message: credentials.message } }, { status: credentials.status });
  }

  const job = await checkAndFinalizeComfyJob(userId, id, credentials.credentials);
  if (!job) {
    return NextResponse.json({ error: { code: "not_found", message: "Job not found" } }, { status: 404 });
  }

  return NextResponse.json({ job });
}
