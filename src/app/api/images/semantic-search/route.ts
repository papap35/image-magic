import { NextResponse } from "next/server";
import { validateSearchQuery } from "@/lib/search";
import { consumeRateLimit } from "@/lib/rateLimit";
import { getCurrentUserId } from "@/lib/session";
import { semanticSearchImages } from "@/services/imageSemanticSearch";

const RATE_LIMIT = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Not signed in" } }, { status: 401 });
  }

  const rateLimit = consumeRateLimit(`semantic-search:${userId}`, RATE_LIMIT, RATE_LIMIT_WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: "rate_limited", message: "Too many requests, please try again later" } },
      { status: 429, headers: { "Retry-After": Math.ceil(rateLimit.retryAfterMs / 1000).toString() } },
    );
  }

  const { searchParams } = new URL(request.url);
  const validation = validateSearchQuery(searchParams.get("q"));
  if (!validation.ok || !validation.query) {
    return NextResponse.json({ error: { code: "invalid_input", message: validation.error } }, { status: 400 });
  }

  const images = await semanticSearchImages(userId, validation.query);
  return NextResponse.json({ images });
}
