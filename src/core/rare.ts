// «Selten»: which achievements count as rare. The limit is a setting (`rareLimit`).

/** The limits offered for «rare», as stored in the settings (`rareLimit`). */
export const RARE_LIMITS = ["10", "5", "3", "2", "1", "<1"] as const;
export type RareLimit = (typeof RARE_LIMITS)[number];
export const DEFAULT_RARE_LIMIT: RareLimit = "10";

export function rareLimitLabel(limit: RareLimit): string {
  return limit === "<1" ? "unter 1 %" : `höchstens ${limit} %`;
}

/** The stored limit, or the default if nothing valid is stored. */
export function readRareLimit(settings: Record<string, unknown>): RareLimit {
  const stored = settings.rareLimit;
  return RARE_LIMITS.includes(stored as RareLimit) ? (stored as RareLimit) : DEFAULT_RARE_LIMIT;
}

/** Rare: at most the limit in percent of players have it; «<1» means fewer than one percent. */
export function isRare(percent: number | null | undefined, limit: RareLimit): boolean {
  if (percent == null) return false;
  return limit === "<1" ? percent < 1 : percent <= Number(limit);
}
