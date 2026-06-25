import { NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/rateLimit";
import { getCurrentUserId } from "@/lib/session";
import { createAndRunGenerationJob, listGenerationJobs } from "@/services/generationJobs";
import { resolveProviderCredentials } from "@/services/providerCredentials";

const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

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

  const rateLimit = consumeRateLimit(`generation-jobs:${userId}`, RATE_LIMIT, RATE_LIMIT_WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many requests, please try again later" } },
      { status: 429, headers: { "Retry-After": Math.ceil(rateLimit.retryAfterMs / 1000).toString() } },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body?.provider || !body?.promptFinal) {
    return NextResponse.json(
      { error: { code: "invalid_input", message: "provider and promptFinal are required" } },
      { status: 400 },
    );
  }

  const credentials = await resolveProviderCredentials(userId, body.provider, { password: body.password });
  if (!credentials.ok) {
    return NextResponse.json(
      { error: { code: credentials.code, message: credentials.message } },
      { status: credentials.status },
    );
  }

  const job = await createAndRunGenerationJob(userId, body, credentials.credentials);
  const status = job.status === "failed" ? 502 : 201;
  return NextResponse.json({ job }, { status });
}
