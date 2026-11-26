// The library list: search, filters and sort order.
import type { DeviceKind, GameStatus, PlatformId } from "../types";
import type { LibraryGame } from "./model";

export type SortKey = "lastPlayed" | "playtime" | "name";

export interface LibraryFilter {
  search?: string;
  platform?: PlatformId | "";
  device?: DeviceKind | "";
  genre?: string;
  status?: GameStatus | "none" | "";
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
    return true;
  });
  const sort = filter.sort ?? "lastPlayed";
  return result.sort((a, b) => {
    if (sort === "name") return compareTitles(a.title, b.title);
    if (sort === "playtime") return b.totalMinutes - a.totalMinutes || compareTitles(a.title, b.title);
    // ISO timestamps: plain string order is time order (no locale rules needed).
    const la = a.lastPlayedAt ?? "";
    const lb = b.lastPlayedAt ?? "";
    return (lb < la ? -1 : lb > la ? 1 : 0) || compareTitles(a.title, b.title);
  });
}

export function allGenres(games: readonly LibraryGame[]): string[] {
  return [...new Set(games.flatMap((g) => g.genres))].sort(compareTitles);
}
