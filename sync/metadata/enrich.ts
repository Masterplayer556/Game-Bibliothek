// After the platform adapters: adds cover, genres and release year from a metadata provider
// and joins games that turn out to be the same (same provider id).
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeTitle } from "../../src/core/normalize-title";
import type { DeviceKind, PlatformId } from "../../src/core/types";
import { fetchAll } from "../../src/data/persist";
import type { Logger } from "../types";
import { searchTitle } from "../../src/core/igdb/match";
import type { GameMetadata, LookupRequest, MetadataProvider } from "./types";

/** Lookups per run (IGDB: 10 per request, 4 requests per second). */
export const MAX_LOOKUPS_PER_RUN = 200;
/** A title without a match is asked again after this many days. */
export const RETRY_MISSES_AFTER_DAYS = 30;

const PLATFORM_DEVICE: Partial<Record<PlatformId, DeviceKind>> = { steam: "pc", psn: "ps5", nintendo: "switch2" };

interface GameRow {
  id: string;
  title: string;
  igdb_id: number | null;
  igdb_locked: boolean;
  cover_url: string | null;
}

interface EntryRow {
  id: string;
  game_id: string | null;
  platform: PlatformId;
  device_kind: DeviceKind | null;
  game_link_locked: boolean;
}

export interface EnrichSummary {
  looked: number;
  fromCache: number;
  matched: number;
  merged: number;
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function cacheKey(title: string): string {
  return normalizeTitle(searchTitle(title));
}

export async function enrichMetadata(options: {
  db: SupabaseClient;
  userId: string;
  provider: MetadataProvider;
  env: Readonly<Record<string, string | undefined>>;
  fetch: typeof fetch;
  now: Date;
  log: Logger;
}): Promise<EnrichSummary> {
  const { db, userId, provider } = options;
  const summary: EnrichSummary = { looked: 0, fromCache: 0, matched: 0, merged: 0 };

  const games = await fetchAll<GameRow>((from, to) =>
    db.from("games").select("id, title, igdb_id, igdb_locked, cover_url").eq("user_id", userId).order("id").range(from, to),
  );
  const entries = await fetchAll<EntryRow>((from, to) =>
    db.from("platform_games").select("id, game_id, platform, device_kind, game_link_locked").eq("user_id", userId).order("id").range(from, to),
  );
  const kindsByGame = new Map<string, Set<DeviceKind>>();
  for (const e of entries) {
    if (!e.game_id) continue;
    const kind = e.device_kind ?? PLATFORM_DEVICE[e.platform];
    if (!kind) continue;
    const set = kindsByGame.get(e.game_id) ?? new Set<DeviceKind>();
    set.add(kind);
    kindsByGame.set(e.game_id, set);
  }

  // 1. What is still missing, and what does the cache already know?
  const open = games.filter((g) => g.igdb_id == null && !g.igdb_locked);
  const cache = new Map<string, { result: GameMetadata | null; fetchedAt: string }>();
  const cached = await fetchAll<{ query_key: string; result: GameMetadata | null; fetched_at: string }>((from, to) =>
    db.from("metadata_cache").select("query_key, result, fetched_at").eq("user_id", userId).eq("provider", provider.id).order("query_key").range(from, to),
  );
  for (const c of cached) cache.set(c.query_key, { result: c.result, fetchedAt: c.fetched_at });

  const retryBefore = options.now.getTime() - RETRY_MISSES_AFTER_DAYS * 86_400_000;
  const requests: LookupRequest[] = [];
  const results = new Map<string, GameMetadata | null>();
  for (const g of open) {
    const key = cacheKey(g.title);
    if (!key || results.has(key) || requests.some((r) => r.key === key)) continue;
    const hit = cache.get(key);
    if (hit && (hit.result || new Date(hit.fetchedAt).getTime() > retryBefore)) {
      results.set(key, hit.result);
      summary.fromCache++;
      continue;
    }
    if (requests.length < MAX_LOOKUPS_PER_RUN) {
      requests.push({ key, title: g.title, deviceKinds: [...(kindsByGame.get(g.id) ?? [])] });
    }
  }

  // 2. Ask the provider and remember every answer, also misses
  if (requests.length > 0) {
    const found = await provider.findMany(options.env, options.fetch, requests);
    summary.looked = requests.length;
    const rows = requests.map((r) => ({
      user_id: userId,
      provider: provider.id,
      query_key: r.key,
      result: found.get(r.key) ?? null,
      fetched_at: options.now.toISOString(),
    }));
    const { error } = await db.from("metadata_cache").upsert(rows, { onConflict: "user_id,provider,query_key" });
    fail(error);
    for (const [key, value] of found) results.set(key, value);
  }

  // 3. Apply to the games (never to games corrected by hand)
  for (const g of open) {
    const meta = results.get(cacheKey(g.title));
    if (!meta) continue;
    const { error } = await db
      .from("games")
      .update({
        igdb_id: meta.providerGameId,
        cover_url: meta.coverUrl ?? g.cover_url,
        genres: meta.genres,
        release_year: meta.releaseYear,
      })
      .eq("id", g.id)
      .eq("igdb_locked", false);
    fail(error);
    g.igdb_id = meta.providerGameId;
    summary.matched++;
  }

  // 4. Same IGDB id = same game: join them
  summary.merged = await mergeByProviderId(db, userId, games, entries);
  options.log.info(
    `${provider.id}: ${summary.looked} looked up, ${summary.fromCache} from cache, ${summary.matched} matched, ${summary.merged} merged`,
  );
  return summary;
}

async function mergeByProviderId(
  db: SupabaseClient,
  userId: string,
  games: readonly GameRow[],
  entries: readonly EntryRow[],
): Promise<number> {
  const byId = new Map<number, GameRow[]>();
  for (const g of games) {
    if (g.igdb_id == null) continue;
    const list = byId.get(g.igdb_id) ?? [];
    list.push(g);
    byId.set(g.igdb_id, list);
  }
  const entryCount = (gameId: string) => entries.filter((e) => e.game_id === gameId).length;
  let merged = 0;
  for (const group of byId.values()) {
    if (group.length < 2) continue;
    const [target, ...others] = [...group].sort(
      (a, b) => Number(b.igdb_locked) - Number(a.igdb_locked) || entryCount(b.id) - entryCount(a.id) || a.id.localeCompare(b.id),
    );
    for (const other of others) {
      const movable = entries.filter((e) => e.game_id === other.id && !e.game_link_locked);
      for (const e of movable) {
        const { error } = await db.from("platform_games").update({ game_id: target!.id }).eq("id", e.id).eq("user_id", userId);
        fail(error);
        (e as { game_id: string | null }).game_id = target!.id;
      }
      if (entries.some((e) => e.game_id === other.id)) continue; // entries split off by hand stay
      // Keep my own notes if only the other game had them.
      const notes = await db.from("game_user_data").select("game_id").eq("game_id", target!.id).maybeSingle();
      fail(notes.error);
      if (!notes.data) {
        const moved = await db.from("game_user_data").update({ game_id: target!.id }).eq("game_id", other.id);
        fail(moved.error);
      }
      const removed = await db.from("games").delete().eq("id", other.id).eq("user_id", userId);
      fail(removed.error);
      merged++;
    }
  }
  return merged;
}

export async function setMetadataStatus(
  db: SupabaseClient,
  userId: string,
  provider: MetadataProvider,
  patch: { status: "ok" | "error" | "not_connected"; configured: boolean; error?: string | null; details?: Record<string, unknown>; success?: boolean },
  now: Date,
): Promise<void> {
  const row: Record<string, unknown> = {
    user_id: userId,
    adapter_id: provider.id,
    platform: provider.id,
    status: patch.status,
    configured: patch.configured,
    last_error: patch.error ?? null,
    last_sync_at: now.toISOString(),
  };
  if (patch.success) row.last_success_at = now.toISOString();
  if (patch.details) row.details = patch.details;
  const { error } = await db.from("platform_connections").upsert(row, { onConflict: "user_id,adapter_id" });
  fail(error);
}
