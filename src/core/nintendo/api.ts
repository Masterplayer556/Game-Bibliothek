// Client for the API behind the «Nintendo Switch Parental Controls» app (version 2).
//
// IMPORTANT: this file must not import anything (see auth.ts for the reason).
//
// Only endpoints documented by the open-source project pynintendoparental (MIT) are used.
// Nintendo publishes no specification, so every response is parsed defensively: unknown
// fields are ignored and both known spellings of a field are accepted.

export const NINTENDO_API_BASE_URL = "https://app.lp1.znma.srv.nintendo.net";

/** Version of the official app this client presents itself as. Nintendo may require updates. */
export const NINTENDO_APP_VERSION = "2.6.0";
export const NINTENDO_APP_BUILD = "700";

export interface NintendoApiOptions {
  fetch: typeof fetch;
  tokens: { idToken: string; accessToken: string };
  appVersion?: string;
  appBuild?: string;
  timeZone?: string;
  language?: string;
}

export class NintendoApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "NintendoApiError";
    this.status = status;
  }
}

export type NintendoDeviceKind = "switch1" | "switch2" | "other";

export interface NintendoDevice {
  deviceId: string;
  label: string;
  kind: NintendoDeviceKind;
  platformGeneration: string | null;
}

export interface NintendoTitleInfo {
  title?: string;
  imageUrl?: string;
}

export interface NintendoPlayerDay {
  playerId: string;
  nickname: string | null;
  games: { applicationId: string; playingTime: number }[];
}

export interface NintendoDay {
  /** Calendar day as reported by the console (YYYY-MM-DD). */
  date: string;
  /** Total of the device for that day, if reported. */
  playingTime: number | null;
  players: NintendoPlayerDay[];
}

export interface NintendoDailySummaries {
  days: NintendoDay[];
  /** Titles and covers found in the response, by application id. */
  titles: Record<string, NintendoTitleInfo>;
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Application ids are compared case-insensitively by Nintendo. */
export function normalizeApplicationId(id: string): string {
  return id.trim().toUpperCase();
}

function imageUrl(value: unknown): string | undefined {
  if (typeof value === "string" && value !== "") return value;
  if (isObject(value)) {
    for (const key of ["large", "extraLarge", "medium", "small", "extraSmall"]) {
      const url = asString(value[key]);
      if (url) return url;
    }
  }
  return undefined;
}

function deviceKind(generation: string | null): NintendoDeviceKind {
  if (generation === "P00") return "switch1";
  if (generation === "P01") return "switch2";
  return "other";
}

/** Every linked console. Each console is linked on its own and appears as one entry. */
export function parseDevices(json: unknown): NintendoDevice[] {
  const root = isObject(json) ? json : {};
  const list = asArray(root.ownedDevices ?? root.items);
  const devices: NintendoDevice[] = [];
  for (const entry of list) {
    if (!isObject(entry)) continue;
    const inner = isObject(entry.device) ? entry.device : {};
    const deviceId = asString(entry.deviceId) ?? asString(inner.id);
    if (!deviceId) continue;
    const generation = asString(entry.platformGeneration) ?? asString(inner.platformGeneration);
    const kind = deviceKind(generation);
    devices.push({
      deviceId,
      label: asString(entry.label) ?? (kind === "switch2" ? "Switch 2" : "Switch"),
      kind,
      platformGeneration: generation,
    });
  }
  return devices;
}

function collectTitle(titles: Record<string, NintendoTitleInfo>, source: unknown): void {
  if (!isObject(source)) return;
  const meta = isObject(source.meta) ? source.meta : source;
  const id = asString(meta.applicationId) ?? asString(source.applicationId);
  if (!id) return;
  const key = normalizeApplicationId(id);
  const title = asString(meta.title) ?? asString(source.title) ?? undefined;
  const image = imageUrl(meta.imageUri) ?? imageUrl(source.imageUri);
  if (!title && !image) return;
  titles[key] = { title: title ?? titles[key]?.title, imageUrl: image ?? titles[key]?.imageUrl };
}

function parseGames(list: unknown, titles: Record<string, NintendoTitleInfo>) {
  const games: { applicationId: string; playingTime: number }[] = [];
  for (const entry of asArray(list)) {
    if (!isObject(entry)) continue;
    collectTitle(titles, entry);
    const meta = isObject(entry.meta) ? entry.meta : {};
    // Both generations: the id is either on the entry itself or inside `meta`.
    const id = asString(entry.applicationId) ?? asString(meta.applicationId);
    const playingTime = asNumber(entry.playingTime);
    if (!id || playingTime === null || playingTime <= 0) continue;
    games.push({ applicationId: normalizeApplicationId(id), playingTime });
  }
  return games;
}

export function parseDailySummaries(json: unknown): NintendoDailySummaries {
  const root = isObject(json) ? json : {};
  const titles: Record<string, NintendoTitleInfo> = {};
  const days: NintendoDay[] = [];

  for (const entry of asArray(root.dailySummaries ?? root.items)) {
    if (!isObject(entry)) continue;
    const date = asString(entry.date);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    // Day-level lists only carry titles and covers.
    for (const item of asArray(entry.playedGames ?? entry.playedApps)) collectTitle(titles, item);

    const players: NintendoPlayerDay[] = [];
    const playerEntries = asArray(entry.players ?? entry.devicePlayers);
    for (const player of playerEntries) {
      if (!isObject(player)) continue;
      const profile = isObject(player.profile) ? player.profile : player;
      const games = parseGames(player.playedGames ?? player.playedApps, titles);
      if (games.length === 0) continue;
      players.push({
        playerId: asString(profile.playerId) ?? "unknown",
        nickname: asString(profile.nickname),
        games,
      });
    }
    // Play without a selected profile.
    if (isObject(entry.anonymousPlayer)) {
      const games = parseGames(
        entry.anonymousPlayer.playedGames ?? entry.anonymousPlayer.playedApps,
        titles,
      );
      if (games.length > 0) players.push({ playerId: "anonymous", nickname: null, games });
    }
    // No per-profile data at all: fall back to the day-level list if it has times.
    if (players.length === 0) {
      const games = parseGames(entry.playedGames ?? entry.playedApps, titles);
      if (games.length > 0) players.push({ playerId: "device", nickname: null, games });
    }

    days.push({ date, playingTime: asNumber(entry.playingTime), players });
  }
  return { days, titles };
}

/** Titles from the console's software list (parental control setting). */
export function parseKnownTitles(json: unknown): Record<string, NintendoTitleInfo> {
  const root = isObject(json) ? json : {};
  const setting = isObject(root.parentalControlSetting) ? root.parentalControlSetting : root;
  const titles: Record<string, NintendoTitleInfo> = {};
  for (const item of asArray(setting.whitelistedApplicationList)) collectTitle(titles, item);
  return titles;
}

async function request(options: NintendoApiOptions, path: string): Promise<unknown> {
  const version = options.appVersion ?? NINTENDO_APP_VERSION;
  const build = options.appBuild ?? NINTENDO_APP_BUILD;
  const language = options.language ?? "de-DE";
  // The maintained reference implementation sends the id token. If Nintendo rejects it,
  // the access token (used by the older API) is tried once.
  const candidates = [options.tokens.idToken, options.tokens.accessToken];
  let lastStatus = 0;

  for (const token of candidates) {
    let response: Response;
    try {
      response = await options.fetch(`${NINTENDO_API_BASE_URL}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": `moon_ANDROID/${version} (com.nintendo.znma; build:${build}; ANDROID 34)`,
          "X-Moon-App-Id": "com.nintendo.znma",
          "X-Moon-Os": "ANDROID",
          "X-Moon-Os-Version": "34",
          "X-Moon-Model": "Pixel 4 XL",
          "X-Moon-App-Display-Version": version,
          "X-Moon-App-Internal-Version": build,
          "X-Moon-TimeZone": options.timeZone ?? "Europe/Zurich",
          "X-Moon-Os-Language": language,
          "X-Moon-App-Language": language,
        },
      });
    } catch {
      throw new NintendoApiError(0, "Die Nintendo-Jugendschutz-API ist nicht erreichbar.");
    }
    lastStatus = response.status;
    if (response.status === 401 || response.status === 403) continue;
    if (!response.ok) {
      throw new NintendoApiError(
        response.status,
        `Die Nintendo-Jugendschutz-API antwortet mit einem Fehler (Status ${response.status}).`,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new NintendoApiError(response.status, "Die Antwort von Nintendo ist nicht lesbar.");
    }
  }
  throw new NintendoApiError(lastStatus, "Nintendo hat die Anmeldung abgelehnt.");
}

export async function fetchDevices(options: NintendoApiOptions): Promise<NintendoDevice[]> {
  return parseDevices(await request(options, "/v2/actions/user/fetchOwnedDevices"));
}

export async function fetchDailySummaries(
  options: NintendoApiOptions,
  deviceId: string,
): Promise<NintendoDailySummaries> {
  const path = `/v2/actions/playSummary/fetchDailySummaries?deviceId=${encodeURIComponent(deviceId)}`;
  return parseDailySummaries(await request(options, path));
}

export async function fetchKnownTitles(
  options: NintendoApiOptions,
  deviceId: string,
): Promise<Record<string, NintendoTitleInfo>> {
  const path = `/v2/actions/parentalControlSetting/fetchParentalControlSetting?deviceId=${encodeURIComponent(deviceId)}`;
  return parseKnownTitles(await request(options, path));
}
