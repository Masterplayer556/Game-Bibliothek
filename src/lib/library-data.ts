// Reads everything the app shows in one go and writes my own changes.
// The data of one person fits comfortably in the browser; all statistics are computed there.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RawData } from "@/core/library";
import { normalizeTitle } from "@/core/normalize-title";
import type { DeviceKind, GameStatus } from "@/core/types";
import { deleteDemoData, fetchAll, persistBatch } from "@/data/persist";

export async function loadRawData(db: SupabaseClient): Promise<RawData> {
  // Column lists are dynamic strings, so the client cannot infer row types: cast once here.
  const all = <T>(table: string, columns: string, order = "id") =>
    fetchAll<T>(
      (from, to) =>
        db.from(table).select(columns).order(order).range(from, to) as unknown as PromiseLike<{
          data: T[] | null;
          error: { message: string } | null;
        }>,
    );

  const [games, platformGames, devices, daily, snapshots, achievements, userData, connections, settings] =
    await Promise.all([
      all<RawData["games"][number]>("games", "id, title, cover_url, genres, release_year, igdb_id"),
      all<RawData["platformGames"][number]>(
        "platform_games",
        "id, game_id, platform, source, external_id, title, cover_url, device_kind, owned, first_played_at, last_played_at, total_playtime_minutes, achievements_unlocked, achievements_total",
      ),
      all<RawData["devices"][number]>("devices", "id, platform, kind, label"),
      all<RawData["daily"][number]>("daily_playtime", "platform_game_id, device_id, play_date, minutes, source, estimated"),
      all<RawData["snapshots"][number]>("playtime_snapshots", "platform_game_id, taken_at, total_minutes, last_played_at"),
      all<RawData["achievements"][number]>(
        "achievements",
        "platform_game_id, external_id, name, description, icon_url, unlocked_at, rarity_percent, tier",
      ),
      all<RawData["userData"][number]>("game_user_data", "game_id, status, favorite, note, hide_from_pile, hidden", "game_id"),
      all<RawData["connections"][number]>(
        "platform_connections",
        "adapter_id, platform, status, enabled, configured, last_sync_at, last_success_at, last_error, data_since, token_expires_at, details",
        "adapter_id",
      ),
      all<{ settings: Record<string, unknown> }>("app_settings", "settings", "user_id"),
    ]);

  return {
    games,
    platformGames,
    devices,
    daily,
    snapshots,
    achievements: achievements.map((a) => ({ ...a, rarity_percent: a.rarity_percent == null ? null : Number(a.rarity_percent) })),
    userData,
    connections,
    settings: settings[0]?.settings ?? {},
  };
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
}

/** Gives one platform entry its own game again. Returns the id of the new game. */
export async function splitEntry(
  db: SupabaseClient,
  userId: string,
  entry: { id: string; title: string },
): Promise<string> {
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

/** Replaces the demo data (the 14-month window ends yesterday). */
export async function loadDemoData(db: SupabaseClient, userId: string): Promise<void> {
  const { buildDemoBatches } = await import("@/core/demo");
  await deleteDemoData(db);
  const now = new Date();
  for (const batch of buildDemoBatches(now)) await persistBatch(db, userId, batch, now);
}

export async function removeDemoData(db: SupabaseClient): Promise<void> {
  await deleteDemoData(db);
}
