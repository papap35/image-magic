/**
 * Node's `fetch` throws a generic Error with message "fetch failed" when the
 * underlying network call fails (DNS, TLS, connection reset, timeout, ...);
 * the actual reason lives in `error.cause`, not `error.message`. This walks
 * the cause chain so callers (and end users reading job.error) see the real
 * reason instead of just "fetch failed".
 */
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) {
    return "Unknown error";
  }

  const parts = [err.message];
  let cause: unknown = (err as Error & { cause?: unknown }).cause;
  while (cause) {
    if (cause instanceof Error) {
      const code = (cause as Error & { code?: string }).code;
      parts.push(code ? `${cause.message} (${code})` : cause.message);
      cause = (cause as Error & { cause?: unknown }).cause;
    } else {
      parts.push(String(cause));
      break;
    }
  }

  return parts.join(": ");
}
