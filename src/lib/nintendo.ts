// Browser side of the Nintendo features. Kept apart from the components that display them.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLoginRequest, isNintendoLoginUrl, type NintendoLoginRequest } from "@/core/nintendo/auth";
import { buildImportBatch, NINTENDO_IMPORT_ID, supersededImportRows, type ImportRow } from "@/core/nintendo/import";
import type { SyncBatch } from "@/core/types";
import { fetchAll, persistBatch, recomputeDailyTotals, type PersistSummary } from "@/data/persist";
import { invokeFunction } from "./functions";

const STORAGE_KEY = "game-bibliothek.nintendo-login";

/**
 * The login link and its secret counterpart (verifier). Stored locally, because the login
 * happens in another tab and the page may be reloaded in between.
 */
export async function prepareLogin(forceNew = false): Promise<NintendoLoginRequest> {
  if (!forceNew) {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as
        | (NintendoLoginRequest & { createdAt: number })
        | null;
      // Nintendo's login page does not stay valid forever: reuse for half an hour at most.
      // The address ends up in a link: only ever reuse one that really points to Nintendo.
      if (stored && isNintendoLoginUrl(stored.url) && stored.verifier && Date.now() - stored.createdAt < 30 * 60 * 1000) {
        return stored;
      }
    } catch {
      // unreadable entry: create a new one
    }
  }
  const request = await createLoginRequest();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...request, createdAt: Date.now() }));
  return request;
}

export interface NintendoLoginResult {
  expiresAt: string | null;
  devices: { label: string; kind: string }[] | null;
}

export async function finishLogin(
  db: SupabaseClient,
  link: string,
  login: NintendoLoginRequest,
): Promise<NintendoLoginResult> {
  const result = await invokeFunction<Partial<NintendoLoginResult>>(
    db,
    "nintendo-login",
    { link, verifier: login.verifier, state: login.state },
    "Die Anmeldung ist fehlgeschlagen. Bitte noch einmal versuchen.",
  );
  localStorage.removeItem(STORAGE_KEY);
  return { expiresAt: result.expiresAt ?? null, devices: result.devices ?? null };
}

/**
 * Saves parsed history rows. Importing the same days again changes nothing: per game and day
 * the new import replaces what an earlier one stored.
 */
export async function importHistory(
  db: SupabaseClient,
  userId: string,
  rows: readonly ImportRow[],
): Promise<PersistSummary> {
  const existingGames = await fetchAll<{ external_id: string; title: string }>((from, to) =>
    db.from("platform_games").select("external_id, title").eq("platform", "nintendo").order("id").range(from, to),
  );
  const existingDevices = await fetchAll<{ external_id: string; kind: string }>((from, to) =>
    db.from("devices").select("external_id, kind").eq("platform", "nintendo").order("id").range(from, to),
  );
  const batch = buildImportBatch(rows, {
    existingGames: existingGames.map((g) => ({ externalId: g.external_id, title: g.title })),
    existingDevices: existingDevices.map((d) => ({ externalId: d.external_id, kind: d.kind })),
  });
  const summary = await persistBatch(db, userId, batch);
  await replaceEarlierImport(db, userId, batch);
  return summary;
}

async function replaceEarlierImport(db: SupabaseClient, userId: string, batch: SyncBatch): Promise<void> {
  if (batch.dailyPlaytime.length === 0) return;
  const entries = await fetchAll<{ id: string; external_id: string; game_id: string | null }>((from, to) =>
    db.from("platform_games").select("id, external_id, game_id").eq("platform", "nintendo").order("id").range(from, to),
  );
  const devices = await fetchAll<{ id: string; external_id: string }>((from, to) =>
    db.from("devices").select("id, external_id").eq("platform", "nintendo").order("id").range(from, to),
  );
  const entryByExternalId = new Map(entries.map((e) => [e.external_id, e]));
  const deviceByExternalId = new Map(devices.map((d) => [d.external_id, d.id]));
  const gameOf = new Map(entries.map((e) => [e.id, e.game_id ?? e.id]));

  const written = batch.dailyPlaytime.flatMap((r) => {
    const entry = entryByExternalId.get(r.gameExternalId);
    const deviceId = deviceByExternalId.get(r.deviceExternalId);
    return entry && deviceId ? [{ platformGameId: entry.id, deviceId, date: r.date }] : [];
  });
  const games = new Set(written.map((r) => gameOf.get(r.platformGameId)));
  const candidates = entries.filter((e) => games.has(e.game_id ?? e.id)).map((e) => e.id);

  const stored: { id: number; platformGameId: string; deviceId: string; date: string }[] = [];
  for (let i = 0; i < candidates.length; i += 100) {
    const ids = candidates.slice(i, i + 100);
    const rows = await fetchAll<{ id: number; platform_game_id: string; device_id: string; play_date: string }>((from, to) =>
      db
        .from("daily_playtime")
        .select("id, platform_game_id, device_id, play_date")
        .eq("source", NINTENDO_IMPORT_ID)
        .in("platform_game_id", ids)
        .order("id")
        .range(from, to),
    );
    stored.push(...rows.map((r) => ({ id: r.id, platformGameId: r.platform_game_id, deviceId: r.device_id, date: r.play_date })));
  }

  const stale = supersededImportRows(stored, written, (id) => gameOf.get(id));
  if (stale.length === 0) return;
  for (let i = 0; i < stale.length; i += 100) {
    const { error } = await db.from("daily_playtime").delete().in("id", stale.slice(i, i + 100));
    if (error) throw new Error(`Database error while replacing the earlier import: ${error.message}`);
  }
  const touched = new Set(stored.filter((r) => stale.includes(r.id)).map((r) => r.platformGameId));
  await recomputeDailyTotals(db, userId, [...touched]);
}
