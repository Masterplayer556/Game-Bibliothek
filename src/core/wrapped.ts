// «Game Bibliothek Wrapped»: the numbers of one calendar year (Europe/Zurich).
// Pure functions on top of the library model; the page only displays the result.
import { groupTwins } from "./achievements";
import { firstPlayedDay, newSinceTracking } from "./chronicle";
import {
  distribution,
  topGames,
  totalInRange,
  type AchievementRow,
  type GameDay,
  type Library,
  type Range,
  type RankedGame,
  type RawData,
  type Share,
  UNKNOWN_GENRE,
} from "./library";
import { addDays, toLocalDate } from "./time";
import type { LocalDate, PlatformId } from "./types";

export interface StreakResult {
  days: number;
  from: LocalDate;
  to: LocalDate;
  estimated: boolean;
}

export interface BestDay {
  date: LocalDate;
  minutes: number;
  estimated: boolean;
  /** Games of that day, most played first. */
  gameIds: string[];
}

export interface Rediscovered {
  gameId: string;
  minutesBefore: number;
  minutesInYear: number;
}

export interface CoverageGap {
  platform: PlatformId;
  since: LocalDate;
}

export interface WrappedYear {
  year: number;
  range: Range;
  totalMinutes: number;
  estimated: boolean;
  playDays: number;
  previousYear: { minutes: number; partial: boolean } | null;
  top: RankedGame[];
  favoritePlatform: Share | null;
  favoriteDevice: Share | null;
  favoriteGenre: Share | null;
  bestDay: BestDay | null;
  longestStreak: StreakResult | null;
  /** Games first played this year, among those new since tracking began (oldest first). */
  newGames: string[];
  achievements: { unlocked: number; rarest: (AchievementRow & { gameId: string }) | null };
  /** Games barely touched before the year that got real playtime in it. */
  rediscovered: Rediscovered[];
  /**
   * Platforms whose data starts after 1 January (or only after the year): their values for this
   * year are incomplete.
   */
  coverageGaps: CoverageGap[];
  /** Games finished this year («Durchgespielt am» in the year), in the order they were finished. */
  finished: string[];
  /** My best rated games among those played or finished this year, best first (at most 3). */
  topRated: { gameId: string; rating: number }[];
}

/**
 * «Durchgespielt» and «Bestbewertet» of a year, from «Meine Angaben». A rated game counts for
 * a year if it was played or finished in it; equal ratings go to the one played more that year.
 */
export function finishedAndRated(
  library: Pick<Library, "games" | "days">,
  range: Range,
  limit = 3,
): Pick<WrappedYear, "finished" | "topRated"> {
  const games = library.games.filter((g) => !g.hidden);
  const finished = games
    .filter((g) => g.completedOn && g.completedOn >= range.from && g.completedOn <= range.to)
    .sort((a, b) => a.completedOn!.localeCompare(b.completedOn!) || a.id.localeCompare(b.id))
    .map((g) => g.id);
  const minutes = new Map<string, number>();
  for (const d of library.days) {
    if (d.date >= range.from && d.date <= range.to) minutes.set(d.gameId, (minutes.get(d.gameId) ?? 0) + d.minutes);
  }
  const finishedSet = new Set(finished);
  const topRated = games
    .filter((g) => g.rating != null && (minutes.has(g.id) || finishedSet.has(g.id)))
    .sort((a, b) => b.rating! - a.rating! || (minutes.get(b.id) ?? 0) - (minutes.get(a.id) ?? 0) || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((g) => ({ gameId: g.id, rating: g.rating! }));
  return { finished, topRated };
}

/** «Barely touched» before the year means less than this; «real playtime» means past it. */
export const REDISCOVER_MINUTES = 60;

export function yearRange(year: number, today: LocalDate): Range {
  const from = `${year}-01-01`;
  const end = `${year}-12-31`;
  return { from, to: end < today ? end : today };
}

/** The review of the running year opens in this month (December). */
export const CURRENT_YEAR_OPENS_IN_MONTH = 12;

/**
 * Years that have at least one played day, newest first. The running year only appears
 * from December on, so the review is not shown while most of the year is still ahead.
 */
export function availableYears(days: readonly GameDay[], today: LocalDate): number[] {
  const currentYear = Number(today.slice(0, 4));
  const currentOpen = Number(today.slice(5, 7)) >= CURRENT_YEAR_OPENS_IN_MONTH;
  return [...new Set(days.map((d) => Number(d.date.slice(0, 4))))]
    .filter((y) => y < currentYear || (y === currentYear && currentOpen))
    .sort((a, b) => b - a);
}

export function longestStreak(days: readonly GameDay[], range: Range): StreakResult | null {
  const estimatedByDate = new Map<LocalDate, boolean>();
  for (const d of days) {
    if (d.date < range.from || d.date > range.to) continue;
    estimatedByDate.set(d.date, (estimatedByDate.get(d.date) ?? false) || d.estimated);
  }
  const dates = [...estimatedByDate.keys()].sort();
  let best: StreakResult | null = null;
  let start = 0;
  for (let i = 0; i < dates.length; i++) {
    const breaks = i + 1 === dates.length || addDays(dates[i]!, 1) !== dates[i + 1];
    if (!breaks) continue;
    const length = i - start + 1;
    if (!best || length > best.days) {
      const slice = dates.slice(start, i + 1);
      best = { days: length, from: slice[0]!, to: slice.at(-1)!, estimated: slice.some((d) => estimatedByDate.get(d)) };
    }
    start = i + 1;
  }
  return best;
}

export function bestDay(days: readonly GameDay[], range: Range): BestDay | null {
  const byDate = new Map<LocalDate, { minutes: number; estimated: boolean; games: Map<string, number> }>();
  for (const d of days) {
    if (d.date < range.from || d.date > range.to) continue;
    const entry = byDate.get(d.date) ?? { minutes: 0, estimated: false, games: new Map<string, number>() };
    entry.minutes += d.minutes;
    entry.estimated ||= d.estimated;
    entry.games.set(d.gameId, (entry.games.get(d.gameId) ?? 0) + d.minutes);
    byDate.set(d.date, entry);
  }
  let best: BestDay | null = null;
  for (const [date, e] of byDate) {
    if (!best || e.minutes > best.minutes || (e.minutes === best.minutes && date < best.date)) {
      best = {
        date,
        minutes: e.minutes,
        estimated: e.estimated,
        gameIds: [...e.games.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id),
      };
    }
  }
  return best;
}

/**
 * Achievements unlocked in the range, counted like «Zusammen» on the achievements page: the
 * same achievement of one game on PC and PlayStation is one achievement, unlocked on the day
 * of its first unlock. A row listed twice counts once.
 */
export function achievementsInYear(
  library: Pick<Library, "games">,
  achievements: readonly AchievementRow[],
  range: Range,
): WrappedYear["achievements"] {
  const games = library.games.filter((g) => !g.hidden);
  const entryToGame = new Map(games.flatMap((g) => g.entries.map((e) => [e.id, g.id] as const)));
  const platformOf = new Map(games.flatMap((g) => g.entries.map((e) => [e.id, e.platform] as const)));
  const byGame = new Map<string, AchievementRow[]>();
  const seen = new Set<string>();
  for (const a of achievements) {
    const gameId = entryToGame.get(a.platform_game_id);
    const id = `${a.platform_game_id}|${a.external_id}`;
    if (!gameId || seen.has(id)) continue;
    seen.add(id);
    const list = byGame.get(gameId) ?? [];
    list.push(a);
    byGame.set(gameId, list);
  }

  let unlocked = 0;
  let rarest: (AchievementRow & { gameId: string }) | null = null;
  for (const [gameId, rows] of byGame) {
    for (const { rows: twins } of groupTwins(rows, platformOf)) {
      const done = twins.map((t) => t.row).filter((r) => r.unlocked_at);
      if (done.length === 0) continue;
      const first = done.reduce((a, b) => (b.unlocked_at! < a.unlocked_at! ? b : a));
      const date = toLocalDate(first.unlocked_at!);
      if (date < range.from || date > range.to) continue;
      unlocked++;
      // The share of players on a platform where I have it, not on one where it is still locked.
      for (const r of done) {
        if (r.rarity_percent != null && (!rarest || r.rarity_percent < (rarest.rarity_percent ?? Infinity))) {
          rarest = { ...r, gameId };
        }
      }
    }
  }
  return { unlocked, rarest };
}

export function buildWrapped(
  library: Library,
  raw: Pick<RawData, "achievements" | "daily" | "snapshots">,
  year: number,
  options: { today: LocalDate; rediscoverMinutes?: number },
): WrappedYear {
  const range = yearRange(year, options.today);
  const { days, byId } = library;
  const total = totalInRange(days, range);
  const playDays = new Set(days.filter((d) => d.date >= range.from && d.date <= range.to).map((d) => d.date)).size;

  // Previous year, and whether it was fully tracked: only if every platform was tracked from
  // its first day. One platform with old data (an imported history) does not make up for
  // another one that only started later.
  const previousRange = yearRange(year - 1, options.today);
  const previousTotal = totalInRange(days, previousRange);
  const since = Object.entries(library.dataSince) as [PlatformId, LocalDate][];
  const firstTracked = since.length > 0 ? since.map(([, d]) => d).sort()[0]! : null;
  const previousYear =
    firstTracked && firstTracked <= previousRange.to
      ? { minutes: previousTotal.minutes, partial: since.some(([, d]) => d > previousRange.from) }
      : null;

  const genres = distribution(days, range, "genre", byId).filter((s) => s.key !== UNKNOWN_GENRE);

  // Games first played this year, like «Erstmals gespielt» in the Chronik: only games that are
  // new since tracking began. A game that already had playtime at the first sync is not new,
  // even if the platform dates its first day (or the first synced day) into this year.
  const fresh = newSinceTracking(library, raw);
  const newGames = library.games
    .filter((g) => !g.hidden && fresh.has(g.id))
    .map((g) => ({ id: g.id, start: firstPlayedDay(g, days) }))
    .filter((g): g is { id: string; start: LocalDate } => !!g.start && g.start >= range.from && g.start <= range.to)
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
    .map((g) => g.id);

  // Achievements unlocked this year and the rarest of them
  const { unlocked, rarest } = achievementsInYear(library, raw.achievements, range);

  // Rediscovered: started before the year but stayed below the threshold, and crossed it
  // during the year. Games never played before 1 January are left out: without a purchase
  // date they cannot be told apart from games bought this year (those are «new games»).
  const minutesInYear = new Map<string, number>();
  const minutesAfterYear = new Map<string, number>();
  for (const d of days) {
    if (d.date >= range.from && d.date <= range.to) minutesInYear.set(d.gameId, (minutesInYear.get(d.gameId) ?? 0) + d.minutes);
    if (d.date > range.to) minutesAfterYear.set(d.gameId, (minutesAfterYear.get(d.gameId) ?? 0) + d.minutes);
  }
  const threshold = options.rediscoverMinutes ?? REDISCOVER_MINUTES;
  const rediscovered: Rediscovered[] = [];
  const isNew = new Set(newGames);
  for (const g of library.games) {
    // A new game has no time «before»; any it seems to have is undated time, not a comeback.
    if (g.hidden || !g.owned || isNew.has(g.id)) continue;
    const inYear = minutesInYear.get(g.id) ?? 0;
    if (inYear === 0) continue;
    const before = Math.max(0, g.totalMinutes - inYear - (minutesAfterYear.get(g.id) ?? 0));
    if (before > 0 && before < threshold && before + inYear >= threshold) {
      rediscovered.push({ gameId: g.id, minutesBefore: before, minutesInYear: inYear });
    }
  }
  rediscovered.sort((a, b) => b.minutesInYear - a.minutesInYear);

  // Platforms tracked only from a later day, also those that started after the year: the year
  // has none of their time.
  const coverageGaps = since
    .filter(([, d]) => d > range.from)
    .map(([platform, d]) => ({ platform, since: d }))
    .sort((a, b) => a.since.localeCompare(b.since));

  return {
    year,
    range,
    totalMinutes: total.minutes,
    estimated: total.estimated,
    playDays,
    previousYear,
    top: topGames(days, range, 5),
    favoritePlatform: distribution(days, range, "platform", byId)[0] ?? null,
    favoriteDevice: distribution(days, range, "device", byId)[0] ?? null,
    favoriteGenre: genres[0] ?? null,
    bestDay: bestDay(days, range),
    longestStreak: longestStreak(days, range),
    newGames,
    achievements: { unlocked, rarest },
    rediscovered,
    coverageGaps,
    ...finishedAndRated(library, range),
  };
}
