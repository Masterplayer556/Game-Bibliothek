// Reads everything the app shows in one go and writes my own changes.
// The data of one person fits comfortably in the browser; all statistics are computed there.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ADAPTER_CATALOG } from "@/core/adapter-catalog";
import type { RawData } from "@/core/library";
import { normalizeTitle } from "@/core/normalize-title";
import type { DeviceKind, GameStatus } from "@/core/types";
import { fetchAll, persistBatch, recomputeDailyTotals } from "@/data/persist";

export type RawPart = Exclude<keyof RawData, never>;

export const ALL_PARTS: readonly RawPart[] = [
  "games",
  "platformGames",
  "devices",
  "daily",
  "snapshots",
  "achievements",
  "userData",
  "connections",
  "settings",
];

/**
 * Reads the given tables only (all by default). A change reloads what it touched, not the
 * whole library: saving a note reads one table instead of nine.
 */
export async function loadRawParts(db: SupabaseClient, parts: readonly RawPart[] = ALL_PARTS): Promise<Partial<RawData>> {
  // Column lists are dynamic strings, so the client cannot infer row types: cast once here.
  const all = <T>(table: string, columns: string, order = "id") =>
    fetchAll<T>(
      (from, to) =>
        db.from(table).select(columns).order(order).range(from, to) as unknown as PromiseLike<{
          data: T[] | null;
          error: { message: string } | null;
        }>,
    );

  const loaders: { [K in RawPart]: () => Promise<RawData[K]> } = {
    games: () => all("games", "id, title, cover_url, genres, release_year, igdb_id"),
    platformGames: () =>
      all(
        "platform_games",
        "id, game_id, platform, source, external_id, title, cover_url, device_kind, owned, first_played_at, last_played_at, total_playtime_minutes, achievements_unlocked, achievements_total",
      ),
    devices: () => all("devices", "id, platform, kind, label"),
    daily: () => all("daily_playtime", "platform_game_id, device_id, play_date, minutes, source, estimated"),
    snapshots: () => all("playtime_snapshots", "platform_game_id, taken_at, total_minutes, last_played_at"),
    achievements: async () =>
      (
        await all<RawData["achievements"][number]>(
          "achievements",
          "platform_game_id, external_id, name, description, icon_url, unlocked_at, rarity_percent, tier",
        )
      ).map((a) => ({ ...a, rarity_percent: a.rarity_percent == null ? null : Number(a.rarity_percent) })),
    userData: () => all("game_user_data", "game_id, status, favorite, note, hide_from_pile, hidden", "game_id"),
    connections: () =>
      all(
        "platform_connections",
        "adapter_id, platform, status, enabled, configured, last_sync_at, last_success_at, last_error, data_since, token_expires_at, details",
        "adapter_id",
      ),
    settings: async () => (await all<{ settings: Record<string, unknown> }>("app_settings", "settings", "user_id"))[0]?.settings ?? {},
  };

  const unique = [...new Set(parts)];
  const values = await Promise.all(unique.map((part) => loaders[part]()));
  return Object.fromEntries(unique.map((part, i) => [part, values[i]])) as Partial<RawData>;
}

/**
 * Keeps reloads in order. Every reload gets a number when it starts; when it answers, a table
 * is only taken if no later reload has already delivered it. A slow full reload that started
 * before a note was saved therefore cannot bring back the old note after the quick reload of
 * that one table.
 */
export class ReloadOrder {
  private started = 0;
  private applied = new Map<RawPart, number>();

  /** Call when a reload starts; pass the result to `take` when it answers. */
  begin(): number {
    return ++this.started;
  }

  /**
   * The part of an answer that is newer than what is shown, and marks it as shown; null if
   * nothing in it is newer. `current` null (nothing shown yet) takes only a complete answer.
   */
  take(ticket: number, fresh: Partial<RawData>, current: RawData | null): RawData | null {
    const newer = (Object.keys(fresh) as RawPart[]).filter((part) => (this.applied.get(part) ?? 0) < ticket);
    if (newer.length === 0) return null;
    if (!current && newer.length < ALL_PARTS.length) return null;
    for (const part of newer) this.applied.set(part, ticket);
    const picked = Object.fromEntries(newer.map((part) => [part, fresh[part]])) as Partial<RawData>;
    return { ...(current ?? ({} as RawData)), ...picked };
  }
}

/** Everything the app shows, as stored (shared trophy lists not yet joined, see the provider). */
export async function loadRawData(db: SupabaseClient): Promise<RawData> {
  return (await loadRawParts(db)) as RawData;
}

function check(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export interface UserDataPatch {
  status?: GameStatus | null;
  favorite?: boolean;
  note?: string | null;
  hide_from_pile?: boolean;
  hidden?: boolean;
}

export async function saveUserData(
  db: SupabaseClient,
  userId: string,
  gameId: string,
  current: Required<UserDataPatch>,
  patch: UserDataPatch,
): Promise<void> {
  const { error } = await db
    .from("game_user_data")
    .upsert({ game_id: gameId, user_id: userId, ...current, ...patch }, { onConflict: "game_id" });
  check(error);
}

export async function saveSettings(
  db: SupabaseClient,
  userId: string,
  settings: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.from("app_settings").upsert({ user_id: userId, settings }, { onConflict: "user_id" });
  check(error);
}

// Sources without a lifetime total of their own (Nintendo): their stored total is the sum of
// the per-day rows that count, and which rows count is decided per game.
const DERIVED_TOTAL_SOURCES = ADAPTER_CATALOG.filter((a) => !a.capabilities.totalPlaytime).map((a) => a.id);

/**
 * After entries moved between games: recomputes the stored totals of their per-day entries.
 * An import entry and a native entry that now share a game count each day only once (and
 * after a split both count again).
 */
async function recomputeDerivedTotals(db: SupabaseClient, gameIds: readonly string[]): Promise<void> {
  const { data, error } = await db
    .from("platform_games")
    .select("id, user_id")
    .in("game_id", gameIds)
    .in("source", DERIVED_TOTAL_SOURCES);
  check(error);
  const rows = (data ?? []) as { id: string; user_id: string }[];
  if (rows.length === 0) return;
  await recomputeDailyTotals(db, rows[0]!.user_id, rows.map((r) => r.id));
}

/** Moves all platform entries of `sourceGameId` to `targetGameId`; the sync keeps it that way. */
export async function mergeGames(db: SupabaseClient, targetGameId: string, sourceGameId: string): Promise<void> {
  if (targetGameId === sourceGameId) return;
  const moved = await db
    .from("platform_games")
    .update({ game_id: targetGameId, game_link_locked: true })
    .eq("game_id", sourceGameId);
  check(moved.error);
  const locked = await db.from("platform_games").update({ game_link_locked: true }).eq("game_id", targetGameId);
  check(locked.error);
  // The emptied game and its notes are no longer needed.
  const removed = await db.from("games").delete().eq("id", sourceGameId);
  check(removed.error);
  await recomputeDerivedTotals(db, [targetGameId]);
}

/** Gives one platform entry its own game again. Returns the id of the new game. */
export async function splitEntry(
  db: SupabaseClient,
  userId: string,
  entry: { id: string; title: string },
): Promise<string> {
  const before = await db.from("platform_games").select("game_id").eq("id", entry.id).maybeSingle();
  check(before.error);
  const previous = (before.data as { game_id: string | null } | null)?.game_id ?? null;
  const id = crypto.randomUUID();
  const created = await db
    .from("games")
    .insert({ id, user_id: userId, title: entry.title, normalized_title: normalizeTitle(entry.title) });
  check(created.error);
  const moved = await db
    .from("platform_games")
    .update({ game_id: id, game_link_locked: true })
    .eq("id", entry.id);
  check(moved.error);
  await recomputeDerivedTotals(db, previous ? [id, previous] : [id]);
  return id;
}

export interface ManualGameInput {
  title: string;
  deviceKind: DeviceKind;
  /** Lifetime playtime so far; counts as a starting value, not as «played today». */
  minutes: number | null;
  owned: boolean;
}

/** Adds a game without API (disc games, old consoles). Returns the id of its game. */
export async function addManualGame(db: SupabaseClient, userId: string, input: ManualGameInput): Promise<string> {
  const externalId = `manual:${crypto.randomUUID()}`;
  await persistBatch(db, userId, {
    platform: "manual",
    source: "manual",
    devices: [],
    games: [
      {
        externalId,
        title: input.title.trim(),
        deviceKind: input.deviceKind,
        owned: input.owned,
        totalPlaytimeMinutes: input.minutes ?? undefined,
        achievementsUnlocked: null,
        achievementsTotal: null,
      },
    ],
    dailyPlaytime: [],
    achievements: [],
  });
  const { data, error } = await db.from("platform_games").select("game_id").eq("external_id", externalId).single();
  check(error);
  return (data as { game_id: string }).game_id;
}

/** Only entries added by hand can be deleted; the others would come back with the next sync. */
export async function deleteManualEntry(db: SupabaseClient, entryId: string): Promise<void> {
  const { data, error } = await db
    .from("platform_games")
    .select("game_id")
    .eq("id", entryId)
    .eq("platform", "manual")
    .maybeSingle();
  check(error);
  const gameId = (data as { game_id: string | null } | null)?.game_id ?? null;
  const removed = await db.from("platform_games").delete().eq("id", entryId).eq("platform", "manual");
  check(removed.error);
  if (!gameId) return;
  // Remove the game too if this was its last entry.
  const rest = await db.from("platform_games").select("id").eq("game_id", gameId);
  check(rest.error);
  if ((rest.data ?? []).length === 0) {
    const game = await db.from("games").delete().eq("id", gameId);
    check(game.error);
  }
}
