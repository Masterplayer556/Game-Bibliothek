import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AdapterError, type AdapterContext, type PreviousGameState } from "../../types";
import { authenticate, createPsnAdapter, NPSSO_KIND, parseDuration, REFRESH_TOKEN_KIND } from "./adapter";
import type { PlayedTitle, PsnClient, PurchasedTitle, TrophyDetails, TrophySet } from "./client";

const fixture = <T>(name: string): T => JSON.parse(readFileSync(join(__dirname, "fixtures", `${name}.json`), "utf8")) as T;

const HK_SET: TrophySet = {
  npCommunicationId: "NPWR11111_00",
  npServiceName: "trophy",
  defined: { bronze: 40, silver: 15, gold: 7, platinum: 1 },
  earned: { bronze: 25, silver: 7, gold: 2, platinum: 0 },
};

interface Fake extends PsnClient {
  calls: string[];
}

function fakeClient(over: Partial<PsnClient> = {}): Fake {
  const calls: string[] = [];
  const client: Fake = {
    calls,
    async exchangeNpsso(npsso) {
      calls.push(`npsso:${npsso}`);
      if (npsso !== "good-npsso") throw new Error('{"error":"invalid_grant"}');
      return { accessToken: "access-1", refreshToken: "refresh-1", refreshTokenExpiresIn: 5_184_000 };
    },
    async refresh(token) {
      calls.push(`refresh:${token}`);
      if (token !== "refresh-0") throw new Error('{"error":"invalid_grant"}');
      return { accessToken: "access-2", refreshToken: "refresh-rotated", refreshTokenExpiresIn: 5_000_000 };
    },
    async playedGames() {
      calls.push("played");
      return fixture<PlayedTitle[]>("played-games");
    },
    async purchasedGames() {
      calls.push("purchased");
      return fixture<PurchasedTitle[]>("purchased-games");
    },
    async trophySets(_token, titleIds) {
      calls.push(`sets:${titleIds.join(",")}`);
      const map = new Map<string, TrophySet>();
      if (titleIds.includes("CUSA05678_00")) map.set("CUSA05678_00", HK_SET);
      return map;
    },
    async trophies(_token, set) {
      calls.push(`trophies:${set.npCommunicationId}`);
      return fixture<TrophyDetails[]>("trophies-hk");
    },
    ...over,
  };
  return client;
}

function context(credentials: Record<string, string>, over: Partial<AdapterContext> = {}): AdapterContext {
  return {
    credentials,
    env: {},
    previousGames: new Map(),
    now: new Date("2026-11-13T12:00:00Z"),
    log: { info: () => undefined, warn: () => undefined },
    fetch,
    ...over,
  };
}

describe("parseDuration", () => {
  it("reads Sony's ISO 8601 durations", () => {
    expect(parseDuration("PT228H56M33S")).toBe(13737);
    expect(parseDuration("PT20M")).toBe(20);
    expect(parseDuration("PT45S")).toBe(1);
    expect(parseDuration("P1DT2H")).toBe(1560);
    expect(parseDuration("PT0S")).toBe(0);
    expect(parseDuration(null)).toBe(0);
    expect(parseDuration("nonsense")).toBe(0);
  });
});

describe("authenticate (token rotation)", () => {
  it("uses the stored refresh token and stores the rotated one", async () => {
    const client = fakeClient();
    const session = await authenticate(client, context({ [REFRESH_TOKEN_KIND]: "refresh-0" }));
    expect(session.tokens.accessToken).toBe("access-2");
    expect(session.updates).toEqual([{ kind: REFRESH_TOKEN_KIND, value: "refresh-rotated" }]);
    expect(client.calls).toEqual(["refresh:refresh-0"]);
  });

  it("exchanges a new NPSSO and keeps it for when the refresh token expires", async () => {
    const session = await authenticate(fakeClient(), context({ [NPSSO_KIND]: "good-npsso" }));
    // the NPSSO is not deleted (no update for it)
    expect(session.updates).toEqual([{ kind: REFRESH_TOKEN_KIND, value: "refresh-1" }]);
  });

  it("falls back to a fresh NPSSO when the refresh token has expired", async () => {
    const client = fakeClient();
    const session = await authenticate(client, context({ [REFRESH_TOKEN_KIND]: "expired", [NPSSO_KIND]: "good-npsso" }));
    expect(session.tokens.refreshToken).toBe("refresh-1");
    expect(client.calls).toEqual(["refresh:expired", "npsso:good-npsso"]);
  });

  it("asks for a new NPSSO when nothing works", async () => {
    const cases: Record<string, string>[] = [{ [REFRESH_TOKEN_KIND]: "expired" }, { [NPSSO_KIND]: "bad" }, {}];
    for (const credentials of cases) {
      const error = await authenticate(fakeClient(), context(credentials)).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AdapterError);
      expect((error as AdapterError).kind).toBe("auth_expired");
    }
  });

  it("does not call a network problem an expired login", async () => {
    const client = fakeClient({
      refresh: async () => {
        throw new TypeError("fetch failed");
      },
    });
    await expect(authenticate(client, context({ [REFRESH_TOKEN_KIND]: "refresh-0" }))).rejects.toMatchObject({ kind: "network" });
  });
});

describe("psnAdapter.sync", () => {
  it("syncs played games with playtime, dates and the rotated token", async () => {
    const adapter = createPsnAdapter(fakeClient());
    const result = await adapter.sync(context({ [REFRESH_TOKEN_KIND]: "refresh-0" }));
    const silksong = result.batch.games.find((g) => g.externalId === "PPSA01234_00")!;
    expect(silksong).toMatchObject({
      title: "Hollow Knight: Silksong",
      totalPlaytimeMinutes: 2158,
      deviceKind: "ps5",
      owned: true,
      firstPlayedAt: "2025-09-04T18:00:00.000Z",
      lastPlayedAt: "2026-11-10T21:15:00.000Z",
    });
    expect(result.credentialUpdates).toEqual([{ kind: REFRESH_TOKEN_KIND, value: "refresh-rotated" }]);
    // without a stored NPSSO the refresh token's lifetime is the limit …
    expect(result.tokenExpiresAt).toBe(new Date(Date.parse("2026-11-13T12:00:00Z") + 5_000_000_000).toISOString());
    // … with one, the limit is the NPSSO's own expiry, which Sony does not report
    const withNpsso = await createPsnAdapter(fakeClient()).sync(
      context({ [REFRESH_TOKEN_KIND]: "refresh-0", [NPSSO_KIND]: "good-npsso" }),
    );
    expect(withNpsso.tokenExpiresAt).toBeNull();
    expect(result.dataSince).toBe("2026-11-13");
  });

  it("counts every played game as owned (also PS Plus) and adds bought but unplayed games", async () => {
    const { batch } = await createPsnAdapter(fakeClient()).sync(context({ [REFRESH_TOKEN_KIND]: "refresh-0" }));
    expect(batch.games.find((g) => g.externalId === "PPSA09999_00")!.owned).toBe(true);
    const yotei = batch.games.filter((g) => g.externalId === "PPSA04444_00");
    expect(yotei).toHaveLength(1);
    expect(yotei[0]).toMatchObject({ title: "Ghost of Yōtei", totalPlaytimeMinutes: 0, owned: true });
    // the PS4 version of a played PS5 game is not added a second time
    expect(batch.games.some((g) => g.externalId === "CUSA01234_00")).toBe(false);
    expect(batch.games).toHaveLength(4);
  });

  it("counts every played game as owned when purchases cannot be read", async () => {
    const client = fakeClient({
      purchasedGames: async () => {
        throw new Error("graphql changed");
      },
    });
    const result = await createPsnAdapter(client).sync(context({ [REFRESH_TOKEN_KIND]: "refresh-0" }));
    expect(result.batch.games.every((g) => g.owned)).toBe(true);
    expect(result.warnings).toContain("Gekaufte Spiele nicht lesbar");
  });

  it("reads trophies with type, date and rarity, and marks games without trophies", async () => {
    const { batch } = await createPsnAdapter(fakeClient()).sync(context({ [REFRESH_TOKEN_KIND]: "refresh-0" }));
    const hk = batch.games.find((g) => g.externalId === "CUSA05678_00")!;
    expect([hk.achievementsUnlocked, hk.achievementsTotal]).toEqual([34, 63]);
    expect(batch.achievements).toHaveLength(3);
    expect(batch.achievements[2]).toMatchObject({
      gameExternalId: "CUSA05678_00",
      externalId: "NPWR11111_00:2",
      tier: "gold",
      hidden: true,
      unlockedAt: "2026-11-09T19:00:00Z",
      rarityPercent: 4.9,
    });
    expect(batch.achievements[0]).toMatchObject({ tier: "platinum", unlockedAt: null });
    const demo = batch.games.find((g) => g.externalId === "PPSA09999_00")!;
    expect([demo.achievementsUnlocked, demo.achievementsTotal]).toEqual([null, null]);
  });

  it("only reads trophies of games whose playtime changed", async () => {
    const client = fakeClient();
    const previousGames = new Map<string, PreviousGameState>([
      ["PPSA01234_00", { totalPlaytimeMinutes: 2158, lastPlayedAt: null }],
      ["CUSA05678_00", { totalPlaytimeMinutes: 5000, lastPlayedAt: null }],
      ["PPSA09999_00", { totalPlaytimeMinutes: 20, lastPlayedAt: null }],
    ]);
    const { batch } = await createPsnAdapter(client).sync(context({ [REFRESH_TOKEN_KIND]: "refresh-0" }, { previousGames }));
    expect(client.calls.filter((c) => c.startsWith("sets:"))).toEqual(["sets:CUSA05678_00"]);
    const silksong = batch.games.find((g) => g.externalId === "PPSA01234_00")!;
    expect([silksong.achievementsUnlocked, silksong.achievementsTotal]).toEqual([undefined, undefined]);
  });

  it("keeps the rotated token even when the trophy calls fail", async () => {
    const client = fakeClient({
      trophySets: async () => {
        throw new Error("429");
      },
    });
    const result = await createPsnAdapter(client).sync(context({ [REFRESH_TOKEN_KIND]: "refresh-0" }));
    expect(result.credentialUpdates).toEqual([{ kind: REFRESH_TOKEN_KIND, value: "refresh-rotated" }]);
    expect(result.warnings).toContain("Trophäen nicht lesbar");
    expect(result.batch.games.length).toBeGreaterThan(0);
  });

  it("tests the connection and returns the rotated token for storage", async () => {
    const result = await createPsnAdapter(fakeClient()).testConnection(context({ [NPSSO_KIND]: "good-npsso" }));
    expect(result).toMatchObject({ ok: true, message: "Verbunden: 3 gespielte Spiele gefunden." });
    expect(result.credentialUpdates).toEqual([{ kind: REFRESH_TOKEN_KIND, value: "refresh-1" }]);
  });

  it("is configured with a refresh token or a NPSSO", async () => {
    const adapter = createPsnAdapter(fakeClient());
    expect(await adapter.isConfigured(context({ [NPSSO_KIND]: "x" }))).toBe(true);
    expect(await adapter.isConfigured(context({}))).toBe(false);
  });
});
