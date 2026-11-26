// Playtime rules. This is where most mistakes happen, so everything here is pure and tested.
//
// 1. The first snapshot of a game is only a starting value, unless the game first shows up
//    after its platform's tracking began (bought or first played since): then it started at
//    0 and its first total is played time (see addStartingBaselines).
// 2. The difference between two snapshots is played time. Negative differences count as 0
//    and are reported.
// 3. A difference is assigned to the day of `lastPlayedAt` if that lies between the two
//    snapshots, otherwise to the day of the later snapshot. Snapshots are only stored when
//    the total changes, so a long gap between two of them is normal and not uncertain in
//    itself. A day is flagged as estimated only when the platform did not say when it was
//    played (no `lastPlayedAt` inside the interval) and the gap is over 48 hours.
//    Time is not spread across days (that would invent play days), unless it cannot have
//    fitted into that day: more minutes than the day has between the two snapshots (a sync
//    gap of several days). Then it goes evenly onto the fewest days before it that can hold
//    it, all marked as estimated (see spreadOverGap).
// 4. Real per-day data wins over snapshots. The two are never added together.
// 5. Overlapping per-day sources: an import (Nintendo Store history) is a per-game, per-day
//    value without a reliable device. If any native source has data for the same game and
//    day, the import row is ignored. "Same game" means the same cross-platform game
//    (`gameKey`), because an import and a native source may have created separate platform
//    entries for it.
// 6. Days, weeks (Monday start) and months are Europe/Zurich.
import { addDays, localDayStart, monthKey, toLocalDate, weekStart } from "../time";
import type { LocalDate } from "../types";

export interface SnapshotRow {
  platformGameId: string;
  takenAt: string;
  totalMinutes: number;
  /** `last played` as reported by the platform when the snapshot was taken. */
  lastPlayedAt?: string | null;
}

export interface DailyRow {
  platformGameId: string;
  /**
   * Groups platform entries that are the same game for rule 5 (use the id of the linked
   * game). Defaults to the platform entry itself.
   */
  gameKey?: string | null;
  deviceId: string | null;
  date: LocalDate;
  minutes: number;
  source: string;
  estimated?: boolean;
}

export interface PlayedDay {
  platformGameId: string;
  deviceId: string | null;
  date: LocalDate;
  minutes: number;
  estimated: boolean;
  origin: "daily" | "snapshot";
}

export interface PlaytimeWarning {
  platformGameId: string;
  kind: "negative_delta";
  at: string;
  minutes: number;
}

export const ESTIMATE_GAP_MS = 48 * 60 * 60 * 1000;

/** Rule 1–3: turn the snapshots of ONE game into played days. */
export function snapshotsToDays(snapshots: readonly SnapshotRow[]): {
  days: PlayedDay[];
  warnings: PlaytimeWarning[];
} {
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime(),
  );
  const byDate = new Map<LocalDate, PlayedDay>();
  const warnings: PlaytimeWarning[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const delta = cur.totalMinutes - prev.totalMinutes;
    if (delta < 0) {
      warnings.push({
        platformGameId: cur.platformGameId,
        kind: "negative_delta",
        at: cur.takenAt,
        minutes: delta,
      });
      continue;
    }
    if (delta === 0) continue;

    const prevTime = new Date(prev.takenAt).getTime();
    const curTime = new Date(cur.takenAt).getTime();
    const lastPlayed = cur.lastPlayedAt ? new Date(cur.lastPlayedAt).getTime() : NaN;
    const lastPlayedInside = lastPlayed > prevTime && lastPlayed <= curTime;
    const date = toLocalDate(lastPlayedInside ? lastPlayed : curTime);
    const estimated = !lastPlayedInside && curTime - prevTime > ESTIMATE_GAP_MS;

    for (const part of spreadOverGap(delta, date, prevTime, curTime)) {
      const existing = byDate.get(part.date);
      if (existing) {
        existing.minutes += part.minutes;
        existing.estimated = existing.estimated || estimated || part.spread;
      } else {
        byDate.set(part.date, {
          platformGameId: cur.platformGameId,
          deviceId: null,
          date: part.date,
          minutes: part.minutes,
          estimated: estimated || part.spread,
          origin: "snapshot",
        });
      }
    }
  }
  return { days: [...byDate.values()], warnings };
}

/**
 * Rule 3, the exception: `minutes` played between `fromMs` and `toMs` belong to `date`, unless
 * that day does not have that many minutes between the two. Then they are shared evenly by the
 * fewest days up to `date` (back to the day of `fromMs`) that can hold them, each day at most
 * the minutes it has in the interval. `spread` marks the days of a shared value.
 */
export function spreadOverGap(
  minutes: number,
  date: LocalDate,
  fromMs: number,
  toMs: number,
): { date: LocalDate; minutes: number; spread: boolean }[] {
  const room = (day: LocalDate) =>
    Math.max(0, Math.floor((Math.min(toMs, localDayStart(addDays(day, 1))) - Math.max(fromMs, localDayStart(day))) / 60_000));
  if (minutes <= room(date)) return [{ date, minutes, spread: false }];

  const first = toLocalDate(fromMs);
  const days: { date: LocalDate; room: number }[] = [];
  let total = 0;
  for (let day = date; ; day = addDays(day, -1)) {
    days.push({ date: day, room: room(day) });
    total += days.at(-1)!.room;
    if (total >= minutes || day <= first) break;
  }
  // Evenly, but no day over its room: the small days are filled first, the rest is shared.
  const share = new Map<LocalDate, number>();
  let left = minutes;
  const byRoom = [...days].sort((a, b) => a.room - b.room);
  byRoom.forEach((day, i) => {
    const even = Math.floor(left / (byRoom.length - i));
    const given = Math.min(day.room, even);
    share.set(day.date, given);
    left -= given;
  });
  // Rounding leftovers (and time that fits nowhere, if the data is impossible) go to the latest day.
  share.set(date, share.get(date)! + left);
  return days
    .map((d) => ({ date: d.date, minutes: share.get(d.date)!, spread: true }))
    .filter((d) => d.minutes > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Rule 1, second half: an entry whose first snapshot comes from a later sync than its
 * platform's first one did not exist when tracking began, so it started at 0. A snapshot of
 * 0 minutes is added at the platform's last snapshot before it (the latest moment the entry is
 * known to have been missing); rules 2 and 3 then date its first total like any other
 * difference. Not when the platform says it was played before tracking began (last or first
 * played before the platform's first snapshot): that time is old, not a session.
 */
export function addStartingBaselines(
  snapshots: readonly SnapshotRow[],
  /** The platform of an entry; entries without one get no baseline. */
  platformOf: (platformGameId: string) => string | undefined,
  /** First played as reported by the platform, if known. */
  firstPlayedAt: (platformGameId: string) => string | null | undefined = () => null,
): SnapshotRow[] {
  const timesByPlatform = new Map<string, number[]>();
  const firstByEntry = new Map<string, SnapshotRow>();
  for (const s of snapshots) {
    const platform = platformOf(s.platformGameId);
    if (!platform) continue;
    const times = timesByPlatform.get(platform) ?? [];
    times.push(new Date(s.takenAt).getTime());
    timesByPlatform.set(platform, times);
    const first = firstByEntry.get(s.platformGameId);
    if (!first || new Date(s.takenAt).getTime() < new Date(first.takenAt).getTime()) firstByEntry.set(s.platformGameId, s);
  }
  for (const times of timesByPlatform.values()) times.sort((a, b) => a - b);

  const baselines: SnapshotRow[] = [];
  for (const [entryId, first] of firstByEntry) {
    if (first.totalMinutes <= 0) continue;
    const times = timesByPlatform.get(platformOf(entryId)!)!;
    const at = new Date(first.takenAt).getTime();
    const trackingStart = times[0]!;
    if (at <= trackingStart) continue;
    const playedBefore = [first.lastPlayedAt, firstPlayedAt(entryId)].some(
      (t) => t && new Date(t).getTime() < trackingStart,
    );
    if (playedBefore) continue;
    let previous = trackingStart;
    for (const t of times) {
      if (t >= at) break;
      previous = t;
    }
    baselines.push({ platformGameId: entryId, takenAt: new Date(previous).toISOString(), totalMinutes: 0, lastPlayedAt: null });
  }
  return baselines.length > 0 ? [...snapshots, ...baselines] : [...snapshots];
}

/** Imports rank below every native source. */
export function isImportSource(source: string): boolean {
  return source.endsWith("-import");
}

/** Rule 5: one value per platform entry, device and day; imports only where nothing else exists. */
export function resolveDailyRows(rows: readonly DailyRow[]): PlayedDay[] {
  const byGameDate = new Map<string, DailyRow[]>();
  for (const row of rows) {
    const key = `${row.gameKey ?? row.platformGameId}|${row.date}`;
    const list = byGameDate.get(key);
    if (list) list.push(row);
    else byGameDate.set(key, [row]);
  }

  const out: PlayedDay[] = [];
  for (const group of byGameDate.values()) {
    const native = group.filter((r) => !isImportSource(r.source));
    const chosen = native.length > 0 ? native : group;
    // Same platform entry, day and device from two sources of equal rank: keep the larger value.
    const unique = new Map<string, DailyRow>();
    for (const row of chosen) {
      const key = `${row.platformGameId}|${row.deviceId ?? ""}`;
      const existing = unique.get(key);
      if (!existing || row.minutes > existing.minutes) unique.set(key, row);
    }
    for (const row of unique.values()) {
      out.push({
        platformGameId: row.platformGameId,
        deviceId: row.deviceId,
        date: row.date,
        minutes: row.minutes,
        estimated: row.estimated ?? false,
        origin: "daily",
      });
    }
  }
  return out;
}

/**
 * Rule 4: combine both kinds of data. For a game with per-day data, snapshot-derived days
 * only count before its first per-day date.
 */
export function buildPlayedDays(input: {
  dailyRows: readonly DailyRow[];
  snapshots: readonly SnapshotRow[];
}): { days: PlayedDay[]; warnings: PlaytimeWarning[] } {
  const daily = resolveDailyRows(input.dailyRows);
  const firstDaily = new Map<string, LocalDate>();
  for (const day of daily) {
    const first = firstDaily.get(day.platformGameId);
    if (!first || day.date < first) firstDaily.set(day.platformGameId, day.date);
  }

  const snapshotsByGame = new Map<string, SnapshotRow[]>();
  for (const s of input.snapshots) {
    const list = snapshotsByGame.get(s.platformGameId);
    if (list) list.push(s);
    else snapshotsByGame.set(s.platformGameId, [s]);
  }

  const days = [...daily];
  const warnings: PlaytimeWarning[] = [];
  for (const [gameId, list] of snapshotsByGame) {
    const result = snapshotsToDays(list);
    warnings.push(...result.warnings);
    const cutoff = firstDaily.get(gameId);
    for (const day of result.days) {
      if (cutoff && day.date >= cutoff) continue;
      days.push(day);
    }
  }
  days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { days, warnings };
}

export type Period = "day" | "week" | "month" | "year";

export function periodKey(date: LocalDate, period: Period): string {
  switch (period) {
    case "day":
      return date;
    case "week":
      return weekStart(date);
    case "month":
      return monthKey(date);
    case "year":
      return date.slice(0, 4);
  }
}

/** Minutes per period. `estimated` is true if any contributing day was estimated. */
export function sumByPeriod(
  days: readonly PlayedDay[],
  period: Period,
): Map<string, { minutes: number; estimated: boolean }> {
  const out = new Map<string, { minutes: number; estimated: boolean }>();
  for (const day of days) {
    const key = periodKey(day.date, period);
    const entry = out.get(key) ?? { minutes: 0, estimated: false };
    entry.minutes += day.minutes;
    entry.estimated = entry.estimated || day.estimated;
    out.set(key, entry);
  }
  return out;
}

/** Whether a new snapshot row is worth writing: the first one, or a changed total. */
export function shouldWriteSnapshot(
  previousTotal: number | null | undefined,
  newTotal: number,
): boolean {
  return previousTotal == null || previousTotal !== newTotal;
}
