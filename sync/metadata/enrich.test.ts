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
