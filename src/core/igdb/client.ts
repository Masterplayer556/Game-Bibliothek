// Client for IGDB (owned by Twitch). Login with a Twitch app (client id + secret).
// Documentation: https://api-docs.igdb.com
//
// IMPORTANT: this file must not import anything. The Edge Function «igdb-search» uses a copy
// of it (Deno).

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const API = "https://api.igdb.com/v4";

/** IGDB allows 4 requests per second. */
export const IGDB_MIN_INTERVAL_MS = 260;

export class IgdbError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "IgdbError";
    this.status = status;
  }
}

export interface IgdbCredentials {
  clientId: string;
  clientSecret: string;
}

export interface IgdbSession {
  clientId: string;
  accessToken: string;
  fetch: typeof fetch;
}

/** One search hit, already shaped for the app (German genre names). */
export interface IgdbGame {
  igdbId: number;
  title: string;
  alternativeNames: string[];
  coverUrl: string | null;
  genres: string[];
  releaseYear: number | null;
  platformIds: number[];
  /** popularity, for tie-breaks */
  ratingCount: number;
}

/** IGDB platform ids of the consoles this app knows. */
export const IGDB_PLATFORM: Record<string, number[]> = {
  pc: [6],
  ps5: [167, 48],
  ps4: [48],
  switch1: [130],
  switch2: [508, 130],
  xbox360: [12],
};

/** IGDB's fixed genre list in German. Unknown names stay as IGDB sends them. */
const GENRE_DE: Record<string, string> = {
  "Point-and-click": "Point-and-Click",
  Fighting: "Kampfspiel",
  Shooter: "Shooter",
  Music: "Musik",
  Platform: "Jump 'n' Run",
  Puzzle: "Puzzle",
  Racing: "Rennspiel",
  "Real Time Strategy (RTS)": "Echtzeitstrategie",
  "Role-playing (RPG)": "Rollenspiel",
  Simulator: "Simulation",
  Sport: "Sport",
  Strategy: "Strategie",
  "Turn-based strategy (TBS)": "Rundenstrategie",
  Tactical: "Taktik",
  "Hack and slash/Beat 'em up": "Hack and Slash",
  "Quiz/Trivia": "Quiz",
  Pinball: "Flipper",
  Adventure: "Abenteuer",
  Indie: "Indie",
  Arcade: "Arcade",
  "Visual Novel": "Visual Novel",
  "Card & Board Game": "Karten- und Brettspiel",
  MOBA: "MOBA",
};

export function germanGenre(name: string): string {
  return GENRE_DE[name] ?? name;
}

export function coverUrl(imageId: string | null | undefined): string | null {
  return imageId ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg` : null;
}

export async function login(fetchFn: typeof fetch, credentials: IgdbCredentials): Promise<IgdbSession> {
  // In the body, not in the address: addresses end up in logs of servers in between.
  const form = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    grant_type: "client_credentials",
  });
  let response: Response;
  try {
    response = await fetchFn(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
  } catch {
    throw new IgdbError(0, "Twitch ist nicht erreichbar.");
  }
  const body = (await response.json().catch(() => ({}))) as { access_token?: unknown };
  if (!response.ok || typeof body.access_token !== "string") {
    throw new IgdbError(
      response.status,
      response.status === 400 || response.status === 403
        ? "Twitch lehnt die Zugangsdaten ab. Bitte IGDB_CLIENT_ID und IGDB_CLIENT_SECRET prüfen."
        : `Twitch antwortet mit einem Fehler (Status ${response.status}).`,
    );
  }
  return { clientId: credentials.clientId, accessToken: body.access_token, fetch: fetchFn };
}

const FIELDS = "name,alternative_names.name,cover.image_id,genres.name,first_release_date,platforms,total_rating_count";

/**
 * Only real games: main game (0), standalone expansion (4), remake (8), remaster (9),
 * expanded game (10), port (11). Without this, DLCs and seasons can outrank the game itself
 * («Fall Guys: … Season 3»). Versions of a game (editions) are left out as well.
 */
const GAME_FILTER = "version_parent = null & game_type = (0,4,8,9,10,11)";

/** Apicalypse strings are quoted with double quotes. */
function quote(text: string): string {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => v !== null && typeof v === "object" && !Array.isArray(v);

export function parseGame(raw: unknown): IgdbGame | null {
  if (!isObject(raw) || typeof raw.id !== "number" || typeof raw.name !== "string") return null;
  const names = (Array.isArray(raw.alternative_names) ? raw.alternative_names : [])
    .map((a) => (isObject(a) && typeof a.name === "string" ? a.name : null))
    .filter((n): n is string => n !== null);
  const genres = (Array.isArray(raw.genres) ? raw.genres : [])
    .map((g) => (isObject(g) && typeof g.name === "string" ? germanGenre(g.name) : null))
    .filter((g): g is string => g !== null);
  const release = typeof raw.first_release_date === "number" ? new Date(raw.first_release_date * 1000).getUTCFullYear() : null;
  return {
    igdbId: raw.id,
    title: raw.name,
    alternativeNames: names,
    coverUrl: coverUrl(isObject(raw.cover) && typeof raw.cover.image_id === "string" ? raw.cover.image_id : null),
    genres: [...new Set(genres)],
    releaseYear: release,
    platformIds: (Array.isArray(raw.platforms) ? raw.platforms : []).filter((p): p is number => typeof p === "number"),
    ratingCount: typeof raw.total_rating_count === "number" ? raw.total_rating_count : 0,
  };
}

async function post(session: IgdbSession, path: string, body: string): Promise<unknown> {
  let response: Response;
  try {
    response = await session.fetch(`${API}${path}`, {
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
  if (response.status === 401 || response.status === 403) {
    throw new IgdbError(response.status, "IGDB lehnt die Anmeldung ab. Bitte IGDB_CLIENT_ID und IGDB_CLIENT_SECRET prüfen.");
  }
  if (response.status === 429) throw new IgdbError(429, "IGDB bremst die Abfragen. Der nächste Sync versucht es erneut.");
  if (!response.ok) throw new IgdbError(response.status, `IGDB antwortet mit einem Fehler (Status ${response.status}).`);
  return response.json();
}

/** One search, e.g. for the «choose another game» dialog. */
export async function searchGames(session: IgdbSession, query: string, limit = 10): Promise<IgdbGame[]> {
  const text = query.trim();
  if (!text) return [];
  const body = `search ${quote(text)}; fields ${FIELDS}; where ${GAME_FILTER}; limit ${limit};`;
  const result = await post(session, "/games", body);
  return (Array.isArray(result) ? result : []).map(parseGame).filter((g): g is IgdbGame => g !== null);
}

/**
 * Several searches, one request each, at most 4 per second. (IGDB's multiquery endpoint
 * answers searches with an empty list, checked on 13.11.2026, so it cannot be used here.)
 */
export async function searchMany(
  session: IgdbSession,
  queries: readonly { key: string; title: string }[],
  limit = 10,
  intervalMs = IGDB_MIN_INTERVAL_MS,
): Promise<Map<string, IgdbGame[]>> {
  const out = new Map<string, IgdbGame[]>();
  for (let i = 0; i < queries.length; i++) {
    if (i > 0 && intervalMs > 0) await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const q = queries[i]!;
    out.set(q.key, await searchGames(session, q.title, limit));
  }
  return out;
}
