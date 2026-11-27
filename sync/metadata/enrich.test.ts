import type { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestClient, createTestDatabase } from "../../supabase/testing/database";
import { emptyBatch } from "../../src/core/types";
import { persistBatch } from "../../src/data/persist";
import { enrichMetadata } from "./enrich";
import type { GameMetadata, LookupRequest, MetadataProvider } from "./types";

const USER = "11111111-1111-1111-1111-111111111111";
const NOW = new Date("2026-11-13T12:00:00Z");
let pg: PGlite;
let db: SupabaseClient;

const KNOWN: Record<string, GameMetadata> = {
  "hollow knight": { providerGameId: 14593, title: "Hollow Knight", coverUrl: "https://img/hk.jpg", genres: ["Jump 'n' Run", "Indie"], releaseYear: 2017 },
  "grand theft auto v": { providerGameId: 1020, title: "Grand Theft Auto V", coverUrl: "https://img/gta.jpg", genres: ["Shooter"], releaseYear: 2013 },
  "kirby und das vergessene land": { providerGameId: 7, title: "Kirby and the Forgotten Land", coverUrl: null, genres: ["Jump 'n' Run"], releaseYear: 2022 },
  "kirby and the forgotten land": { providerGameId: 7, title: "Kirby and the Forgotten Land", coverUrl: null, genres: ["Jump 'n' Run"], releaseYear: 2022 },
};

function fakeProvider() {
  const asked: LookupRequest[][] = [];
  const provider: MetadataProvider = {
    id: "igdb",
    displayName: "IGDB",
    requiredEnv: [],
    isConfigured: () => true,
    testConnection: async () => ({ ok: true, message: "ok" }),
    async findMany(_env, _fetch, requests) {
      asked.push([...requests]);
      return new Map(requests.map((r) => [r.key, KNOWN[r.key] ?? null]));
    },
  };
  return { provider, asked };
}

const run = (provider: MetadataProvider, now = NOW) =>
  enrichMetadata({ db, userId: USER, provider, env: {}, fetch, now, log: { info: () => undefined, warn: () => undefined } });

const rows = async <T>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows;

beforeAll(async () => {
  pg = await createTestDatabase();
  await pg.query("insert into auth.users (id, email) values ($1, 'owner@example.com')", [USER]);
  db = createTestClient(pg);
  await persistBatch(db, USER, {
    ...emptyBatch("psn", "psn"),
    games: [
      { externalId: "CUSA1", title: "Hollow Knight", deviceKind: "ps5", totalPlaytimeMinutes: 100 },
      { externalId: "PPSA2", title: "Grand Theft Auto V (PlayStation®5)", deviceKind: "ps5", totalPlaytimeMinutes: 200 },
      { externalId: "PPSA3", title: "Unknown Indie", deviceKind: "ps5", totalPlaytimeMinutes: 5 },
    ],
  }, NOW);
  await persistBatch(db, USER, {
    ...emptyBatch("nintendo", "nintendo-parental"),
    devices: [{ externalId: "s2", kind: "switch2", label: "Switch 2" }],
    games: [{ externalId: "0100A", title: "Kirby und das vergessene Land" }],
  }, NOW);
  await persistBatch(db, USER, {
    ...emptyBatch("steam", "steam"),
    games: [{ externalId: "999", title: "Kirby and the Forgotten Land", deviceKind: "pc", totalPlaytimeMinutes: 10 }],
  }, NOW);
});

describe("enrichMetadata", () => {
  it("adds cover, genres and year and remembers every answer", async () => {
    const { provider, asked } = fakeProvider();
    const summary = await run(provider);
    expect(summary.looked).toBe(asked[0]!.length);
    const hk = await rows<{ igdb_id: number; cover_url: string; genres: string[]; release_year: number }>(
      "select igdb_id, cover_url, genres, release_year from game_bibliothek.games where title = 'Hollow Knight'",
    );
    expect(hk[0]).toEqual({ igdb_id: 14593, cover_url: "https://img/hk.jpg", genres: ["Jump 'n' Run", "Indie"], release_year: 2017 });
    // platform suffix removed before asking
    expect(asked[0]!.map((r) => r.key)).toContain("grand theft auto v");
    const cache = await rows("select 1 from game_bibliothek.metadata_cache where result is null");
    expect(cache).toHaveLength(1); // «Unknown Indie»
  });

  it("joins games with the same IGDB id, also across languages", async () => {
    const kirby = await rows<{ platform: string; game_id: string }>(
      "select platform, game_id from game_bibliothek.platform_games where external_id in ('0100A', '999') order by platform",
    );
    expect(kirby).toHaveLength(2);
    expect(kirby[0]!.game_id).toBe(kirby[1]!.game_id);
    const games = await rows("select 1 from game_bibliothek.games where igdb_id = 7");
    expect(games).toHaveLength(1);
  });

  it("does not ask again for known titles or recent misses", async () => {
    const { provider, asked } = fakeProvider();
    const summary = await run(provider);
    expect(asked).toHaveLength(0);
    expect(summary.looked).toBe(0);
    // after 30 days a miss is asked again
    const later = fakeProvider();
    await run(later.provider, new Date("2026-12-20T12:00:00Z"));
    expect(later.asked[0]!.map((r) => r.key)).toEqual(["unknown indie"]);
  });

  it("never overwrites a game corrected by hand", async () => {
    await pg.query("update game_bibliothek.games set igdb_id = null, igdb_locked = true, genres = '{}' where title = 'Hollow Knight'");
    const { provider } = fakeProvider();
    await run(provider);
    const hk = await rows<{ igdb_id: number | null }>("select igdb_id from game_bibliothek.games where title = 'Hollow Knight'");
    expect(hk[0]!.igdb_id).toBeNull();
  });

  it("keeps entries that were split off by hand", async () => {
    // split the Steam Kirby off again, locked
    const id = "99999999-9999-9999-9999-999999999999";
    await pg.query("insert into game_bibliothek.games (id, user_id, title, normalized_title, igdb_id) values ($1, $2, 'Kirby (Steam)', 'kirby steam', 7)", [id, USER]);
    await pg.query("update game_bibliothek.platform_games set game_id = $1, game_link_locked = true where external_id = '999'", [id]);
    const { provider } = fakeProvider();
    await run(provider);
    const steam = await rows<{ game_id: string }>("select game_id from game_bibliothek.platform_games where external_id = '999'");
    expect(steam[0]!.game_id).toBe(id);
  });
});

describe("time to beat", () => {
  const GTA_TIME = { hastily: 1500, normally: 2400, completely: 3600, count: 120 };
  function timedProvider(fail = false) {
    const asked: number[][] = [];
    const { provider } = fakeProvider();
    provider.timeToBeat = async (_env, _fetch, ids) => {
      asked.push([...ids]);
      if (fail) throw new Error("IGDB down");
      return new Map(ids.filter((id) => id === 1020).map((id) => [id, GTA_TIME]));
    };
    return { provider, asked };
  }

  it("keeps covers and genres when the time cannot be fetched", async () => {
    const { provider } = timedProvider(true);
    const summary = await run(provider);
    expect(summary.timeToBeat).toBe(0);
    const checked = await rows<{ n: number }>("select count(*)::int as n from game_bibliothek.games where time_to_beat_checked_at is not null");
    expect(checked[0]!.n).toBe(0);
  });

  it("stores the time of games with an IGDB id and marks the others as asked", async () => {
    const { provider, asked } = timedProvider();
    const summary = await run(provider);
    expect(summary.timeToBeat).toBe(1);
    // the two Kirby games (one split off by hand) share id 7
    expect(asked[0]!.sort((a, b) => a - b)).toEqual([7, 7, 1020]);
    const games = await rows<{ title: string; time_to_beat: unknown; checked: boolean }>(
      "select title, time_to_beat, time_to_beat_checked_at is not null as checked from game_bibliothek.games where igdb_id is not null order by title",
    );
    const gta = (g: { title: string }) => g.title.startsWith("Grand Theft Auto");
    expect(games.find(gta)).toMatchObject({ time_to_beat: GTA_TIME, checked: true });
    expect(games.filter((g) => !gta(g)).every((g) => g.time_to_beat === null && g.checked)).toBe(true);
  });

  it("asks again only after 30 days", async () => {
    const soon = timedProvider();
    await run(soon.provider, new Date("2026-11-20T12:00:00Z"));
    expect(soon.asked).toEqual([]);
    const later = timedProvider();
    await run(later.provider, new Date("2026-12-20T12:00:00Z"));
    expect(later.asked[0]).toHaveLength(3);
  });
});
