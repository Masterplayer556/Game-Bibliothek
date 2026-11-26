// «Chronik»: the life as a player on a timeline. Pure functions on top of the library model.
//
// Events, newest first:
//   start      – first played, only for games that are new since tracking began (see
//                `newSinceTracking`): never for a game that already had playtime at the first
//                sync, nor for one with imported history (it was played before)
//   milestone  – 10, 25, 50, 100 … hours in one game, on the day the total passed the mark
//   complete   – every achievement of a game on one platform
//   platinum   – a PlayStation platinum trophy
//   rare       – an achievement only few players have (the limit is the app's «Selten» setting)
//   device     – the first day on a console, from day-by-day data (only after that platform's
//                days had begun, otherwise the date would only be the start of tracking)
//   tracking   – the day a platform's day-by-day data starts
import { achievementKey } from "./achievements";
import { NINTENDO_IMPORT_ID } from "./nintendo/import";
import { undatedTime, type AchievementRow, type GameDay, type Library, type LibraryGame, type RawData } from "./library";
import { toLocalDate } from "./time";
import type { DeviceKind, LocalDate, PlatformId } from "./types";

export type ChronicleKind = "start" | "milestone" | "complete" | "platinum" | "rare" | "device" | "tracking";

export interface ChronicleEvent {
  id: string;
  kind: ChronicleKind;
  date: LocalDate;
  gameId?: string;
  platform?: PlatformId;
  device?: DeviceKind;
  /** Milestones: the hours reached. */
  hours?: number;
  /** complete: how many achievements. */
  count?: number;
  achievement?: { name: string; rarityPercent: number | null; iconUrl: string | null };
  /** The day that decided it was partly estimated. */
  estimated?: boolean;
}

/** Hours that count as a milestone in one game. */
export const MILESTONE_HOURS = [10, 25, 50, 100, 250, 500, 1000, 2000] as const;

/** Order of events on the same day: the big ones first. */
const KIND_ORDER: ChronicleKind[] = ["platinum", "complete", "milestone", "rare", "start", "device", "tracking"];

/**
 * Games played for the first time since tracking began. A platform entry blocks the game if it
 * had playtime when tracking began: its first snapshot shows minutes on the first sync day of its
 * platform, it has imported history, or its time has no date at all (entered by hand). An entry
 * is new if its first snapshot shows 0 minutes, or it first appears after its platform's first
 * sync (bought or first played later). Entries never played count neither way.
 */
export function newSinceTracking(library: Library, raw: Pick<RawData, "daily" | "snapshots">): Set<string> {
  const platformOf = new Map(library.games.flatMap((g) => g.entries.map((e) => [e.id, e.platform] as const)));
  // First day each platform was synced (imports do not count: they reach back before it).
  const syncStart = new Map<string, LocalDate>();
  const firstSnapshot = new Map<string, { date: LocalDate; minutes: number; at: string }>();
  const firstSyncedDay = new Map<string, LocalDate>();
  const imported = new Set<string>();
  const note = (platform: string | undefined, date: LocalDate) => {
    if (!platform) return;
    const known = syncStart.get(platform);
    if (!known || date < known) syncStart.set(platform, date);
  };
  for (const s of raw.snapshots) {
    const date = toLocalDate(s.taken_at);
    note(platformOf.get(s.platform_game_id), date);
    const known = firstSnapshot.get(s.platform_game_id);
    if (!known || s.taken_at < known.at) firstSnapshot.set(s.platform_game_id, { date, minutes: s.total_minutes, at: s.taken_at });
  }
  for (const d of raw.daily) {
    if (d.source === NINTENDO_IMPORT_ID) {
      imported.add(d.platform_game_id);
      continue;
    }
    note(platformOf.get(d.platform_game_id), d.play_date);
    const known = firstSyncedDay.get(d.platform_game_id);
    if (!known || d.play_date < known) firstSyncedDay.set(d.platform_game_id, d.play_date);
  }

  const out = new Set<string>();
  for (const game of library.games) {
    let isNew = false;
    let blocked = false;
    for (const e of game.entries) {
      if (e.totalMinutes <= 0) continue;
      const start = syncStart.get(e.platform);
      const snapshot = firstSnapshot.get(e.id);
      const day = firstSyncedDay.get(e.id);
      if (imported.has(e.id)) blocked = true;
      else if (snapshot) {
        if (snapshot.minutes === 0 || (start && snapshot.date > start)) isNew = true;
        else blocked = true;
      } else if (day) {
        if (start && day > start) isNew = true;
        else blocked = true;
      } else blocked = true;
    }
    if (isNew && !blocked) out.add(game.id);
  }
  return out;
}

/**
 * The day a game was first played: the earlier of what the platform reports and its first day
 * with playtime. Only meaningful for games in `newSinceTracking`.
 */
export function firstPlayedDay(game: LibraryGame, days: readonly GameDay[]): LocalDate | undefined {
  const reported = game.firstPlayedAt ? toLocalDate(game.firstPlayedAt) : undefined;
  let firstDay: LocalDate | undefined;
  for (const d of days) {
    if (d.gameId === game.id && (!firstDay || d.date < firstDay)) firstDay = d.date;
  }
  return reported && firstDay ? (reported < firstDay ? reported : firstDay) : (reported ?? firstDay);
}

export function buildChronicle(
  library: Library,
  raw: Pick<RawData, "achievements" | "daily" | "snapshots">,
  options: { isRare: (percent: number | null) => boolean },
): ChronicleEvent[] {
  const achievements = raw.achievements;
  const fresh = newSinceTracking(library, raw);
  const events: ChronicleEvent[] = [];
  const visible = library.games.filter((g) => !g.hidden);
  const visibleIds = new Set(visible.map((g) => g.id));
  const days = [...library.days].filter((d) => visibleIds.has(d.gameId)).sort((a, b) => a.date.localeCompare(b.date));

  // Time without a date (before tracking) per game: the starting point for milestones.
  const undatedByGame = new Map<string, number>();
  for (const u of undatedTime(visible, library.days)) undatedByGame.set(u.gameId, (undatedByGame.get(u.gameId) ?? 0) + u.minutes);

  const daysByGame = new Map<string, typeof days>();
  for (const d of days) {
    const list = daysByGame.get(d.gameId);
    if (list) list.push(d);
    else daysByGame.set(d.gameId, [d]);
  }

  for (const game of visible) {
    const gameDays = daysByGame.get(game.id) ?? [];
    const before = undatedByGame.get(game.id) ?? 0;

    // Start: the earliest known day, only for games that are new since tracking began
    if (fresh.has(game.id)) {
      const start = firstPlayedDay(game, gameDays);
      if (start) events.push({ id: `start-${game.id}`, kind: "start", date: start, gameId: game.id });
    }

    // Milestones, counted on top of the time before tracking
    let total = before;
    let next = MILESTONE_HOURS.findIndex((h) => h * 60 > before);
    if (next === -1) continue;
    // Several entries of one game can have days on the same date: add a date at once.
    for (let i = 0; i < gameDays.length && next !== -1 && next < MILESTONE_HOURS.length; ) {
      const date = gameDays[i]!.date;
      let estimated = false;
      while (i < gameDays.length && gameDays[i]!.date === date) {
        total += gameDays[i]!.minutes;
        estimated ||= gameDays[i]!.estimated;
        i++;
      }
      while (next < MILESTONE_HOURS.length && total >= MILESTONE_HOURS[next]! * 60) {
        const hours = MILESTONE_HOURS[next]!;
        events.push({ id: `milestone-${game.id}-${hours}`, kind: "milestone", date, gameId: game.id, hours, estimated: estimated || undefined });
        next++;
      }
    }
  }

  // Achievements: per platform entry
  const entryInfo = new Map<string, { gameId: string; platform: PlatformId; total: number; unlocked: number }>();
  for (const game of visible) {
    for (const e of game.entries) {
      if (e.achievements && e.achievements.total > 0) entryInfo.set(e.id, { gameId: game.id, platform: e.platform, ...e.achievements });
    }
  }
  const byEntry = new Map<string, AchievementRow[]>();
  for (const a of achievements) {
    if (!entryInfo.has(a.platform_game_id)) continue;
    const list = byEntry.get(a.platform_game_id);
    if (list) list.push(a);
    else byEntry.set(a.platform_game_id, [a]);
  }
  const rareByKey = new Map<string, ChronicleEvent>();
  for (const [entryId, rows] of byEntry) {
    const info = entryInfo.get(entryId)!;
    const platinum = rows.find((a) => a.tier?.toLowerCase() === "platinum" && a.unlocked_at);
    if (platinum) {
      events.push({
        id: `platinum-${entryId}`,
        kind: "platinum",
        date: toLocalDate(platinum.unlocked_at!),
        gameId: info.gameId,
        platform: info.platform,
        achievement: { name: platinum.name, rarityPercent: platinum.rarity_percent, iconUrl: platinum.icon_url },
      });
    }
    // All of them: the day of the last one. Only when the whole list is stored.
    const unlocked = rows.filter((a) => a.unlocked_at);
    if (rows.length === info.total && unlocked.length === rows.length) {
      const date = toLocalDate(unlocked.reduce((max, a) => (a.unlocked_at! > max ? a.unlocked_at! : max), unlocked[0]!.unlocked_at!));
      // A platinum on the same day says the same.
      if (!platinum || toLocalDate(platinum.unlocked_at!) !== date) {
        events.push({ id: `complete-${entryId}`, kind: "complete", date, gameId: info.gameId, platform: info.platform, count: rows.length });
      }
    }
    for (const a of unlocked) {
      if (a === platinum || !options.isRare(a.rarity_percent)) continue;
      // The same achievement on PC and PlayStation appears once, on the earlier day.
      const key = `${info.gameId}|${achievementKey(a.name) || a.external_id}`;
      const event: ChronicleEvent = {
        id: `rare-${entryId}-${a.external_id}`,
        kind: "rare",
        date: toLocalDate(a.unlocked_at!),
        gameId: info.gameId,
        platform: info.platform,
        achievement: { name: a.name, rarityPercent: a.rarity_percent, iconUrl: a.icon_url },
      };
      const known = rareByKey.get(key);
      if (!known || event.date < known.date) rareByKey.set(key, event);
    }
  }
  events.push(...rareByKey.values());

  // First day on each console, from day-by-day data only (snapshots say nothing about the
  // console's first day) and only if that platform's days had already begun (e.g. Switch 2).
  const firstOn = new Map<DeviceKind, (typeof days)[number]>();
  const dailySince = new Map<PlatformId, LocalDate>();
  for (const d of days) {
    if (d.origin !== "daily") continue;
    if (!dailySince.has(d.platform)) dailySince.set(d.platform, d.date);
    const known = firstOn.get(d.deviceKind);
    if (!known || d.date < known.date || (d.date === known.date && d.minutes > known.minutes)) firstOn.set(d.deviceKind, d);
  }
  for (const [device, d] of firstOn) {
    const since = dailySince.get(d.platform);
    if (device === "other" || !since || d.date <= since) continue;
    events.push({ id: `device-${device}`, kind: "device", date: d.date, device, platform: d.platform, gameId: d.gameId });
  }

  // Start of tracking per platform
  for (const [platform, since] of Object.entries(library.dataSince) as [PlatformId, LocalDate][]) {
    events.push({ id: `tracking-${platform}`, kind: "tracking", date: since, platform });
  }

  return events.sort(
    (a, b) => b.date.localeCompare(a.date) || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.id.localeCompare(b.id),
  );
}

export interface ChronicleYear {
  year: number;
  /** Minutes on days with a date. */
  minutes: number;
  playDays: number;
  /** Most played game of the year. */
  topGameId: string | null;
}

/** A short summary per calendar year that has played days, newest first. */
export function chronicleYears(library: Library): ChronicleYear[] {
  const years = new Map<number, { minutes: number; dates: Set<LocalDate>; games: Map<string, number> }>();
  for (const d of library.days) {
    const year = Number(d.date.slice(0, 4));
    const entry = years.get(year) ?? { minutes: 0, dates: new Set<LocalDate>(), games: new Map<string, number>() };
    entry.minutes += d.minutes;
    entry.dates.add(d.date);
    entry.games.set(d.gameId, (entry.games.get(d.gameId) ?? 0) + d.minutes);
    years.set(year, entry);
  }
  return [...years.entries()]
    .map(([year, e]) => ({
      year,
      minutes: e.minutes,
      playDays: e.dates.size,
      topGameId: [...e.games.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
    .sort((a, b) => b.year - a.year);
}
