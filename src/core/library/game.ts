// Numbers of one game.
import type { DeviceKind, PlatformId } from "../types";
import type { GameDay, LibraryGame } from "./model";

export interface DeviceTotal {
  platform: PlatformId;
  deviceKind: DeviceKind | null;
  minutes: number;
}

/**
 * Playtime per platform and device. Platforms with per-day data are split by console;
 * the others report one lifetime total for their fixed device.
 */
export function deviceTotals(game: LibraryGame, days: readonly GameDay[]): DeviceTotal[] {
  const out: DeviceTotal[] = [];
  for (const entry of game.entries) {
    const entryDays = days.filter((d) => d.platformGameId === entry.id && d.origin === "daily");
    if (entryDays.length === 0) {
      if (entry.totalMinutes > 0) {
        out.push({ platform: entry.platform, deviceKind: entry.deviceKind, minutes: entry.totalMinutes });
      }
      continue;
    }
    const byKind = new Map<DeviceKind, number>();
    for (const d of entryDays) byKind.set(d.deviceKind, (byKind.get(d.deviceKind) ?? 0) + d.minutes);
    for (const [kind, minutes] of byKind) out.push({ platform: entry.platform, deviceKind: kind, minutes });
    // Time from before the per-day data (the platform's total is higher than the days add up to).
    const rest = entry.totalMinutes - entryDays.reduce((sum, d) => sum + d.minutes, 0);
    if (rest > 0) out.push({ platform: entry.platform, deviceKind: entry.deviceKind, minutes: rest });
  }
  // Same platform and device from two entries (e.g. base game and Switch 2 Edition): merge.
  const merged = new Map<string, DeviceTotal>();
  for (const t of out) {
    const key = `${t.platform}|${t.deviceKind ?? ""}`;
    const existing = merged.get(key);
    if (existing) existing.minutes += t.minutes;
    else merged.set(key, { ...t });
  }
  return [...merged.values()].sort((a, b) => b.minutes - a.minutes);
}

export type TimeToBeatKind = "hastily" | "normally" | "completely";

export interface TimeToBeatSummary {
  /** The values IGDB has, shortest first. */
  steps: { kind: TimeToBeatKind; minutes: number }[];
  /** The usual length: normal, else rushed, else everything. */
  mainMinutes: number;
  /** My playtime on all platforms. */
  mineMinutes: number;
  /** Mine compared with the usual length, 0 to 1 (capped). */
  progress: number;
}

/** The usual length of a game in minutes (normal, else rushed, else everything); null = unknown. */
export function mainLength(game: Pick<LibraryGame, "timeToBeat">): number | null {
  const t = game.timeToBeat;
  return t ? (t.normally ?? t.hastily ?? t.completely ?? null) : null;
}

/** «Hauptstory ca. 12 Std., du: 8 Std.»: null if IGDB knows no length. */
export function timeToBeatSummary(game: Pick<LibraryGame, "timeToBeat" | "totalMinutes">): TimeToBeatSummary | null {
  const t = game.timeToBeat;
  const main = mainLength(game);
  if (!t || main === null) return null;
  const steps = (["hastily", "normally", "completely"] as const)
    .filter((kind) => t[kind] != null)
    .map((kind) => ({ kind, minutes: t[kind]! }));
  return { steps, mainMinutes: main, mineMinutes: game.totalMinutes, progress: Math.min(1, game.totalMinutes / main) };
}
