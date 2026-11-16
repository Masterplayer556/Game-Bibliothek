// Browser side of the Nintendo features. Kept apart from the components that display them.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLoginRequest, isNintendoLoginUrl, type NintendoLoginRequest } from "@/core/nintendo/auth";
import { buildImportBatch, type ImportRow } from "@/core/nintendo/import";
import { fetchAll, persistBatch, type PersistSummary } from "@/data/persist";
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

/** Saves parsed history rows. Importing the same file again changes nothing. */
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
  return persistBatch(db, userId, batch);
}
