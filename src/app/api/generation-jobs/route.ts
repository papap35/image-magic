import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { createAndRunGenerationJob, listGenerationJobs } from "@/services/generationJobs";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const jobs = await listGenerationJobs(userId);
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.provider || !body?.promptFinal) {
    return NextResponse.json(
      { error: { code: "invalid_input", message: "provider and promptFinal are required" } },
      { status: 400 },
    );
  }

  const job = await createAndRunGenerationJob(userId, body);
  const status = job.status === "failed" ? 502 : 201;
  return NextResponse.json({ job }, { status });
}
