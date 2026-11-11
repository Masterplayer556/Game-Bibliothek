// «Game Bibliothek Wrapped»: the numbers of one calendar year (Europe/Zurich).
// Pure functions on top of the library model; the page only displays the result.
import {
  distribution,
  topGames,
  totalInRange,
  type AchievementRow,
  type GameDay,
  type Library,
  type Range,
  type RankedGame,
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

export interface PileExit {
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
  newGames: string[];
  achievements: { unlocked: number; rarest: (AchievementRow & { gameId: string }) | null };
  pileExits: PileExit[];
  /** Platforms whose data starts after 1 January: their values for this year are incomplete. */
  coverageGaps: CoverageGap[];
}

export function yearRange(year: number, today: LocalDate): Range {
  const from = `${year}-01-01`;
  const end = `${year}-12-31`;
  return { from, to: end < today ? end : today };
}

/** Years that have at least one played day, newest first. */
export function availableYears(days: readonly GameDay[]): number[] {
  return [...new Set(days.map((d) => Number(d.date.slice(0, 4))))].sort((a, b) => b - a);
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

export function buildWrapped(
  library: Library,
  achievements: readonly AchievementRow[],
  year: number,
  options: { today: LocalDate; pileThresholdMinutes: number },
): WrappedYear {
  const range = yearRange(year, options.today);
  const { days, byId } = library;
  const total = totalInRange(days, range);
  const playDays = new Set(days.filter((d) => d.date >= range.from && d.date <= range.to).map((d) => d.date)).size;

  // Previous year, and whether it was fully tracked
  const previousRange = yearRange(year - 1, options.today);
  const previousTotal = totalInRange(days, previousRange);
  const sinceDates = Object.values(library.dataSince);
  const firstTracked = sinceDates.length > 0 ? sinceDates.sort()[0]! : null;
  const previousYear =
    firstTracked && firstTracked <= previousRange.to
      ? { minutes: previousTotal.minutes, partial: firstTracked > previousRange.from }
      : null;

  const genres = distribution(days, range, "genre", byId).filter((s) => s.key !== UNKNOWN_GENRE);

  // Games first played this year (on any platform)
  const newGames = library.games
    .filter((g) => !g.hidden && g.firstPlayedAt && toLocalDate(g.firstPlayedAt) >= range.from && toLocalDate(g.firstPlayedAt) <= range.to)
    .sort((a, b) => (a.firstPlayedAt ?? "").localeCompare(b.firstPlayedAt ?? ""))
    .map((g) => g.id);

  // Achievements unlocked this year and the rarest of them
  const entryToGame = new Map(library.games.filter((g) => !g.hidden).flatMap((g) => g.entries.map((e) => [e.id, g.id] as const)));
  let unlocked = 0;
  let rarest: (AchievementRow & { gameId: string }) | null = null;
  for (const a of achievements) {
    if (!a.unlocked_at) continue;
    const gameId = entryToGame.get(a.platform_game_id);
    const date = toLocalDate(a.unlocked_at);
    if (!gameId || date < range.from || date > range.to) continue;
    unlocked++;
    if (a.rarity_percent != null && (!rarest || a.rarity_percent < (rarest.rarity_percent ?? Infinity))) {
      rarest = { ...a, gameId };
    }
  }

  // Out of the pile: started before the year but stayed below the threshold, and crossed it
  // during the year. Games never played before 1 January are left out: without a purchase
  // date they cannot be told apart from games bought this year (those are «new games»).
  const minutesInYear = new Map<string, number>();
  const minutesAfterYear = new Map<string, number>();
  for (const d of days) {
    if (d.date >= range.from && d.date <= range.to) minutesInYear.set(d.gameId, (minutesInYear.get(d.gameId) ?? 0) + d.minutes);
    if (d.date > range.to) minutesAfterYear.set(d.gameId, (minutesAfterYear.get(d.gameId) ?? 0) + d.minutes);
  }
  const pileExits: PileExit[] = [];
  for (const g of library.games) {
    if (g.hidden || !g.owned) continue;
    const inYear = minutesInYear.get(g.id) ?? 0;
    if (inYear === 0) continue;
    const before = Math.max(0, g.totalMinutes - inYear - (minutesAfterYear.get(g.id) ?? 0));
    if (before > 0 && before < options.pileThresholdMinutes && before + inYear >= options.pileThresholdMinutes) {
      pileExits.push({ gameId: g.id, minutesBefore: before, minutesInYear: inYear });
    }
  }
  pileExits.sort((a, b) => b.minutesInYear - a.minutesInYear);

  const coverageGaps = (Object.entries(library.dataSince) as [PlatformId, LocalDate][])
    .filter(([, since]) => since > range.from && since <= range.to)
    .map(([platform, since]) => ({ platform, since }))
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
    pileExits,
    coverageGaps,
  };
}
