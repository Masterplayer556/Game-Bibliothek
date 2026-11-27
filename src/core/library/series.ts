// Playtime over time: minutes per day, week, month or year.
import { addDays, monthKey, weekStart } from "../time";
import type { LocalDate } from "../types";
import type { GameDay } from "./model";
import { inRange, type Range } from "./stats";

export type Bucket = "day" | "week" | "month" | "year";

export interface SeriesPoint {
  /** The day (YYYY-MM-DD), Monday of the week, YYYY-MM or YYYY */
  key: string;
  minutes: number;
  /** Part of `minutes` that is estimated («Für kurze Zeit», gaps between snapshots). */
  estimatedMinutes: number;
  /** Mostly estimated: at least half of the time. One short day does not mark a whole year. */
  estimated: boolean;
}

/** Key of the bucket a day falls into (see SeriesPoint.key). */
export function bucketKey(date: LocalDate, bucket: Bucket): string {
  if (bucket === "day") return date;
  if (bucket === "week") return weekStart(date);
  if (bucket === "month") return monthKey(date);
  return date.slice(0, 4);
}

/** First day of the bucket after the one that starts on `start`. */
function nextBucketStart(start: LocalDate, bucket: Bucket): LocalDate {
  if (bucket === "day") return addDays(start, 1);
  if (bucket === "week") return addDays(start, 7);
  const [y, m] = [Number(start.slice(0, 4)), Number(start.slice(5, 7))];
  if (bucket === "year") return `${y + 1}-01-01`;
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** First day of a bucket, from its key. */
export function bucketStart(key: string, bucket: Bucket): LocalDate {
  if (bucket === "month") return `${key}-01`;
  if (bucket === "year") return `${key}-01-01`;
  return key;
}

/** Minutes per bucket from range.from to range.to, empty buckets included. */
export function playtimeSeries(days: readonly GameDay[], range: Range, bucket: Bucket): SeriesPoint[] {
  const points = new Map<string, SeriesPoint>();
  for (let d = bucketStart(bucketKey(range.from, bucket), bucket); d <= range.to; d = nextBucketStart(d, bucket)) {
    const key = bucketKey(d, bucket);
    points.set(key, { key, minutes: 0, estimatedMinutes: 0, estimated: false });
  }
  for (const d of days) {
    if (!inRange(d.date, range)) continue;
    const point = points.get(bucketKey(d.date, bucket));
    if (!point) continue;
    point.minutes += d.minutes;
    if (d.estimated) point.estimatedMinutes += d.minutes;
  }
  for (const point of points.values()) point.estimated = point.minutes > 0 && point.estimatedMinutes * 2 >= point.minutes;
  return [...points.values()];
}
