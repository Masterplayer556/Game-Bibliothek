// Picks the IGDB entry that belongs to a game in the library. Pure, used by the sync.
import { normalizeTitle } from "../normalize-title";
import type { DeviceKind } from "../types";
import { IGDB_PLATFORM, type IgdbGame } from "./client";

/** Title as it is best sent to IGDB's search: without trademarks and platform suffixes. */
export function searchTitle(title: string): string {
  return title
    .replace(/[™®©]/g, "")
    .replace(/\s*\((PlayStation\s?[45]|PS[45]|Nintendo Switch(\s?2)?|PC)\)\s*$/i, "")
    .replace(/\s*[-–:]?\s*(PlayStation\s?[45]|PS[45])\s+Edition\s*$/i, "")
    .replace(/\s*[–-]\s*Nintendo Switch 2 Edition\s*$/i, "")
    .replace(/\s+for Nintendo Switch\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): Set<string> {
  return new Set(normalizeTitle(text).split(" ").filter(Boolean));
}

/** Jaccard similarity of the normalised word sets (0…1). */
export function titleSimilarity(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  if (x.size === 0 || y.size === 0) return 0;
  let common = 0;
  for (const t of x) if (y.has(t)) common++;
  return common / (x.size + y.size - common);
}

export const MIN_SIMILARITY = 0.6;

/**
 * Best candidate, or null if none is convincing. An exact title (or alternative title)
 * wins; otherwise the most similar one above MIN_SIMILARITY. Ties: platform match, then
 * popularity.
 */
export function pickBestMatch(
  title: string,
  candidates: readonly IgdbGame[],
  deviceKinds: readonly DeviceKind[] = [],
): IgdbGame | null {
  const wanted = normalizeTitle(title);
  const platforms = new Set(deviceKinds.flatMap((k) => IGDB_PLATFORM[k] ?? []));
  let best: { game: IgdbGame; score: number } | null = null;
  for (const game of candidates) {
    const names = [game.title, ...game.alternativeNames];
    const exact = names.some((n) => normalizeTitle(n) === wanted);
    const similarity = Math.max(...names.map((n) => titleSimilarity(n, title)));
    if (!exact && similarity < MIN_SIMILARITY) continue;
    const platformBonus = game.platformIds.some((p) => platforms.has(p)) ? 0.05 : 0;
    const popularity = Math.min(game.ratingCount, 1000) / 100_000; // only breaks ties
    const score = (exact ? 2 : similarity) + platformBonus + popularity;
    if (!best || score > best.score) best = { game, score };
  }
  return best?.game ?? null;
}
