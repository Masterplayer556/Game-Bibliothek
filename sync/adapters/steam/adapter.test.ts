import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AdapterContext, PreviousGameState } from "../../types";
import { AdapterError } from "../../types";
import { steamAdapter } from "./adapter";
import { getOwnedGames, resolveSteamId } from "./client";

const fixture = (name: string): unknown => JSON.parse(readFileSync(join(__dirname, "fixtures", `${name}.json`), "utf8"));
const STEAM_ID = "76561190000000000";
const KEY = "TESTKEY1234567890";

type Route = (url: URL) => Response;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function fakeSteam(overrides: Record<string, Route> = {}) {
  const calls: URL[] = [];
  const routes: Record<string, Route> = {
    GetOwnedGames: () => json(fixture("owned-games")),
    GetPlayerAchievements: (url) =>
      url.searchParams.get("appid") === "322500" ? json(fixture("achievements-322500")) : json(fixture("no-stats"), 400),
    GetSchemaForGame: () => json(fixture("schema-322500")),
    GetGlobalAchievementPercentagesForApp: () => json(fixture("percentages-322500")),
    ResolveVanityURL: (url) =>
      url.searchParams.get("vanityurl") === "marcel" ? json({ response: { steamid: STEAM_ID, success: 1 } }) : json({ response: { success: 42, message: "No match" } }),
    ...overrides,
  };
  const fetchFn = (async (input: string) => {
    const url = new URL(input);
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.pathname.includes(k));
    return key ? routes[key]!(url) : new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { fetchFn, calls };
}

function context(fetchFn: typeof fetch, over: Partial<AdapterContext> = {}): AdapterContext {
  return {
    credentials: {},
    env: { STEAM_API_KEY: KEY, STEAM_ID },
    previousGames: new Map(),
    now: new Date("2026-11-11T12:00:00Z"),
    log: { info: () => undefined, warn: () => undefined },
    fetch: fetchFn,
    ...over,
  };
}

describe("Steam client", () => {
  it("accepts a SteamID64, a profile link or a custom profile name", async () => {
    const { fetchFn } = fakeSteam();
    const opts = { fetch: fetchFn, apiKey: KEY };
    expect(await resolveSteamId(opts, STEAM_ID)).toBe(STEAM_ID);
    expect(await resolveSteamId(opts, `https://steamcommunity.com/profiles/${STEAM_ID}/`)).toBe(STEAM_ID);
    expect(await resolveSteamId(opts, "https://steamcommunity.com/id/marcel")).toBe(STEAM_ID);
    expect(await resolveSteamId(opts, "marcel")).toBe(STEAM_ID);
    await expect(resolveSteamId(opts, "unknown")).rejects.toThrow(/STEAM_ID/);
  });

  it("explains a private profile", async () => {
    const { fetchFn } = fakeSteam({ GetOwnedGames: () => json({ response: {} }) });
    await expect(getOwnedGames({ fetch: fetchFn, apiKey: KEY }, STEAM_ID)).rejects.toThrow(/Öffentlich/);
  });
});

describe("steamAdapter", () => {
  it("is configured only with key and SteamID", async () => {
    const { fetchFn } = fakeSteam();
    expect(await steamAdapter.isConfigured(context(fetchFn))).toBe(true);
    expect(await steamAdapter.isConfigured(context(fetchFn, { env: { STEAM_API_KEY: KEY } }))).toBe(false);
  });

  it("syncs all owned games with lifetime playtime, last played and cover", async () => {
    const { fetchFn } = fakeSteam();
    const result = await steamAdapter.sync(context(fetchFn));
    const { batch } = result;
    expect(batch.platform).toBe("steam");
    expect(batch.games).toHaveLength(4);
    const cs = batch.games.find((g) => g.externalId === "730")!;
    expect(cs).toMatchObject({
      title: "Counter-Strike 2",
      totalPlaytimeMinutes: 8210,
      deviceKind: "pc",
      owned: true,
      lastPlayedAt: new Date(1794340800 * 1000).toISOString(),
      coverUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/header.jpg",
    });
    const detroit = batch.games.find((g) => g.externalId === "1222140")!;
    expect([detroit.totalPlaytimeMinutes, detroit.lastPlayedAt]).toEqual([0, null]);
    expect(result.dataSince).toBe("2026-11-11");
  });

  it("reads achievements with names, unlock dates and rarity", async () => {
    const { fetchFn } = fakeSteam();
    const { batch } = await steamAdapter.sync(context(fetchFn));
    const superhot = batch.games.find((g) => g.externalId === "322500")!;
    expect([superhot.achievementsUnlocked, superhot.achievementsTotal]).toEqual([2, 3]);
    expect(batch.achievements).toHaveLength(3);
    expect(batch.achievements[0]).toMatchObject({
      externalId: "ACH_SUBWAY",
      name: "U-Bahn",
      description: "Überlebe die U-Bahn.",
      unlockedAt: new Date(1700001000 * 1000).toISOString(),
      rarityPercent: 87.2,
    });
    expect(batch.achievements[2]).toMatchObject({ unlockedAt: null, hidden: true, rarityPercent: 3.1, description: null });
    // CS2 has no stats: marked as «no achievements», not 0/0
    const cs = batch.games.find((g) => g.externalId === "730")!;
    expect([cs.achievementsUnlocked, cs.achievementsTotal]).toEqual([null, null]);
  });

  it("only asks for achievements of games whose playtime changed", async () => {
    const { fetchFn, calls } = fakeSteam();
    const previousGames = new Map<string, PreviousGameState>([
      ["730", { totalPlaytimeMinutes: 8210, lastPlayedAt: null }],
      ["322500", { totalPlaytimeMinutes: 200, lastPlayedAt: null }],
    ]);
    const { batch } = await steamAdapter.sync(context(fetchFn, { previousGames }));
    const asked = calls.filter((c) => c.pathname.includes("GetPlayerAchievements")).map((c) => c.searchParams.get("appid"));
    expect(asked).toEqual(["322500"]);
    // unchanged games keep their stored achievement counts
    const cs = batch.games.find((g) => g.externalId === "730")!;
    expect([cs.achievementsUnlocked, cs.achievementsTotal]).toEqual([undefined, undefined]);
  });

  it("never asks for achievements of unplayed games or games without stats", async () => {
    const { fetchFn, calls } = fakeSteam();
    await steamAdapter.sync(context(fetchFn));
    const asked = calls.filter((c) => c.pathname.includes("GetPlayerAchievements")).map((c) => c.searchParams.get("appid"));
    expect(asked.sort()).toEqual(["322500", "730"]);
  });

  it("keeps going when one game's achievements fail", async () => {
    const { fetchFn } = fakeSteam({ GetSchemaForGame: () => new Response("oops", { status: 500 }) });
    const result = await steamAdapter.sync(context(fetchFn));
    expect(result.batch.games).toHaveLength(4);
    expect(result.warnings).toEqual(["Erfolge von 1 Spielen nicht lesbar"]);
  });

  it("reports a rejected key and rate limits clearly", async () => {
    const forbidden = fakeSteam({ GetOwnedGames: () => new Response("Forbidden", { status: 403 }) });
    const error = await steamAdapter.sync(context(forbidden.fetchFn)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).message).toMatch(/STEAM_API_KEY/);

    const limited = fakeSteam({ GetPlayerAchievements: () => new Response("", { status: 429 }) });
    await expect(steamAdapter.sync(context(limited.fetchFn))).rejects.toMatchObject({ kind: "rate_limited" });
  });

  it("tests the connection without saving anything", async () => {
    const { fetchFn, calls } = fakeSteam();
    expect(await steamAdapter.testConnection(context(fetchFn))).toEqual({ ok: true, message: "4 Spiele gefunden, davon 3 gespielt." });
    expect(calls.every((c) => !c.pathname.includes("Achievements"))).toBe(true);
    const broken = fakeSteam({ GetOwnedGames: () => json({ response: {} }) });
    const result = await steamAdapter.testConnection(context(broken.fetchFn));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Öffentlich/);
  });

  it("never puts the key into an error message", async () => {
    const { fetchFn } = fakeSteam({ GetOwnedGames: () => new Response("", { status: 500 }) });
    const error = (await steamAdapter.sync(context(fetchFn)).catch((e: unknown) => e)) as Error;
    expect(error.message).not.toContain(KEY);
  });
});
