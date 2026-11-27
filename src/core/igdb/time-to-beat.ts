// How long a game takes, from IGDB's own endpoint «game_time_to_beats» (answers of players:
// rushed, normal, everything). Documentation: https://api-docs.igdb.com/#game-time-to-beat
//
// Kept apart from client.ts on purpose: the Edge Function «igdb-search» uses a copy of that
// file, and this endpoint is only needed by the sync.
import { IGDB_MIN_INTERVAL_MS, IgdbError, type IgdbSession } from "./client";

const API = "https://api.igdb.com/v4";
/** IGDB answers at most 500 rows per request. */
export const TIME_TO_BEAT_BATCH = 500;

/** Minutes; null where IGDB has no value. */
export interface TimeToBeat {
  /** Main story, rushed («Hauptstory, schnell»). */
  hastily: number | null;
  /** Main story with some extras: the usual value. */
  normally: number | null;
  /** Everything (100 %). */
  completely: number | null;
  /** How many players answered. */
  count: number;
}

const minutes = (seconds: unknown): number | null =>
  typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds / 60) : null;

/** One row of the endpoint; null if it has no game or no time at all. */
export function parseTimeToBeat(raw: unknown): { igdbId: number; time: TimeToBeat } | null {
  if (raw === null || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.game_id !== "number") return null;
  const time: TimeToBeat = {
    hastily: minutes(row.hastily),
    normally: minutes(row.normally),
    completely: minutes(row.completely),
    count: typeof row.count === "number" ? row.count : 0,
  };
  if (time.hastily === null && time.normally === null && time.completely === null) return null;
  return { igdbId: row.game_id, time };
}

/** Times of the given IGDB games; games IGDB knows no time for are missing from the result. */
export async function fetchTimeToBeat(
  session: IgdbSession,
  igdbIds: readonly number[],
  intervalMs = IGDB_MIN_INTERVAL_MS,
): Promise<Map<number, TimeToBeat>> {
  const out = new Map<number, TimeToBeat>();
  const ids = [...new Set(igdbIds.filter((id) => Number.isInteger(id) && id > 0))];
  for (let i = 0; i < ids.length; i += TIME_TO_BEAT_BATCH) {
    if (i > 0 && intervalMs > 0) await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const batch = ids.slice(i, i + TIME_TO_BEAT_BATCH);
    const body = `fields game_id,hastily,normally,completely,count; where game_id = (${batch.join(",")}); limit ${TIME_TO_BEAT_BATCH};`;
    let response: Response;
    try {
      response = await session.fetch(`${API}/game_time_to_beats`, {
        method: "POST",
        headers: {
          "Client-ID": session.clientId,
          Authorization: `Bearer ${session.accessToken}`,
          Accept: "application/json",
          "Content-Type": "text/plain",
        },
        body,
      });
    } catch {
      throw new IgdbError(0, "IGDB ist nicht erreichbar.");
    }
    if (response.status === 429) throw new IgdbError(429, "IGDB bremst die Abfragen. Der nächste Sync versucht es erneut.");
    if (!response.ok) throw new IgdbError(response.status, `IGDB-Spieldauer antwortet mit einem Fehler (Status ${response.status}).`);
    const rows = (await response.json()) as unknown;
    for (const raw of Array.isArray(rows) ? rows : []) {
      const parsed = parseTimeToBeat(raw);
      if (parsed) out.set(parsed.igdbId, parsed.time);
    }
  }
  return out;
}
