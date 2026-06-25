/**
 * Truncate a Date down to UTC midnight, used as the grouping key for
 * per-day usage log rows ({ userId, provider, date }).
 */
export function toUsageDateKey(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
