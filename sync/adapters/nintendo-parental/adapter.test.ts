import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDailySummaries, parseDevices, parseKnownTitles } from "../../../src/core/nintendo/api";
import { AdapterError, type AdapterContext } from "../../types";
import { buildBatch, detectUnit, nintendoParentalAdapter, SESSION_TOKEN_KIND } from "./adapter";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, "fixtures", `${name}.json`), "utf8"));

const SWITCH2 = "aaaa1111bbbb2222";
const SWITCH1 = "cccc3333dddd4444";
const TOTK = "0100F2C0115B6000";

interface Call {
  url: string;
  authorization: string | null;
  headers: Record<string, string>;
}

/** Routes requests to fixtures. Each route can be replaced per test. */
function fakeApi(overrides: Record<string, (call: Call) => Response> = {}) {
  const calls: Call[] = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const routes: Record<string, (call: Call) => Response> = {
    "/api/token": () => json(fixture("tokens")),
    fetchOwnedDevices: () => json(fixture("devices")),
    [`fetchDailySummaries?deviceId=${SWITCH2}`]: () => json(fixture("daily-switch2")),
    [`fetchDailySummaries?deviceId=${SWITCH1}`]: () => json(fixture("daily-switch1")),
    fetchParentalControlSetting: () => json(fixture("parental-control-setting")),
    ...overrides,
  };
  const fetchFn = (async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const call = { url, authorization: headers.Authorization ?? null, headers };
    calls.push(call);
    const key = Object.keys(routes).find((k) => url.includes(k));
    return key ? routes[key]!(call) : new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { fetchFn, calls };
}

function context(fetchFn: typeof fetch, over: Partial<AdapterContext> = {}): AdapterContext {
  return {
    credentials: { [SESSION_TOKEN_KIND]: "session-token" },
    env: {},
    previousGames: new Map(),
    now: new Date("2026-11-10T12:00:00Z"),
    log: { info: () => undefined, warn: () => undefined },
    fetch: fetchFn,
    ...over,
  };
}

describe("response parsing", () => {
  it("tells Switch 1 and Switch 2 apart, wherever the generation is reported", () => {
    expect(parseDevices(fixture("devices"))).toEqual([
      { deviceId: SWITCH2, label: "Wohnzimmer", kind: "switch2", platformGeneration: "P01" },
      { deviceId: SWITCH1, label: "Alte Switch", kind: "switch1", platformGeneration: "P00" },
    ]);
  });

  it("survives unexpected input", () => {
    expect(parseDevices(null)).toEqual([]);
    expect(parseDevices({ ownedDevices: [{}, "x", { deviceId: "d1" }] })).toEqual([
      { deviceId: "d1", label: "Switch", kind: "other", platformGeneration: null },
    ]);
    expect(parseDailySummaries("nonsense")).toEqual({ days: [], titles: {} });
    expect(parseKnownTitles(undefined)).toEqual({});
  });

  it("reads the newer format (id inside meta), ignoring empty entries and bad dates", () => {
    const { days, titles } = parseDailySummaries(fixture("daily-switch2"));
    expect(days.map((d) => d.date)).toEqual(["2026-11-10", "2026-11-09", "2026-11-08"]);
    expect(days[0]!.players).toHaveLength(2);
    // lower-case id from the API is normalised
    expect(days[0]!.players[0]!.games[0]).toEqual({ applicationId: TOTK, playingTime: 50 });
    expect(days[1]!.players[0]!.games).toEqual([{ applicationId: "0100BBBB00002000", playingTime: 40 }]);
    expect(titles[TOTK]?.imageUrl).toBe("https://example.invalid/totk-l.jpg");
    expect(titles["0100AAAA00001000"]).toEqual({
      title: "Donkey Kong Bananza",
      imageUrl: "https://example.invalid/dkb.jpg",
    });
  });

  it("reads the older format (id on the entry, devicePlayers, anonymous player)", () => {
    const { days, titles } = parseDailySummaries(fixture("daily-switch1"));
    expect(days).toHaveLength(1);
    expect(days[0]!.players.map((p) => p.playerId)).toEqual(["p-main", "anonymous"]);
    expect(titles["0100CCCC00003000"]?.title).toBe("Miitopia");
  });
});

describe("buildBatch", () => {
  const devices = parseDevices(fixture("devices"));
  const summaries = new Map([
    [SWITCH2, parseDailySummaries(fixture("daily-switch2"))],
    [SWITCH1, parseDailySummaries(fixture("daily-switch1"))],
  ]);
  const extra = parseKnownTitles(fixture("parental-control-setting"));

  it("adds up all profiles of a console per game and day, and keeps consoles apart", () => {
    const { batch } = buildBatch(devices, summaries, extra);
    const row = (game: string, device: string, date: string) =>
      batch.dailyPlaytime.find(
        (r) => r.gameExternalId === game && r.deviceExternalId === device && r.date === date,
      );
    expect(row(TOTK, SWITCH2, "2026-11-10")).toMatchObject({
      minutes: 65,
      details: { players: { "p-main": 50, "p-second": 15 } },
    });
    expect(row(TOTK, SWITCH1, "2026-11-09")?.minutes).toBe(5);
    expect(row("0100CCCC00003000", SWITCH1, "2026-11-09")?.minutes).toBe(25);
    expect(batch.dailyPlaytime).toHaveLength(5);
    expect(batch.devices.map((d) => d.kind)).toEqual(["switch2", "switch1"]);
  });

  it("lists every played game once, without lifetime total and without achievements", () => {
    const { batch, untitled, dataSince, unit } = buildBatch(devices, summaries, extra);
    expect(batch.games.map((g) => g.title)).toEqual([
      "Donkey Kong Bananza",
      "Pokémon Pokopia",
      "Miitopia",
      "The Legend of Zelda: Tears of the Kingdom – Nintendo Switch 2 Edition",
    ]);
    for (const game of batch.games) {
      expect(game.totalPlaytimeMinutes).toBeUndefined();
      expect(game.achievementsTotal).toBeNull();
    }
    expect(untitled).toEqual([]);
    expect(dataSince).toBe("2026-11-09");
    expect(unit).toBe("minutes");
  });

  it("names titles that no response describes", () => {
    const { batch, untitled } = buildBatch(devices, summaries, {});
    expect(untitled).toEqual(["0100BBBB00002000"]);
    expect(batch.games.find((g) => g.externalId === "0100BBBB00002000")?.title).toBe(
      "Unbekannter Titel (0100BBBB00002000)",
    );
  });

  it("recognises seconds and converts them", () => {
    const seconds = parseDailySummaries({
      dailySummaries: [
        {
          date: "2026-11-10",
          playingTime: 5400,
          players: [
            {
              profile: { playerId: "p" },
              playedGames: [
                { meta: { applicationId: "0100AAAA00001000" }, playingTime: 5370 },
                { meta: { applicationId: "0100BBBB00002000" }, playingTime: 20 },
              ],
            },
          ],
        },
      ],
    });
    expect(detectUnit([seconds])).toBe("seconds");
    const { batch, unit } = buildBatch(devices, new Map([[SWITCH2, seconds]]), {});
    expect(unit).toBe("seconds");
    // 5370 s → 90 min (rounded); a few seconds still count as one minute
    expect(batch.dailyPlaytime.map((r) => r.minutes).sort((a, b) => a - b)).toEqual([1, 90]);
  });

  it("honours a fixed unit", () => {
    const { batch } = buildBatch(devices, summaries, extra, "seconds");
    // every entry of at most 50 "seconds" becomes one minute per profile
    const minutes = batch.dailyPlaytime.map((r) => r.minutes).sort();
    expect(minutes).toEqual([1, 1, 1, 1, 2]);
  });
});

describe("nintendoParentalAdapter", () => {
  it("is configured only with a stored session token", async () => {
    const { fetchFn } = fakeApi();
    expect(await nintendoParentalAdapter.isConfigured(context(fetchFn))).toBe(true);
    expect(await nintendoParentalAdapter.isConfigured(context(fetchFn, { credentials: {} }))).toBe(false);
  });

  it("syncs every linked console", async () => {
    const { fetchFn, calls } = fakeApi();
    const result = await nintendoParentalAdapter.sync(context(fetchFn));
    expect(result.batch.source).toBe("nintendo-parental");
    expect(result.batch.devices).toHaveLength(2);
    expect(result.batch.dailyPlaytime).toHaveLength(5);
    expect(result.dataSince).toBe("2026-11-09");
    expect(result.warnings).toEqual([]);
    expect(result.details).toMatchObject({ unit: "minutes", days: 4 });
    // one title was missing in the summaries, so the software list was consulted
    expect(calls.some((c) => c.url.includes("fetchParentalControlSetting"))).toBe(true);
    const apiCall = calls.find((c) => c.url.includes("fetchOwnedDevices"))!;
    expect(apiCall.authorization).toBe("Bearer id-token-abc");
    expect(apiCall.headers["X-Moon-App-Id"]).toBe("com.nintendo.znma");
    expect(apiCall.headers["X-Moon-TimeZone"]).toBe("Europe/Zurich");
  });

  it("falls back to the access token when the id token is rejected", async () => {
    const { fetchFn, calls } = fakeApi({
      fetchOwnedDevices: (call) =>
        call.authorization === "Bearer access-token-xyz"
          ? new Response(JSON.stringify(fixture("devices")))
          : new Response("{}", { status: 401 }),
    });
    const result = await nintendoParentalAdapter.testConnection(context(fetchFn));
    expect(result.ok).toBe(true);
    expect(result.message).toBe("2 Konsole(n) gefunden: Wohnzimmer (Switch 2), Alte Switch (Switch)");
    expect(calls.filter((c) => c.url.includes("fetchOwnedDevices"))).toHaveLength(2);
  });

  it("reports an expired login as auth_expired", async () => {
    const expired = fakeApi({ "/api/token": () => new Response('{"error":"invalid_grant"}', { status: 400 }) });
    const error = await nintendoParentalAdapter.sync(context(expired.fetchFn)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).kind).toBe("auth_expired");
    expect((error as AdapterError).message).toMatch(/neu anmelden/);

    const rejected = fakeApi({ fetchOwnedDevices: () => new Response("{}", { status: 401 }) });
    await expect(nintendoParentalAdapter.sync(context(rejected.fetchFn))).rejects.toMatchObject({
      kind: "auth_expired",
    });
  });

  it("does not mistake a server problem for an expired login", async () => {
    const broken = fakeApi({ fetchOwnedDevices: () => new Response("oops", { status: 500 }) });
    await expect(nintendoParentalAdapter.sync(context(broken.fetchFn))).rejects.toMatchObject({
      kind: "unknown",
    });
    const limited = fakeApi({ fetchOwnedDevices: () => new Response("", { status: 429 }) });
    await expect(nintendoParentalAdapter.sync(context(limited.fetchFn))).rejects.toMatchObject({
      kind: "rate_limited",
    });
  });

  it("still syncs when the software list is unavailable", async () => {
    const { fetchFn } = fakeApi({ fetchParentalControlSetting: () => new Response("", { status: 500 }) });
    const result = await nintendoParentalAdapter.sync(context(fetchFn));
    expect(result.batch.dailyPlaytime).toHaveLength(5);
    expect(result.warnings).toEqual(["1 Titel ohne Namen"]);
  });

  it("reports a login without any linked console", async () => {
    const { fetchFn } = fakeApi({ fetchOwnedDevices: () => new Response('{"ownedDevices":[]}') });
    const test = await nintendoParentalAdapter.testConnection(context(fetchFn));
    expect(test.ok).toBe(false);
    expect(test.message).toMatch(/keine Konsole/);
  });

  it("uses a newer app version when configured", async () => {
    const { fetchFn, calls } = fakeApi();
    await nintendoParentalAdapter.testConnection(
      context(fetchFn, { env: { NINTENDO_APP_VERSION: "2.9.0", NINTENDO_APP_BUILD: "900" } }),
    );
    const call = calls.find((c) => c.url.includes("fetchOwnedDevices"))!;
    expect(call.headers["X-Moon-App-Display-Version"]).toBe("2.9.0");
    expect(call.headers["User-Agent"]).toContain("build:900");
  });
});
