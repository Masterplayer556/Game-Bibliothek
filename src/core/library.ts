// Turns raw database rows into the view model of the app and computes every statistic.
// Pure functions only: no Supabase, no React. All dates are Europe/Zurich calendar days.
import { buildPlayedDays, type PlayedDay, type PlaytimeWarning } from "./playtime";
import { addDays, monthKey, toLocalDate, weekStart } from "./time";
import type { ConnectionStatus, DeviceKind, GameStatus, LocalDate, PlatformId } from "./types";

// ---------------------------------------------------------------------------
// Raw rows (as read from the database)
// ---------------------------------------------------------------------------

export interface GameRow {
  id: string;
  title: string;
  cover_url: string | null;
  genres: string[] | null;
  release_year: number | null;
  igdb_id: number | null;
}

export interface PlatformGameRow {
  id: string;
  game_id: string | null;
  platform: PlatformId;
  source: string;
  external_id: string;
  title: string;
  cover_url: string | null;
  device_kind: DeviceKind | null;
  owned: boolean;
  first_played_at: string | null;
  last_played_at: string | null;
  total_playtime_minutes: number;
  achievements_unlocked: number | null;
  achievements_total: number | null;
}

export interface DeviceRow {
  id: string;
  platform: PlatformId;
  kind: DeviceKind;
  label: string;
}

export interface DailyPlaytimeRow {
  platform_game_id: string;
  device_id: string;
  play_date: LocalDate;
  minutes: number;
  source: string;
  estimated: boolean;
}

export interface SnapshotRow {
  platform_game_id: string;
  taken_at: string;
  total_minutes: number;
  last_played_at: string | null;
}

export interface AchievementRow {
  platform_game_id: string;
  external_id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  unlocked_at: string | null;
  rarity_percent: number | null;
  tier: string | null;
}

export interface UserDataRow {
  game_id: string;
  status: GameStatus | null;
  favorite: boolean;
  note: string | null;
  hide_from_pile: boolean;
  hidden: boolean;
}

export interface ConnectionRow {
  adapter_id: string;
  platform: PlatformId;
  status: ConnectionStatus;
  enabled: boolean;
  configured: boolean;
  last_sync_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  data_since: LocalDate | null;
  token_expires_at: string | null;
  details: Record<string, unknown> | null;
}

export interface RawData {
  games: GameRow[];
  platformGames: PlatformGameRow[];
  devices: DeviceRow[];
  daily: DailyPlaytimeRow[];
  snapshots: SnapshotRow[];
  achievements: AchievementRow[];
  userData: UserDataRow[];
  connections: ConnectionRow[];
  settings: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// View model
// ---------------------------------------------------------------------------

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
  hideFromPile: boolean;
  /** Not a game (YouTube, system apps): hidden from lists and statistics. */
  hidden: boolean;
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
    snapshots: raw.snapshots.map((s) => ({
      platformGameId: s.platform_game_id,
      takenAt: s.taken_at,
      totalMinutes: s.total_minutes,
      lastPlayedAt: s.last_played_at,
    })),
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
  const dataSince: Partial<Record<PlatformId, LocalDate>> = {};
  const note = (platform: PlatformId | undefined, date: LocalDate) => {
    if (!platform) return;
    const known = dataSince[platform];
    if (!known || date < known) dataSince[platform] = date;
  };
  for (const r of raw.daily) note(entryById.get(r.platform_game_id)?.platform, r.play_date);
  for (const s of raw.snapshots) note(entryById.get(s.platform_game_id)?.platform, toLocalDate(s.taken_at));

  return { games, byId, days, appDays, warnings, dataSince };
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export interface Range {
  from: LocalDate;
  to: LocalDate;
}

export function inRange(date: LocalDate, range: Range): boolean {
  return date >= range.from && date <= range.to;
}

export function totalInRange(days: readonly GameDay[], range: Range): { minutes: number; estimated: boolean } {
  let minutes = 0;
  let estimated = false;
  for (const d of days) {
    if (!inRange(d.date, range)) continue;
    minutes += d.minutes;
    estimated ||= d.estimated;
  }
  return { minutes, estimated };
}

export interface RankedGame {
  gameId: string;
  minutes: number;
  estimated: boolean;
}

/** Most played games in a range, by summed day minutes. */
export function topGames(days: readonly GameDay[], range: Range, limit: number): RankedGame[] {
  const byGame = new Map<string, RankedGame>();
  for (const d of days) {
    if (!inRange(d.date, range)) continue;
    const entry = byGame.get(d.gameId) ?? { gameId: d.gameId, minutes: 0, estimated: false };
    entry.minutes += d.minutes;
    entry.estimated ||= d.estimated;
    byGame.set(d.gameId, entry);
  }
  return [...byGame.values()].sort((a, b) => b.minutes - a.minutes).slice(0, limit);
}

export type Grouping = "platform" | "device" | "genre";

export interface Share {
  key: string;
  minutes: number;
}

export const UNKNOWN_GENRE = "Unbekannt";

/**
 * Minutes per platform, device or genre. A game with several genres counts fully for each
 * of them (so genre shares can add up to more than 100 %).
 */
export function distribution(
  days: readonly GameDay[],
  range: Range,
  by: Grouping,
  byId: ReadonlyMap<string, LibraryGame>,
): Share[] {
  const totals = new Map<string, number>();
  const add = (key: string, minutes: number) => totals.set(key, (totals.get(key) ?? 0) + minutes);
  for (const d of days) {
    if (!inRange(d.date, range)) continue;
    if (by === "platform") add(d.platform, d.minutes);
    else if (by === "device") add(d.deviceKind, d.minutes);
    else {
      const genres = byId.get(d.gameId)?.genres ?? [];
      if (genres.length === 0) add(UNKNOWN_GENRE, d.minutes);
      for (const g of genres) add(g, d.minutes);
    }
  }
  return [...totals.entries()]
    .map(([key, minutes]) => ({ key, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Lifetime minutes per platform, from the platform totals (includes time before tracking). */
export function lifetimeByPlatform(games: readonly LibraryGame[]): Share[] {
  const totals = new Map<string, number>();
  for (const g of games) {
    if (g.hidden) continue;
    for (const e of g.entries) totals.set(e.platform, (totals.get(e.platform) ?? 0) + e.totalMinutes);
  }
  return [...totals.entries()]
    .map(([key, minutes]) => ({ key, minutes }))
    .filter((s) => s.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
}

export type Bucket = "week" | "month";

export interface SeriesPoint {
  /** Monday of the week, or YYYY-MM */
  key: string;
  minutes: number;
  estimated: boolean;
}

/** Minutes per week or month, with empty buckets filled in. */
export function playtimeSeries(days: readonly GameDay[], range: Range, bucket: Bucket): SeriesPoint[] {
  const keyOf = (date: LocalDate) => (bucket === "week" ? weekStart(date) : monthKey(date));
  const points = new Map<string, SeriesPoint>();
  if (bucket === "week") {
    for (let d = weekStart(range.from); d <= range.to; d = addDays(d, 7)) {
      points.set(d, { key: d, minutes: 0, estimated: false });
    }
  } else {
    for (let d = `${monthKey(range.from)}-01`; d <= range.to; ) {
      points.set(monthKey(d), { key: monthKey(d), minutes: 0, estimated: false });
      const [y, m] = [Number(d.slice(0, 4)), Number(d.slice(5, 7))];
      d = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    }
  }
  for (const d of days) {
    if (!inRange(d.date, range)) continue;
    const point = points.get(keyOf(d.date));
    if (!point) continue;
    point.minutes += d.minutes;
    point.estimated ||= d.estimated;
  }
  return [...points.values()];
}

export const DEFAULT_PILE_THRESHOLD_MINUTES = 60;

/** Owned, barely played, not finished or given up, and not hidden by me. */
export function pileOfShame(games: readonly LibraryGame[], thresholdMinutes: number): LibraryGame[] {
  return games
    .filter(
      (g) =>
        !g.hidden &&
        !g.hideFromPile &&
        g.owned &&
        g.status !== "completed" &&
        g.status !== "dropped" &&
        g.totalMinutes < thresholdMinutes,
    )
    .sort((a, b) => a.totalMinutes - b.totalMinutes || a.title.localeCompare(b.title, "de"));
}

// ---------------------------------------------------------------------------
// Library list
// ---------------------------------------------------------------------------

export type SortKey = "lastPlayed" | "playtime" | "name";

export interface LibraryFilter {
  search?: string;
  platform?: PlatformId | "";
  device?: DeviceKind | "";
  genre?: string;
  status?: GameStatus | "none" | "";
  showHidden?: boolean;
  sort?: SortKey;
}

function fold(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function filterLibrary(games: readonly LibraryGame[], filter: LibraryFilter): LibraryGame[] {
  const search = fold(filter.search?.trim() ?? "");
  const result = games.filter((g) => {
    if (g.hidden && !filter.showHidden) return false;
    if (search && !fold(g.title).includes(search) && !g.entries.some((e) => fold(e.title).includes(search))) {
      return false;
    }
    if (filter.platform && !g.platforms.includes(filter.platform)) return false;
    if (filter.device && !g.deviceKinds.includes(filter.device)) return false;
    if (filter.genre && !g.genres.includes(filter.genre)) return false;
    if (filter.status === "none" && g.status !== null) return false;
    if (filter.status && filter.status !== "none" && g.status !== filter.status) return false;
    return true;
  });
  const sort = filter.sort ?? "lastPlayed";
  return result.sort((a, b) => {
    if (sort === "name") return a.title.localeCompare(b.title, "de");
    if (sort === "playtime") return b.totalMinutes - a.totalMinutes || a.title.localeCompare(b.title, "de");
    return (b.lastPlayedAt ?? "").localeCompare(a.lastPlayedAt ?? "") || a.title.localeCompare(b.title, "de");
  });
}

export function allGenres(games: readonly LibraryGame[]): string[] {
  return [...new Set(games.flatMap((g) => g.genres))].sort((a, b) => a.localeCompare(b, "de"));
}

// ---------------------------------------------------------------------------
// One game
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sync health
// ---------------------------------------------------------------------------

export const STALE_SYNC_HOURS = 24;

/** Connected adapters whose last successful sync is too old (or that never succeeded). */
export function staleConnections(connections: readonly ConnectionRow[], now: Date): ConnectionRow[] {
  const limit = now.getTime() - STALE_SYNC_HOURS * 3600 * 1000;
  return connections.filter(
    (c) =>
      c.enabled &&
      c.configured &&
      c.status !== "not_connected" &&
      c.status !== "disabled" &&
      (!c.last_success_at || new Date(c.last_success_at).getTime() < limit),
  );
}

export function rangeEndingToday(today: LocalDate, days: number): Range {
  return { from: addDays(today, -(days - 1)), to: today };
}
