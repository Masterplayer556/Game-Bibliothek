// The visible part of a long playtime history: a fixed number of bars that can be moved
// back and forth in time. `offset` counts buckets from the newest one (0 = ends today).
import { bucketKey, bucketStart, type Bucket, type SeriesPoint } from "./library";
import { addDays } from "./time";

/** Bars shown at once, per bucket. Chosen so a phone screen stays readable. */
export const WINDOW_SIZE: Record<Bucket, number> = { day: 31, week: 26, month: 12, year: 10 };

export function maxOffset(total: number, size: number): number {
  return Math.max(0, total - size);
}

export function clampOffset(offset: number, total: number, size: number): number {
  return Math.min(Math.max(0, Math.round(offset)), maxOffset(total, size));
}

/** [start, end) of the visible bars. */
export function windowBounds(total: number, size: number, offset: number): [number, number] {
  const end = total - clampOffset(offset, total, size);
  return [Math.max(0, end - size), end];
}

/**
 * Offset that keeps the same point in time at the right edge after switching the bucket:
 * a look at March 2024 by month stays at March 2024 by week.
 */
export function offsetKeepingEnd(
  current: readonly SeriesPoint[],
  currentBucket: Bucket,
  currentOffset: number,
  next: readonly SeriesPoint[],
  nextBucket: Bucket,
): number {
  if (current.length === 0 || next.length === 0) return 0;
  const [, end] = windowBounds(current.length, WINDOW_SIZE[currentBucket], currentOffset);
  const lastVisible = current[end - 1];
  if (!lastVisible) return 0;
  // The last day of the visible range decides: for a week that is its Sunday, and so on.
  const following = current[end];
  const endDate = following ? addDays(bucketStart(following.key, currentBucket), -1) : null;
  if (!endDate) return 0; // the window already ends today
  const key = bucketKey(endDate, nextBucket);
  const index = next.findIndex((p) => p.key === key);
  if (index === -1) return 0;
  return clampOffset(next.length - 1 - index, next.length, WINDOW_SIZE[nextBucket]);
}

