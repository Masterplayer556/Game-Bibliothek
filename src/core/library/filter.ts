// The library list: search, filters and sort order.
import type { DeviceKind, GameStatus, PlatformId } from "../types";
import type { LibraryGame } from "./model";

export const SORT_KEYS = ["lastPlayed", "playtime", "name", "achievements", "releaseYear"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export interface LibraryFilter {
  search?: string;
  platform?: PlatformId | "";
  device?: DeviceKind | "";
  genre?: string;
  status?: GameStatus | "none" | "";
  /** Only games marked as favourite. */
  favorite?: boolean;
  showHidden?: boolean;
  sort?: SortKey;
}

function fold(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

// One collator for every title sort: localeCompare(…, "de") builds a new one per comparison,
// which made sorting a large library slow.
const TITLE_COLLATOR = new Intl.Collator("de");

/** Alphabetical order of titles (German rules, the same as localeCompare(…, "de")). */
export function compareTitles(a: string, b: string): number {
  return TITLE_COLLATOR.compare(a, b);
}

// The folded titles of a game (its own and every entry's), computed once per game object:
// typing in the search box filters again on every key.
const searchTexts = new WeakMap<LibraryGame, string[]>();
function searchTextsOf(game: LibraryGame): string[] {
  let texts = searchTexts.get(game);
  if (!texts) {
    texts = [fold(game.title), ...game.entries.map((e) => fold(e.title))];
    searchTexts.set(game, texts);
  }
  return texts;
}

export function filterLibrary(games: readonly LibraryGame[], filter: LibraryFilter): LibraryGame[] {
  const search = fold(filter.search?.trim() ?? "");
  const result = games.filter((g) => {
    if (g.hidden && !filter.showHidden) return false;
    if (search && !searchTextsOf(g).some((t) => t.includes(search))) return false;
    if (filter.platform && !g.platforms.includes(filter.platform)) return false;
    if (filter.device && !g.deviceKinds.includes(filter.device)) return false;
    if (filter.genre && !g.genres.includes(filter.genre)) return false;
    if (filter.status === "none" && g.status !== null) return false;
    if (filter.status && filter.status !== "none" && g.status !== filter.status) return false;
    if (filter.favorite && !g.favorite) return false;
    return true;
  });
  const compare = SORTS[filter.sort ?? "lastPlayed"] ?? SORTS.lastPlayed;
  return result.sort((a, b) => compare(a, b) || compareTitles(a.title, b.title));
}

/** Share of achievements unlocked; null for games without any. */
function achievementShare(game: LibraryGame): number | null {
  return game.achievements && game.achievements.total > 0 ? game.achievements.unlocked / game.achievements.total : null;
}

/** Higher first; games without a value (null) at the end. */
function descending(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

/** Sort orders; equal games are ordered by title. */
const SORTS: Record<SortKey, (a: LibraryGame, b: LibraryGame) => number> = {
  name: () => 0,
  playtime: (a, b) => b.totalMinutes - a.totalMinutes,
  // ISO timestamps: plain string order is time order (no locale rules needed).
  lastPlayed: (a, b) => {
    const la = a.lastPlayedAt ?? "";
    const lb = b.lastPlayedAt ?? "";
    return lb < la ? -1 : lb > la ? 1 : 0;
  },
  // Furthest first; games without achievements last.
  achievements: (a, b) => descending(achievementShare(a), achievementShare(b)),
  // Newest first; games without a known year last.
  releaseYear: (a, b) => descending(a.releaseYear, b.releaseYear),
};

export function allGenres(games: readonly LibraryGame[]): string[] {
  return [...new Set(games.flatMap((g) => g.genres))].sort(compareTitles);
}

const FILTER_TEXT_KEYS = ["search", "platform", "device", "genre", "status"] as const;

/**
 * A filter as stored in the browser (sessionStorage), checked field by field: anything unknown
 * or malformed is dropped, so an old or broken value never breaks the library.
 */
export function readStoredFilter(stored: string | null): LibraryFilter {
  const fallback: LibraryFilter = { sort: "lastPlayed" };
  if (!stored) return fallback;
  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    return fallback;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return fallback;
  const v = value as Record<string, unknown>;
  const out: LibraryFilter = { sort: SORT_KEYS.includes(v.sort as SortKey) ? (v.sort as SortKey) : "lastPlayed" };
  for (const key of FILTER_TEXT_KEYS) {
    if (typeof v[key] === "string") (out as Record<string, unknown>)[key] = v[key];
  }
  if (v.favorite === true) out.favorite = true;
  if (v.showHidden === true) out.showHidden = true;
  return out;
}
