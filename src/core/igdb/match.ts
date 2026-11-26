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

const ROMAN = /^(x{0,2})(ix|iv|v?i{0,3})$/;
const ROMAN_VALUE: Record<string, number> = { i: 1, v: 5, x: 10 };

function romanValue(word: string): number | null {
  if (!ROMAN.test(word)) return null;
  let total = 0;
  for (let i = 0; i < word.length; i++) {
    const value = ROMAN_VALUE[word[i]!]!;
    const next = ROMAN_VALUE[word[i + 1] ?? ""] ?? 0;
    total += value < next ? -value : value;
  }
  // «I» is far more often the word than the number one.
  return total >= 2 ? total : null;
}

/**
 * The numbers in a title, Roman ones as digits («Dark Souls III» → «3»): «Spiel 2» and
 * «Spiel 3» are different games, however similar the rest of the title is.
 */
export function titleNumbers(title: string): string {
  const numbers = normalizeTitle(title)
    .split(" ")
    .map((word) => (/^\d+$/.test(word) ? String(Number(word)) : romanValue(word)?.toString() ?? null))
    .filter((n): n is string => n !== null);
  return numbers.sort().join(" ");
}

/**
 * Best candidate, or null if none is convincing. An exact title (or alternative title)
 * wins; otherwise the most similar one above MIN_SIMILARITY whose numbers are the same
 * (see titleNumbers). Ties: platform match, then popularity.
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
    // A similar title only counts with the same numbers: a sequel is another game (and the
    // sync merges games with the same IGDB id).
    const numbers = titleNumbers(title);
    const similarity = Math.max(0, ...names.filter((n) => titleNumbers(n) === numbers).map((n) => titleSimilarity(n, title)));
    if (!exact && similarity < MIN_SIMILARITY) continue;
    const platformBonus = game.platformIds.some((p) => platforms.has(p)) ? 0.05 : 0;
    const popularity = Math.min(game.ratingCount, 1000) / 100_000; // only breaks ties
    const score = (exact ? 2 : similarity) + platformBonus + popularity;
    if (!best || score > best.score) best = { game, score };
  }
  return best?.game ?? null;
}
