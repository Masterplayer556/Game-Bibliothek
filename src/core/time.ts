// All day/week/month maths happens in Europe/Zurich. Timestamps in the database are UTC.
import type { LocalDate } from "./types";

export const APP_TIME_ZONE = "Europe/Zurich";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar date (YYYY-MM-DD) of an instant, as seen in Europe/Zurich. */
export function toLocalDate(instant: Date | string | number): LocalDate {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return dateFormatter.format(date);
}

function parse(date: LocalDate): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid local date: ${date}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function format(date: Date): LocalDate {
  return date.toISOString().slice(0, 10);
}

/** Pure calendar arithmetic: no time zone involved. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return format(d);
}

export function diffDays(from: LocalDate, to: LocalDate): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
}

/** Monday of the week the date belongs to. */
export function weekStart(date: LocalDate): LocalDate {
  const weekday = parse(date).getUTCDay(); // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7));
}

/** YYYY-MM */
export function monthKey(date: LocalDate): string {
  return date.slice(0, 7);
}

export function yearOf(date: LocalDate): number {
  return Number(date.slice(0, 4));
}

/** Inclusive list of dates. */
export function dateRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
