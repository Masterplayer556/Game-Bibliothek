// The period chosen under «Statistiken» and its totals (with or without the time in apps).
import { addDays } from "../time";
import type { LocalDate } from "../types";
import type { Library } from "./model";
import { totalInRange, undatedTime, type Range, type UndatedTime } from "./stats";

export type RangeKey = "30d" | "3m" | "6m" | "12m" | "year" | "all";
export const RANGE_KEYS: readonly RangeKey[] = ["30d", "3m", "6m", "12m", "year", "all"];

/** The days of a period, up to today. «all» starts on the first played day (or today). */
export function rangeFor(key: RangeKey, today: LocalDate, firstDay: LocalDate | undefined): Range {
  switch (key) {
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "3m":
      return { from: addDays(today, -91), to: today };
    case "6m":
      return { from: addDays(today, -182), to: today };
    case "12m":
      return { from: addDays(today, -364), to: today };
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case "all":
      return { from: firstDay ?? today, to: today };
  }
}

export interface PeriodTotals {
  /** Time without a date (before the first sync), only for «everything». */
  undated: UndatedTime[];
  undatedMinutes: number;
  /** Time in apps (dated, plus undated for «everything»). */
  appMinutes: number;
  /** The playtime shown: games, plus apps if they count. */
  total: { minutes: number; estimated: boolean };
  /** Days with game time in the range. */
  playedDays: number;
}

/**
 * Totals of a period. «everything» also counts what was played before the first sync: the
 * platforms report it in their totals, but without a date. With `withApps` («App-Zeit
 * mitzählen») the time in apps is added to the total; everything else stays games only.
 */
export function periodTotals(
  library: Pick<Library, "games" | "days" | "appDays">,
  range: Range,
  everything: boolean,
  withApps: boolean,
): PeriodTotals {
  const undated = everything ? undatedTime(library.games, library.days) : [];
  const undatedMinutes = undated.reduce((sum, u) => sum + u.minutes, 0);
  const dated = totalInRange(library.days, range);
  const appDated = totalInRange(library.appDays, range);
  const appUndated = everything ? undatedTime(library.games, library.appDays, "apps").reduce((sum, u) => sum + u.minutes, 0) : 0;
  const appMinutes = appDated.minutes + appUndated;
  const total = withApps
    ? { minutes: dated.minutes + undatedMinutes + appMinutes, estimated: dated.estimated || appDated.estimated }
    : { minutes: dated.minutes + undatedMinutes, estimated: dated.estimated };
  const playedDays = new Set(library.days.filter((d) => d.date >= range.from && d.date <= range.to).map((d) => d.date)).size;
  return { undated, undatedMinutes, appMinutes, total, playedDays };
}
