// German display names. Kept in one place so the UI and tests agree.
import type { DeviceKind, GameStatus, PlatformId } from "./types";

export const PLATFORM_LABEL: Record<PlatformId, string> = {
  steam: "Steam",
  psn: "PlayStation",
  nintendo: "Nintendo",
  manual: "Manuell",
};

export const DEVICE_LABEL: Record<DeviceKind, string> = {
  pc: "PC",
  ps5: "PS5",
  ps4: "PS4",
  switch1: "Switch",
  switch2: "Switch 2",
  xbox360: "Xbox 360",
  other: "Unbekannt",
};

export const STATUS_LABEL: Record<GameStatus, string> = {
  backlog: "Backlog",
  playing: "Am Spielen",
  completed: "Durchgespielt",
  dropped: "Abgebrochen",
};

/** Systems offered when adding a game by hand. */
export const MANUAL_DEVICE_KINDS: readonly DeviceKind[] = [
  "pc",
  "ps5",
  "ps4",
  "switch1",
  "switch2",
  "xbox360",
  "other",
];

export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} Min.`;
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${hours} Std.` : `${hours} Std. ${rest} Min.`;
}

/** Short form for charts and tiles: "12.5 Std." (Swiss decimal point) */
export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  const digits = hours < 10 ? 1 : 0;
  return `${hours.toLocaleString("de-CH", { maximumFractionDigits: digits, minimumFractionDigits: 0 })} Std.`;
}
