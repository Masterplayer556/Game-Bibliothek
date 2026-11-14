// Writes a SyncBatch to the database. Works with any Supabase client: the secret-key
// client of the sync script and the logged-in browser client (demo data, imports).
import type { SupabaseClient } from "@supabase/supabase-js";
import { findGameMatch, type KnownGame } from "../core/match-games";
import { normalizeTitle } from "../core/normalize-title";
import { isImportSource, resolveDailyRows, shouldWriteSnapshot } from "../core/playtime";
import type { SyncBatch } from "../core/types";

export interface PersistSummary {
  devices: number;
  games: number;
  newGames: number;
  snapshots: number;
  dailyRows: number;
  achievements: number;
}

const CHUNK = 500;
const PAGE = 1000;

function chunks<T>(items: readonly T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function fail(step: string, error: { message: string } | null): void {
  if (error) throw new Error(`Database error while saving ${step}: ${error.message}`);
}

/**
 * Reads every row of a query, page by page (the API returns at most 1000 rows at once).
 * The query must have a fixed order (`.order(…)` on a unique column): without one, Postgres
 * may return pages that overlap or skip rows.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    fail("read", error);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

interface ExistingPlatformGame {
  id: string;
  external_id: string;
  game_id: string | null;
  cover_url: string | null;
  device_kind: string | null;
  owned: boolean;
  first_played_at: string | null;
  last_played_at: string | null;
  total_playtime_minutes: number;
  achievements_unlocked: number | null;
  achievements_total: number | null;
}

function earlier(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a) <= new Date(b) ? a : b;
}

function later(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a) >= new Date(b) ? a : b;
}

export async function persistBatch(
  db: SupabaseClient,
  userId: string,
  batch: SyncBatch,
  now: Date = new Date(),
): Promise<PersistSummary> {
  const summary: PersistSummary = {
    devices: 0,
    games: 0,
    newGames: 0,
    snapshots: 0,
    dailyRows: 0,
    achievements: 0,
  };
  const nowIso = now.toISOString();

  // 1. Devices
  const deviceIds = new Map<string, string>();
  if (batch.devices.length > 0) {
    const { data, error } = await db
      .from("devices")
      .upsert(
        batch.devices.map((d) => ({
          user_id: userId,
          platform: batch.platform,
          kind: d.kind,
          label: d.label,
          external_id: d.externalId,
          source: batch.source,
        })),
        { onConflict: "user_id,platform,external_id" },
      )
      .select("id, external_id");
    fail("devices", error);
    summary.devices = (data ?? []).length;
  }
  // Devices that already exist can be referenced without being part of the batch
  // (an import adds days to a console that another source created).
  const knownDevices = await fetchAll<{ id: string; external_id: string }>((from, to) =>
    db
      .from("devices")
      .select("id, external_id")
      .eq("user_id", userId)
      .eq("platform", batch.platform)
      .order("id")
      .range(from, to),
  );
  for (const row of knownDevices) deviceIds.set(row.external_id, row.id);

  // 2. Existing platform entries and known games
  const existing = await fetchAll<ExistingPlatformGame>((from, to) =>
    db
      .from("platform_games")
      .select(
        "id, external_id, game_id, cover_url, device_kind, owned, first_played_at, last_played_at, total_playtime_minutes, achievements_unlocked, achievements_total",
      )
      .eq("user_id", userId)
      .eq("platform", batch.platform)
      .order("id")
      .range(from, to),
  );
  const existingByExternalId = new Map(existing.map((row) => [row.external_id, row]));

  const knownRows = await fetchAll<{ id: string; normalized_title: string; igdb_id: number | null }>(
    (from, to) =>
      db.from("games").select("id, normalized_title, igdb_id").eq("user_id", userId).order("id").range(from, to),
  );
  const known: KnownGame[] = knownRows.map((g) => ({
    id: g.id,
    normalizedTitle: g.normalized_title,
    igdbId: g.igdb_id,
  }));

  // 3. Link every platform entry to a game; create missing games
  const newGames: Record<string, unknown>[] = [];
  const platformRows = batch.games.map((game) => {
    const prev = existingByExternalId.get(game.externalId);
    let gameId = prev?.game_id ?? null;
    if (!gameId) {
      const match = findGameMatch(known, game.title);
      if (match) {
        gameId = match.id;
      } else {
        gameId = crypto.randomUUID();
        const normalized = normalizeTitle(game.title);
        newGames.push({
          id: gameId,
          user_id: userId,
          title: game.title,
          normalized_title: normalized,
          cover_url: game.coverUrl ?? null,
        });
        known.push({ id: gameId, normalizedTitle: normalized, igdbId: null });
      }
    }
    return {
      id: prev?.id ?? crypto.randomUUID(),
      user_id: userId,
      game_id: gameId,
      platform: batch.platform,
      source: batch.source,
      external_id: game.externalId,
      title: game.title,
      cover_url: game.coverUrl ?? prev?.cover_url ?? null,
      device_kind: game.deviceKind ?? prev?.device_kind ?? null,
      owned: game.owned ?? prev?.owned ?? true,
      first_played_at: earlier(prev?.first_played_at, game.firstPlayedAt),
      last_played_at: later(prev?.last_played_at, game.lastPlayedAt),
      total_playtime_minutes: game.totalPlaytimeMinutes ?? prev?.total_playtime_minutes ?? 0,
      achievements_unlocked:
        game.achievementsUnlocked !== undefined
          ? game.achievementsUnlocked
          : (prev?.achievements_unlocked ?? null),
      achievements_total:
        game.achievementsTotal !== undefined
          ? game.achievementsTotal
          : (prev?.achievements_total ?? null),
      raw: game.raw ?? {},
    };
  });

  for (const part of chunks(newGames)) {
    const { error } = await db.from("games").insert(part);
    fail("games", error);
  }
  summary.newGames = newGames.length;

  // An import only adds days. It never takes over an entry that another source created.
  const rowsToWrite = isImportSource(batch.source)
    ? platformRows.filter((row) => !existingByExternalId.has(row.external_id))
    : platformRows;
  for (const part of chunks(rowsToWrite)) {
    const { error } = await db
      .from("platform_games")
      .upsert(part, { onConflict: "user_id,platform,external_id" });
    fail("platform games", error);
  }
  summary.games = platformRows.length;

  const platformGameIds = new Map(platformRows.map((row) => [row.external_id, row.id]));
  for (const row of existing) {
    if (!platformGameIds.has(row.external_id)) platformGameIds.set(row.external_id, row.id);
  }
  const idOf = (externalId: string, what: string): string => {
    const id = platformGameIds.get(externalId);
    if (!id) throw new Error(`${what} refers to a game that is not part of the batch`);
    return id;
  };

  // 4. Snapshots: only when a reported total is new or has changed
  const snapshotRows: Record<string, unknown>[] = [];
  for (const game of batch.games) {
    if (game.totalPlaytimeMinutes === undefined) continue;
    const prev = existingByExternalId.get(game.externalId);
    if (!shouldWriteSnapshot(prev?.total_playtime_minutes, game.totalPlaytimeMinutes)) continue;
    snapshotRows.push({
      user_id: userId,
      platform_game_id: idOf(game.externalId, "Snapshot"),
      taken_at: nowIso,
      total_minutes: game.totalPlaytimeMinutes,
      last_played_at: game.lastPlayedAt ?? null,
      source: batch.source,
    });
  }
  for (const snapshot of batch.snapshots ?? []) {
    snapshotRows.push({
      user_id: userId,
      platform_game_id: idOf(snapshot.gameExternalId, "Snapshot"),
      taken_at: snapshot.takenAt,
      total_minutes: snapshot.totalMinutes,
      last_played_at: snapshot.lastPlayedAt ?? null,
      source: batch.source,
    });
  }
  for (const part of chunks(snapshotRows)) {
    const { error } = await db
      .from("playtime_snapshots")
      .upsert(part, { onConflict: "platform_game_id,taken_at" });
    fail("snapshots", error);
  }
  summary.snapshots = snapshotRows.length;

  // 5. Per-day playtime
  const dailyRows = batch.dailyPlaytime.map((row) => {
    const deviceId = deviceIds.get(row.deviceExternalId);
    if (!deviceId) throw new Error("Daily playtime refers to a device that is not part of the batch");
    return {
      user_id: userId,
      platform_game_id: idOf(row.gameExternalId, "Daily playtime"),
      device_id: deviceId,
      play_date: row.date,
      minutes: Math.max(0, Math.round(row.minutes)),
      source: batch.source,
      estimated: row.estimated ?? false,
      details: row.details ?? {},
    };
  });
  for (const part of chunks(dailyRows)) {
    const { error } = await db
      .from("daily_playtime")
      .upsert(part, { onConflict: "platform_game_id,device_id,play_date,source" });
    fail("daily playtime", error);
  }
  summary.dailyRows = dailyRows.length;

  // 6. Games without a reported lifetime total: derive it from the per-day rows
  const derived = batch.games.filter((g) => g.totalPlaytimeMinutes === undefined);
  if (derived.length > 0) {
    await recomputeDailyTotals(
      db,
      userId,
      derived.map((g) => idOf(g.externalId, "Game")),
    );
  }

  // 7. Achievements
  const achievementRows = batch.achievements.map((a) => ({
    user_id: userId,
    platform_game_id: idOf(a.gameExternalId, "Achievement"),
    external_id: a.externalId,
    name: a.name,
    description: a.description ?? null,
    icon_url: a.iconUrl ?? null,
    unlocked_at: a.unlockedAt ?? null,
    rarity_percent: a.rarityPercent ?? null,
    tier: a.tier ?? null,
    hidden: a.hidden ?? false,
  }));
  for (const part of chunks(achievementRows)) {
    const { error } = await db
      .from("achievements")
      .upsert(part, { onConflict: "platform_game_id,external_id" });
    fail("achievements", error);
  }
  summary.achievements = achievementRows.length;

  return summary;
}

/**
 * For sources that only know per-day values (Nintendo): lifetime total, first and last
 * played are the sum / range of the per-day rows that count (see resolveDailyRows).
 *
 * An import and a native source can have separate platform entries for the same game.
 * Which rows count is therefore decided per linked game, and the totals of all entries of
 * the affected games on that platform are recomputed.
 */
export async function recomputeDailyTotals(
  db: SupabaseClient,
  userId: string,
  platformGameIds: readonly string[],
): Promise<void> {
  if (platformGameIds.length === 0) return;

  // 1. The games behind the given entries
  const requested: { id: string; game_id: string | null; platform: string }[] = [];
  for (const ids of chunks(platformGameIds, 100)) {
    const { data, error } = await db
      .from("platform_games")
      .select("id, game_id, platform")
      .eq("user_id", userId)
      .in("id", ids);
    fail("read", error);
    requested.push(...((data ?? []) as typeof requested));
  }
  const gameIds = [...new Set(requested.map((r) => r.game_id).filter((id): id is string => !!id))];
  const platforms = new Set(requested.map((r) => r.platform));

  // 2. Every entry of those games on the same platform(s)
  const entries = new Map<string, { gameKey: string; previousTotal: number | null }>();
  for (const row of requested) entries.set(row.id, { gameKey: row.game_id ?? row.id, previousTotal: null });
  for (const ids of chunks(gameIds, 100)) {
    const { data, error } = await db
      .from("platform_games")
      .select("id, game_id, platform")
      .eq("user_id", userId)
      .in("game_id", ids);
    fail("read", error);
    for (const row of (data ?? []) as typeof requested) {
      if (platforms.has(row.platform)) {
        entries.set(row.id, { gameKey: row.game_id ?? row.id, previousTotal: null });
      }
    }
  }

  // 3. Their per-day rows, resolved per game
  const allIds = [...entries.keys()];
  const dailyRows: Parameters<typeof resolveDailyRows>[0][number][] = [];
  for (const ids of chunks(allIds, 100)) {
    const rows = await fetchAll<{
      platform_game_id: string;
      device_id: string;
      play_date: string;
      minutes: number;
      source: string;
    }>((from, to) =>
      db
        .from("daily_playtime")
        .select("platform_game_id, device_id, play_date, minutes, source")
        .eq("user_id", userId)
        .in("platform_game_id", ids)
        .order("id")
        .range(from, to),
    );
    for (const r of rows) {
      dailyRows.push({
        platformGameId: r.platform_game_id,
        gameKey: entries.get(r.platform_game_id)?.gameKey,
        deviceId: r.device_id,
        date: r.play_date,
        minutes: r.minutes,
        source: r.source,
      });
    }
  }

  const totals = new Map<string, { minutes: number; first: string; last: string }>();
  for (const day of resolveDailyRows(dailyRows)) {
    const t = totals.get(day.platformGameId);
    if (!t) {
      totals.set(day.platformGameId, { minutes: day.minutes, first: day.date, last: day.date });
    } else {
      t.minutes += day.minutes;
      if (day.date < t.first) t.first = day.date;
      if (day.date > t.last) t.last = day.date;
    }
  }

  // 4. Write the totals. Entries whose rows no longer count drop to zero.
  for (const id of allIds) {
    const t = totals.get(id);
    const patch = t
      ? {
          total_playtime_minutes: t.minutes,
          // noon UTC keeps the calendar day stable in Europe/Zurich
          first_played_at: `${t.first}T12:00:00Z`,
          last_played_at: `${t.last}T12:00:00Z`,
        }
      : { total_playtime_minutes: 0 };
    const { error } = await db.from("platform_games").update(patch).eq("id", id).eq("user_id", userId);
    fail("playtime totals", error);
  }
}

export async function deleteDemoData(db: SupabaseClient): Promise<void> {
  const { error } = await db.rpc("delete_demo_data");
  fail("demo data removal", error);
}
