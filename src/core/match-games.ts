import { normalizeTitle } from "./normalize-title";

export interface KnownGame {
  id: string;
  normalizedTitle: string;
  igdbId: number | null;
}

/**
 * Finds the cross-platform game a platform entry belongs to:
 * first by IGDB id, otherwise by normalised title.
 */
export function findGameMatch(
  known: readonly KnownGame[],
  title: string,
  igdbId?: number | null,
): KnownGame | null {
  if (igdbId != null) {
    const byId = known.find((g) => g.igdbId === igdbId);
    if (byId) return byId;
  }
  const normalized = normalizeTitle(title);
  if (!normalized) return null;
  return known.find((g) => g.normalizedTitle === normalized) ?? null;
}
