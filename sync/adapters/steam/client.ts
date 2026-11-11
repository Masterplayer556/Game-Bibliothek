// Client for the official Steam Web API. Documentation: https://partner.steamgames.com/doc/webapi
// The API key is sent as a query parameter (Steam does not accept it in a header), so URLs
// must never be logged.

const BASE = "https://api.steampowered.com";

export class SteamApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "SteamApiError";
    this.status = status;
  }
}

export interface SteamOptions {
  fetch: typeof fetch;
  apiKey: string;
  /** German names and descriptions where Steam has them. */
  language?: string;
}

export interface OwnedGame {
  appId: number;
  name: string;
  playtimeMinutes: number;
  /** Unix seconds, 0 = never played */
  lastPlayed: number;
  hasStats: boolean;
}

export interface PlayerAchievement {
  apiName: string;
  achieved: boolean;
  /** Unix seconds, 0 if not unlocked */
  unlockTime: number;
}

export interface SchemaAchievement {
  apiName: string;
  displayName: string;
  description: string | null;
  icon: string | null;
  hidden: boolean;
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => v !== null && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN);

async function get(options: SteamOptions, path: string, params: Record<string, string>): Promise<{ status: number; body: unknown }> {
  const query = new URLSearchParams({ ...params, key: options.apiKey, format: "json" });
  let response: Response;
  try {
    response = await options.fetch(`${BASE}${path}?${query.toString()}`, { headers: { Accept: "application/json" } });
  } catch {
    throw new SteamApiError(0, "Steam ist nicht erreichbar.");
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

function raise(status: number): never {
  if (status === 401 || status === 403) {
    throw new SteamApiError(status, "Steam lehnt den API-Key ab. Bitte STEAM_API_KEY prüfen.");
  }
  if (status === 429) throw new SteamApiError(status, "Steam bremst die Abfragen. Der nächste Sync versucht es erneut.");
  throw new SteamApiError(status, `Steam antwortet mit einem Fehler (Status ${status}).`);
}

/** SteamID64, or a custom profile name («vanity URL») resolved to one. */
export async function resolveSteamId(options: SteamOptions, input: string): Promise<string> {
  const text = input.trim().replace(/\/$/, "");
  const fromUrl = /steamcommunity\.com\/(profiles|id)\/([^/?#]+)/.exec(text);
  const value = fromUrl ? fromUrl[2]! : text;
  if (/^7656\d{13}$/.test(value)) return value;
  const { status, body } = await get(options, "/ISteamUser/ResolveVanityURL/v1/", { vanityurl: value });
  if (status !== 200) raise(status);
  const response = isObject(body) && isObject(body.response) ? body.response : {};
  if (response.success === 1 && typeof response.steamid === "string") return response.steamid;
  throw new SteamApiError(404, "STEAM_ID ist weder eine SteamID64 noch ein bekannter Profilname.");
}

export async function getOwnedGames(options: SteamOptions, steamId: string): Promise<OwnedGame[]> {
  const { status, body } = await get(options, "/IPlayerService/GetOwnedGames/v1/", {
    steamid: steamId,
    include_appinfo: "1",
    include_played_free_games: "1",
    skip_unvetted_apps: "0",
  });
  if (status !== 200) raise(status);
  const response = isObject(body) && isObject(body.response) ? body.response : {};
  // A private profile answers with an empty object instead of an error.
  if (!Array.isArray(response.games)) {
    throw new SteamApiError(
      200,
      "Steam liefert keine Spiele. Sind die Spieldetails im Steam-Profil auf «Öffentlich» gestellt?",
    );
  }
  const games: OwnedGame[] = [];
  for (const g of response.games) {
    if (!isObject(g)) continue;
    const appId = num(g.appid);
    if (!Number.isInteger(appId)) continue;
    games.push({
      appId,
      name: typeof g.name === "string" && g.name !== "" ? g.name : `App ${appId}`,
      playtimeMinutes: Math.max(0, num(g.playtime_forever) || 0),
      lastPlayed: Math.max(0, num(g.rtime_last_played) || 0),
      hasStats: g.has_community_visible_stats === true,
    });
  }
  return games;
}

/** null = the game has no achievements (Steam answers 400 «no stats»). */
export async function getPlayerAchievements(
  options: SteamOptions,
  steamId: string,
  appId: number,
): Promise<PlayerAchievement[] | null> {
  const { status, body } = await get(options, "/ISteamUserStats/GetPlayerAchievements/v1/", {
    steamid: steamId,
    appid: String(appId),
    l: options.language ?? "german",
  });
  const stats = isObject(body) && isObject(body.playerstats) ? body.playerstats : null;
  if (status === 400 || (stats && stats.success === false)) return null;
  if (status !== 200) raise(status);
  const list = stats && Array.isArray(stats.achievements) ? stats.achievements : [];
  return list.filter(isObject).map((a) => ({
    apiName: String(a.apiname ?? ""),
    achieved: num(a.achieved) === 1,
    unlockTime: Math.max(0, num(a.unlocktime) || 0),
  }));
}

export async function getSchemaAchievements(options: SteamOptions, appId: number): Promise<SchemaAchievement[]> {
  const { status, body } = await get(options, "/ISteamUserStats/GetSchemaForGame/v2/", {
    appid: String(appId),
    l: options.language ?? "german",
  });
  if (status === 400 || status === 404) return [];
  if (status !== 200) raise(status);
  const game = isObject(body) && isObject(body.game) ? body.game : {};
  const stats = isObject(game.availableGameStats) ? game.availableGameStats : {};
  const list = Array.isArray(stats.achievements) ? stats.achievements : [];
  return list.filter(isObject).map((a) => ({
    apiName: String(a.name ?? ""),
    displayName: typeof a.displayName === "string" && a.displayName !== "" ? a.displayName : String(a.name ?? ""),
    description: typeof a.description === "string" && a.description !== "" ? a.description : null,
    icon: typeof a.icon === "string" && a.icon !== "" ? a.icon : null,
    hidden: num(a.hidden) === 1,
  }));
}

/** Share of all players who unlocked each achievement, by API name. Public, no key needed. */
export async function getGlobalPercentages(options: SteamOptions, appId: number): Promise<Map<string, number>> {
  const { status, body } = await get(options, "/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/", {
    gameid: String(appId),
  });
  const out = new Map<string, number>();
  if (status !== 200) return out;
  const root = isObject(body) && isObject(body.achievementpercentages) ? body.achievementpercentages : {};
  for (const a of Array.isArray(root.achievements) ? root.achievements : []) {
    if (!isObject(a)) continue;
    const percent = num(a.percent);
    if (typeof a.name === "string" && Number.isFinite(percent)) out.set(a.name, Math.round(percent * 10) / 10);
  }
  return out;
}

/** Steam's own cover images (CDN, no key needed). */
export function headerImageUrl(appId: number): string {
  return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
}
