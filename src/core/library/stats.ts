// Statistics over played days: totals, rankings and shares in a date range or over everything.
import { addDays } from "../time";
import type { DeviceKind, LocalDate, PlatformId } from "../types";
import type { GameDay, LibraryGame } from "./model";

export interface Range {
  from: LocalDate;
  to: LocalDate;
}

export function inRange(date: LocalDate, range: Range): boolean {
  return date >= range.from && date <= range.to;
}

/**
 * Setting «App-Zeit mitzählen» (`countAppsInTotal`): the time in apps (YouTube, Pokémon HOME …)
 * is added to the total playtime figures. Lists, charts and rankings stay games only.
 */
export function countsAppsInTotal(settings: Record<string, unknown>): boolean {
  return settings.countAppsInTotal === true;
}

export function totalInRange(days: readonly GameDay[], range: Range): { minutes: number; estimated: boolean } {
  let minutes = 0;
  let estimated = false;
  for (const d of days) {
    if (!inRange(d.date, range)) continue;
    minutes += d.minutes;
    estimated ||= d.estimated;
  }
  return { minutes, estimated };
}

export interface RankedGame {
  gameId: string;
  minutes: number;
  estimated: boolean;
}

/** Most played games in a range, by summed day minutes. */
export function topGames(days: readonly GameDay[], range: Range, limit: number): RankedGame[] {
  const byGame = new Map<string, RankedGame>();
  for (const d of days) {
    if (!inRange(d.date, range)) continue;
    const entry = byGame.get(d.gameId) ?? { gameId: d.gameId, minutes: 0, estimated: false };
    entry.minutes += d.minutes;
    entry.estimated ||= d.estimated;
    byGame.set(d.gameId, entry);
  }
  return [...byGame.values()].sort((a, b) => b.minutes - a.minutes).slice(0, limit);
}

export type Grouping = "platform" | "device" | "genre";

export interface Share {
  key: string;
  minutes: number;
}

export const UNKNOWN_GENRE = "Unbekannt";

/**
 * Minutes per platform, device or genre. A game with several genres counts fully for each
 * of them (so genre shares can add up to more than 100 %).
 */
export function distribution(
  days: readonly GameDay[],
  range: Range,
  by: Grouping,
  byId: ReadonlyMap<string, LibraryGame>,
): Share[] {
  const totals = new Map<string, number>();
  const add = (key: string, minutes: number) => totals.set(key, (totals.get(key) ?? 0) + minutes);
  for (const d of days) {
    if (!inRange(d.date, range)) continue;
    if (by === "platform") add(d.platform, d.minutes);
    else if (by === "device") add(d.deviceKind, d.minutes);
    else {
      const genres = byId.get(d.gameId)?.genres ?? [];
      if (genres.length === 0) add(UNKNOWN_GENRE, d.minutes);
      for (const g of genres) add(g, d.minutes);
    }
  }
  return [...totals.entries()]
    .map(([key, minutes]) => ({ key, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Lifetime minutes per platform, from the platform totals (includes time before tracking). */
export function lifetimeByPlatform(games: readonly LibraryGame[]): Share[] {
  const totals = new Map<string, number>();
  for (const g of games) {
    if (g.hidden) continue;
    for (const e of g.entries) totals.set(e.platform, (totals.get(e.platform) ?? 0) + e.totalMinutes);
  }
  return [...totals.entries()]
    .map(([key, minutes]) => ({ key, minutes }))
    .filter((s) => s.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
}

/**
 * Time a platform reports in its lifetime total that no day accounts for: everything played
 * before the first sync (e.g. years on the PlayStation). It has no date, so it only counts
 * where no date is needed («Alles»).
 */
export interface UndatedTime {
  gameId: string;
  platform: PlatformId;
  deviceKind: DeviceKind;
  minutes: number;
}

export function undatedTime(
  games: readonly LibraryGame[],
  days: readonly GameDay[],
  /** "apps": the time of entries marked «Kein Spiel» instead (with `library.appDays`). */
  which: "games" | "apps" = "games",
): UndatedTime[] {
  const dated = new Map<string, number>();
  const kinds = new Map<string, Map<DeviceKind, number>>();
  for (const d of days) {
    dated.set(d.platformGameId, (dated.get(d.platformGameId) ?? 0) + d.minutes);
    const byKind = kinds.get(d.platformGameId) ?? new Map<DeviceKind, number>();
    byKind.set(d.deviceKind, (byKind.get(d.deviceKind) ?? 0) + d.minutes);
    kinds.set(d.platformGameId, byKind);
  }
  const out: UndatedTime[] = [];
  for (const game of games) {
    if (game.hidden !== (which === "apps")) continue;
    for (const entry of game.entries) {
      const minutes = entry.totalMinutes - (dated.get(entry.id) ?? 0);
      if (minutes <= 0) continue;
      // The console is the entry's own, else the one its dated days were mostly played on.
      const mostUsed = [...(kinds.get(entry.id) ?? [])].sort((a, b) => b[1] - a[1])[0]?.[0];
      out.push({ gameId: game.id, platform: entry.platform, deviceKind: entry.deviceKind ?? mostUsed ?? "other", minutes });
    }
  }
  return out;
}

/** Most played games over everything: all days plus the time without a date. */
export function lifetimeTopGames(days: readonly GameDay[], undated: readonly UndatedTime[], limit: number): RankedGame[] {
  const byGame = new Map<string, RankedGame>();
  const add = (gameId: string, minutes: number, estimated: boolean) => {
    const entry = byGame.get(gameId) ?? { gameId, minutes: 0, estimated: false };
    entry.minutes += minutes;
    entry.estimated ||= estimated;
    byGame.set(gameId, entry);
  };
  for (const d of days) add(d.gameId, d.minutes, d.estimated);
  for (const u of undated) add(u.gameId, u.minutes, false);
  return [...byGame.values()].sort((a, b) => b.minutes - a.minutes).slice(0, limit);
}

/** Like `distribution`, over everything: all days plus the time without a date. */
export function lifetimeDistribution(
  days: readonly GameDay[],
  undated: readonly UndatedTime[],
  by: Grouping,
  byId: ReadonlyMap<string, LibraryGame>,
): Share[] {
  const totals = new Map<string, number>();
  const add = (key: string, minutes: number) => totals.set(key, (totals.get(key) ?? 0) + minutes);
  for (const row of [...days, ...undated]) {
    if (by === "platform") add(row.platform, row.minutes);
    else if (by === "device") add(row.deviceKind, row.minutes);
    else {
      const genres = byId.get(row.gameId)?.genres ?? [];
      if (genres.length === 0) add(UNKNOWN_GENRE, row.minutes);
      for (const g of genres) add(g, row.minutes);
    }
  }
  return [...totals.entries()]
    .map(([key, minutes]) => ({ key, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

export function rangeEndingToday(today: LocalDate, days: number): Range {
  return { from: addDays(today, -(days - 1)), to: today };
}
