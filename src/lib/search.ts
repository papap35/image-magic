export interface SearchQueryValidationResult {
  ok: boolean;
  error?: string;
  query?: string;
}

const MAX_QUERY_LENGTH = 200;

/** Validate and normalize a search keyword string from a `?q=` query param. */
export function validateSearchQuery(rawQuery: unknown): SearchQueryValidationResult {
  if (typeof rawQuery !== "string" || rawQuery.trim().length === 0) {
    return { ok: false, error: "q is required" };
  }
  const query = rawQuery.trim();
  if (query.length > MAX_QUERY_LENGTH) {
    return { ok: false, error: `q must be at most ${MAX_QUERY_LENGTH} characters` };
  }
  return { ok: true, query };
}
