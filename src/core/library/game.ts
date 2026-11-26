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
