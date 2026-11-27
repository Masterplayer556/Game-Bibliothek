// The view model of the app: games across platforms and their played days, built from the raw rows.
import { addStartingBaselines, buildPlayedDays, type PlayedDay, type PlaytimeWarning } from "../playtime";
import { toLocalDate } from "../time";
import type { DeviceKind, GameStatus, LocalDate, PlatformId } from "../types";
import type { PlatformGameRow, RawData } from "./rows";

export interface PlatformEntry {
  id: string;
  platform: PlatformId;
  source: string;
  title: string;
  deviceKind: DeviceKind | null;
  owned: boolean;
  totalMinutes: number;
  lastPlayedAt: string | null;
  /** null = the platform has no achievements */
  achievements: { unlocked: number; total: number } | null;
}

export interface LibraryGame {
  id: string;
  title: string;
  coverUrl: string | null;
  genres: string[];
  releaseYear: number | null;
  igdbId: number | null;
  entries: PlatformEntry[];
  platforms: PlatformId[];
  deviceKinds: DeviceKind[];
  totalMinutes: number;
  firstPlayedAt: string | null;
  lastPlayedAt: string | null;
  owned: boolean;
  /** Summed over all platforms with achievements; null if none of them has any. */
  achievements: { unlocked: number; total: number } | null;
  status: GameStatus | null;
  favorite: boolean;
  note: string;
  /** Column of the former pile of shame; only kept so saving my data leaves it as it is. */
  hideFromPile: boolean;
  /** Not a game (YouTube, system apps): hidden from lists and statistics. */
  hidden: boolean;
  /** My rating, 1 to 5 stars; null = not rated. */
  rating: number | null;
  /** The day I finished it («Durchgespielt am»). */
  completedOn: LocalDate | null;
}

/** One played day of one game, with everything needed to group it. */
export interface GameDay extends PlayedDay {
  gameId: string;
  platform: PlatformId;
  deviceKind: DeviceKind;
}

export interface Library {
  games: LibraryGame[];
  byId: Map<string, LibraryGame>;
  /** Days of games only (entries marked «Kein Spiel» are left out). */
  days: GameDay[];
  /** Days of entries marked «Kein Spiel» (apps): shown separately, never in game statistics. */
  appDays: GameDay[];
  warnings: PlaytimeWarning[];
  /** First day each platform has day-level data for (gaps before it are not «not played»). */
  dataSince: Partial<Record<PlatformId, LocalDate>>;
}

function laterOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function earlierOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

const PLATFORM_ORDER: PlatformId[] = ["steam", "psn", "nintendo", "manual"];
const DEVICE_ORDER: DeviceKind[] = ["pc", "ps5", "ps4", "switch1", "switch2", "xbox360", "other"];

export function buildLibrary(raw: RawData): Library {
  const userData = new Map(raw.userData.map((u) => [u.game_id, u]));
  const deviceById = new Map(raw.devices.map((d) => [d.id, d]));

  const entriesByGame = new Map<string, PlatformGameRow[]>();
  const entryById = new Map<string, PlatformGameRow>();
  for (const entry of raw.platformGames) {
    entryById.set(entry.id, entry);
    if (!entry.game_id) continue;
    const list = entriesByGame.get(entry.game_id);
    if (list) list.push(entry);
    else entriesByGame.set(entry.game_id, [entry]);
  }

  // Device kinds actually used per entry (from per-day rows).
  const kindsByEntry = new Map<string, Set<DeviceKind>>();
  for (const row of raw.daily) {
    const kind = deviceById.get(row.device_id)?.kind;
    if (!kind) continue;
    const set = kindsByEntry.get(row.platform_game_id) ?? new Set<DeviceKind>();
    set.add(kind);
    kindsByEntry.set(row.platform_game_id, set);
  }

  const games: LibraryGame[] = [];
  for (const game of raw.games) {
    const rows = entriesByGame.get(game.id);
    if (!rows || rows.length === 0) continue;
    const entries: PlatformEntry[] = rows
      .map((r) => ({
        id: r.id,
        platform: r.platform,
        source: r.source,
        title: r.title,
        deviceKind: r.device_kind,
        owned: r.owned,
        totalMinutes: r.total_playtime_minutes,
        lastPlayedAt: r.last_played_at,
        achievements:
          r.achievements_total != null
            ? { unlocked: r.achievements_unlocked ?? 0, total: r.achievements_total }
            : null,
      }))
      .sort((a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform));

    const kinds = new Set<DeviceKind>();
    let firstPlayedAt: string | null = null;
    let lastPlayedAt: string | null = null;
    for (const r of rows) {
      if (r.device_kind) kinds.add(r.device_kind);
      for (const k of kindsByEntry.get(r.id) ?? []) kinds.add(k);
      firstPlayedAt = earlierOf(firstPlayedAt, r.first_played_at);
      lastPlayedAt = laterOf(lastPlayedAt, r.last_played_at);
    }
    const withAchievements = entries.filter((e) => e.achievements);
    const user = userData.get(game.id);
    const cover = game.cover_url ?? rows.find((r) => r.cover_url)?.cover_url ?? null;

    games.push({
      id: game.id,
      title: game.title,
      coverUrl: cover,
      genres: game.genres ?? [],
      releaseYear: game.release_year,
      igdbId: game.igdb_id,
      entries,
      platforms: [...new Set(entries.map((e) => e.platform))],
      deviceKinds: DEVICE_ORDER.filter((k) => kinds.has(k)),
      totalMinutes: entries.reduce((sum, e) => sum + e.totalMinutes, 0),
      firstPlayedAt,
      lastPlayedAt,
      owned: entries.some((e) => e.owned),
      achievements:
        withAchievements.length > 0
          ? {
              unlocked: withAchievements.reduce((s, e) => s + e.achievements!.unlocked, 0),
              total: withAchievements.reduce((s, e) => s + e.achievements!.total, 0),
            }
          : null,
      status: user?.status ?? null,
      favorite: user?.favorite ?? false,
      note: user?.note ?? "",
      hideFromPile: user?.hide_from_pile ?? false,
      hidden: user?.hidden ?? false,
      rating: user?.rating ?? null,
      completedOn: user?.completed_on ?? null,
    });
  }
  const byId = new Map(games.map((g) => [g.id, g]));

  // Played days: per-day data wins over snapshots; overlaps are decided per game.
  const { days: played, warnings } = buildPlayedDays({
    dailyRows: raw.daily.map((r) => ({
      platformGameId: r.platform_game_id,
      gameKey: entryById.get(r.platform_game_id)?.game_id ?? null,
      deviceId: r.device_id,
      date: r.play_date,
      minutes: r.minutes,
      source: r.source,
      estimated: r.estimated,
    })),
    snapshots: addStartingBaselines(
      raw.snapshots.map((s) => ({
        platformGameId: s.platform_game_id,
        takenAt: s.taken_at,
        totalMinutes: s.total_minutes,
        lastPlayedAt: s.last_played_at,
      })),
      // Games added by hand are never synced: their total is always a starting value.
      (id) => {
        const platform = entryById.get(id)?.platform;
        return platform === "manual" ? undefined : platform;
      },
      (id) => entryById.get(id)?.first_played_at,
    ),
  });

  const days: GameDay[] = [];
  const appDays: GameDay[] = [];
  for (const day of played) {
    const entry = entryById.get(day.platformGameId);
    const game = entry?.game_id ? byId.get(entry.game_id) : undefined;
    if (!entry || !game || day.minutes <= 0) continue;
    const kind =
      (day.deviceId ? deviceById.get(day.deviceId)?.kind : undefined) ?? entry.device_kind ?? "other";
    (game.hidden ? appDays : days).push({ ...day, gameId: game.id, platform: entry.platform, deviceKind: kind });
  }

  // Coverage per platform: first per-day row, or the first snapshot (start of tracking).
  // Games added by hand are not tracked: their snapshots only record the starting value.
  const dataSince: Partial<Record<PlatformId, LocalDate>> = {};
  const note = (platform: PlatformId | undefined, date: LocalDate) => {
    if (!platform || platform === "manual") return;
    const known = dataSince[platform];
    if (!known || date < known) dataSince[platform] = date;
  };
  for (const r of raw.daily) note(entryById.get(r.platform_game_id)?.platform, r.play_date);
  for (const s of raw.snapshots) note(entryById.get(s.platform_game_id)?.platform, toLocalDate(s.taken_at));

  return { games, byId, days, appDays, warnings, dataSince };
}
