// End-to-end check of the persistence layer against the real schema (in-memory Postgres).
import type { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestClient, createTestDatabase } from "../../supabase/testing/database";
import { buildDemoBatches } from "../core/demo";
import { normalizeTitle } from "../core/normalize-title";
import { buildPlayedDays } from "../core/playtime";
import { emptyBatch, type SyncBatch } from "../core/types";
import { deleteDemoData, persistBatch } from "./persist";

const USER = "11111111-1111-1111-1111-111111111111";
const NOW = new Date("2026-11-10T12:00:00Z");

let pg: PGlite;
let db: SupabaseClient;
const demo = buildDemoBatches(NOW);

async function rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await pg.query<T>(sql, params)).rows;
}

beforeAll(async () => {
  pg = await createTestDatabase();
  await pg.query("insert into auth.users (id, email) values ($1, 'owner@example.com')", [USER]);
  db = createTestClient(pg);
  for (const batch of demo) await persistBatch(db, USER, batch, NOW);
});

describe("persistBatch with demo data", () => {
  it("stores every platform entry", async () => {
    const counts = await rows<{ platform: string; n: number }>(
      "select platform, count(*)::int as n from game_bibliothek.platform_games group by 1",
    );
    expect(Object.fromEntries(counts.map((c) => [c.platform, c.n]))).toEqual({
      steam: 11,
      psn: 7,
      nintendo: 21,
      manual: 2,
    });
  });

  it("links the same game across platforms to one game", async () => {
    const titles = demo.flatMap((b) => b.games.map((g) => normalizeTitle(g.title)));
    const games = await rows<{ n: number }>("select count(*)::int as n from game_bibliothek.games");
    expect(games[0]!.n).toBe(new Set(titles).size);

    const platformsOf = async (normalized: string) =>
      (
        await rows<{ platform: string }>(
          `select pg.platform from game_bibliothek.platform_games pg join game_bibliothek.games g on g.id = pg.game_id
           where g.normalized_title = $1 order by 1`,
          [normalized],
        )
      ).map((r) => r.platform);

    expect(await platformsOf("minecraft")).toEqual(["manual", "nintendo", "psn"]);
    expect(await platformsOf("hollow knight silksong")).toEqual(["nintendo", "psn"]);
    expect(await platformsOf("nine sols")).toEqual(["psn", "steam"]);
    expect(await platformsOf("hollow knight")).toEqual(["psn"]);
  });

  it("leaves no platform entry without a game", async () => {
    const orphans = await rows("select 1 from game_bibliothek.platform_games where game_id is null");
    expect(orphans).toHaveLength(0);
  });

  it("derives Nintendo totals from the per-day rows", async () => {
    const mismatches = await rows(`
      select pg.title from game_bibliothek.platform_games pg
      left join (select platform_game_id, sum(minutes)::int as minutes
                 from game_bibliothek.daily_playtime group by 1) d on d.platform_game_id = pg.id
      where pg.platform = 'nintendo' and pg.total_playtime_minutes <> coalesce(d.minutes, 0)`);
    expect(mismatches).toEqual([]);
    const played = await rows<{ n: number }>(
      "select count(*)::int as n from game_bibliothek.platform_games where platform = 'nintendo' and total_playtime_minutes > 0",
    );
    expect(played[0]!.n).toBeGreaterThan(15);
  });

  it("stores per-day rows for both consoles", async () => {
    const kinds = await rows<{ kind: string }>(
      `select distinct d.kind from game_bibliothek.daily_playtime dp join game_bibliothek.devices d on d.id = dp.device_id order by 1`,
    );
    expect(kinds.map((k) => k.kind)).toEqual(["switch1", "switch2"]);
  });

  it("produces snapshot history that adds up to the lifetime total", async () => {
    const snapshots = await rows<{ platform_game_id: string; taken_at: Date; total_minutes: number; last_played_at: Date | null }>(
      "select platform_game_id, taken_at, total_minutes, last_played_at from game_bibliothek.playtime_snapshots",
    );
    const { days, warnings } = buildPlayedDays({
      dailyRows: [],
      snapshots: snapshots.map((s) => ({
        platformGameId: s.platform_game_id,
        takenAt: new Date(s.taken_at).toISOString(),
        totalMinutes: s.total_minutes,
        lastPlayedAt: s.last_played_at ? new Date(s.last_played_at).toISOString() : null,
      })),
    });
    expect(warnings).toEqual([]);
    expect(days.length).toBeGreaterThan(300);
    // long pauses between sessions are fine: the stored play time places each session
    expect(days.some((d) => d.estimated)).toBe(false);
  });

  it("keeps achievements and marks platforms without any as null", async () => {
    const hollow = await rows<{ achievements_unlocked: number; achievements_total: number; n: number }>(`
      select pg.achievements_unlocked, pg.achievements_total,
             (select count(*)::int from game_bibliothek.achievements a where a.platform_game_id = pg.id and a.unlocked_at is not null) as n
      from game_bibliothek.platform_games pg where pg.platform = 'psn' and pg.title = 'Hollow Knight'`);
    expect(hollow[0]).toEqual({ achievements_unlocked: 34, achievements_total: 63, n: 34 });
    const nintendo = await rows(
      "select 1 from game_bibliothek.platform_games where platform = 'nintendo' and achievements_total is not null",
    );
    expect(nintendo).toHaveLength(0);
  });
});

describe("persistBatch on later runs", () => {
  const steam = (total: number, lastPlayedAt?: string): SyncBatch => ({
    ...emptyBatch("steam", "steam"),
    games: [{ externalId: "730", title: "Counter-Strike 2", deviceKind: "pc", totalPlaytimeMinutes: total, lastPlayedAt }],
  });
  const snapshotCount = async () =>
    (
      await rows<{ n: number }>(
        `select count(*)::int as n from game_bibliothek.playtime_snapshots s
         join game_bibliothek.platform_games pg on pg.id = s.platform_game_id where pg.external_id = '730'`,
      )
    )[0]!.n;

  it("writes a snapshot only when the total changes", async () => {
    await persistBatch(db, USER, steam(100), new Date("2026-11-10T06:00:00Z"));
    expect(await snapshotCount()).toBe(1);
    await persistBatch(db, USER, steam(100), new Date("2026-11-10T12:00:00Z"));
    expect(await snapshotCount()).toBe(1);
    await persistBatch(db, USER, steam(160, "2026-11-10T16:30:00Z"), new Date("2026-11-10T18:00:00Z"));
    expect(await snapshotCount()).toBe(2);
  });

  it("links a real entry to the game the demo data created, and keeps the link", async () => {
    const linked = await rows<{ title: string }>(
      `select g.title from game_bibliothek.platform_games pg join game_bibliothek.games g on g.id = pg.game_id where pg.external_id = '730'`,
    );
    expect(linked).toHaveLength(1);
  });

  it("does not undo a manual link", async () => {
    const other = (await rows<{ id: string }>("select id from game_bibliothek.games where normalized_title = 'cuphead'"))[0]!.id;
    await pg.query(
      "update game_bibliothek.platform_games set game_id = $1, game_link_locked = true where external_id = '730'",
      [other],
    );
    await persistBatch(db, USER, steam(200), new Date("2026-11-11T06:00:00Z"));
    const after = await rows<{ game_id: string; game_link_locked: boolean }>(
      "select game_id, game_link_locked from game_bibliothek.platform_games where external_id = '730'",
    );
    expect(after[0]).toEqual({ game_id: other, game_link_locked: true });
  });

  it("keeps stored values that a later run does not report", async () => {
    await pg.query("update game_bibliothek.platform_games set cover_url = 'https://example.com/c.jpg' where external_id = '730'");
    await persistBatch(db, USER, steam(200), new Date("2026-11-11T12:00:00Z"));
    const row = await rows<{ cover_url: string; device_kind: string }>(
      "select cover_url, device_kind from game_bibliothek.platform_games where external_id = '730'",
    );
    expect(row[0]).toEqual({ cover_url: "https://example.com/c.jpg", device_kind: "pc" });
  });

  it("does not count a day twice when an import overlaps existing per-day data", async () => {
    const before = await rows<{ id: string; external_id: string; total: number; day: string; minutes: number }>(`
      select pg.id, pg.external_id, pg.total_playtime_minutes as total, dp.play_date::text as day, dp.minutes
      from game_bibliothek.platform_games pg join game_bibliothek.daily_playtime dp on dp.platform_game_id = pg.id
      where pg.platform = 'nintendo' and pg.title = 'Minecraft' order by dp.play_date limit 1`);
    const game = before[0]!;
    const importBatch: SyncBatch = {
      ...emptyBatch("nintendo", "nintendo-import"),
      games: [{ externalId: game.external_id, title: "Minecraft" }],
      dailyPlaytime: [
        // same day as existing data: must be ignored
        { gameExternalId: game.external_id, deviceExternalId: "demo:switch1", date: game.day, minutes: 600 },
        // a day long before: must be added
        { gameExternalId: game.external_id, deviceExternalId: "demo:switch1", date: "2022-01-05", minutes: 75 },
      ],
    };
    await persistBatch(db, USER, importBatch, NOW);
    const after = await rows<{ total: number; first: Date }>(
      "select total_playtime_minutes as total, first_played_at as first from game_bibliothek.platform_games where id = $1",
      [game.id],
    );
    expect(after[0]!.total).toBe(game.total + 75);
    expect(new Date(after[0]!.first).toISOString().slice(0, 10)).toBe("2022-01-05");
  });
});

describe("import and console data for the same game", () => {
  const total = async (externalId: string) =>
    (
      await rows<{ total: number }>(
        "select total_playtime_minutes as total from game_bibliothek.platform_games where external_id = $1",
        [externalId],
      )
    )[0]?.total;

  it("counts an overlapping day once, even when both sources created their own entry", async () => {
    // 1. The history is imported first: the game only exists as an import entry.
    await persistBatch(
      db,
      USER,
      {
        ...emptyBatch("nintendo", "nintendo-import"),
        devices: [{ externalId: "import:switch-unknown", kind: "other", label: "Switch (unbekannt)" }],
        games: [{ externalId: "import:testspiel-alpha", title: "Testspiel Alpha" }],
        dailyPlaytime: [
          { gameExternalId: "import:testspiel-alpha", deviceExternalId: "import:switch-unknown", date: "2026-11-01", minutes: 45 },
          { gameExternalId: "import:testspiel-alpha", deviceExternalId: "import:switch-unknown", date: "2026-11-02", minutes: 60 },
        ],
      },
      NOW,
    );
    expect(await total("import:testspiel-alpha")).toBe(105);

    // 2. Later the console reports the same game under its real id, overlapping on one day.
    await persistBatch(
      db,
      USER,
      {
        ...emptyBatch("nintendo", "nintendo-parental"),
        devices: [{ externalId: "console-s2", kind: "switch2", label: "Switch 2" }],
        games: [{ externalId: "0100TEST00000001", title: "Testspiel Alpha – Nintendo Switch 2 Edition" }],
        dailyPlaytime: [
          { gameExternalId: "0100TEST00000001", deviceExternalId: "console-s2", date: "2026-11-02", minutes: 58 },
          { gameExternalId: "0100TEST00000001", deviceExternalId: "console-s2", date: "2026-11-03", minutes: 20 },
        ],
      },
      NOW,
    );

    // Both entries belong to one game …
    const linked = await rows<{ n: number }>(`
      select count(distinct game_id)::int as n from game_bibliothek.platform_games
      where external_id in ('import:testspiel-alpha', '0100TEST00000001')`);
    expect(linked[0]!.n).toBe(1);
    // … the console wins on 02.11., the import keeps 01.11.
    expect(await total("0100TEST00000001")).toBe(78);
    expect(await total("import:testspiel-alpha")).toBe(45);
    // nothing was deleted: the import row is still stored
    const stored = await rows(
      "select 1 from game_bibliothek.daily_playtime where source = 'nintendo-import' and play_date = '2026-11-02'",
    );
    expect(stored).toHaveLength(1);
  });

  it("is safe to import the same file twice", async () => {
    const batch: SyncBatch = {
      ...emptyBatch("nintendo", "nintendo-import"),
      games: [{ externalId: "import:testspiel-alpha", title: "Testspiel Alpha" }],
      dailyPlaytime: [
        { gameExternalId: "import:testspiel-alpha", deviceExternalId: "import:switch-unknown", date: "2026-11-01", minutes: 45 },
      ],
    };
    await persistBatch(db, USER, batch, NOW);
    await persistBatch(db, USER, batch, NOW);
    expect(await total("import:testspiel-alpha")).toBe(45);
    expect(await total("0100TEST00000001")).toBe(78);
  });
});

describe("deleteDemoData", () => {
  it("removes demo rows and keeps real ones", async () => {
    await deleteDemoData(db);
    const left = await rows<{ source: string; n: number }>(
      "select source, count(*)::int as n from game_bibliothek.platform_games group by 1",
    );
    expect(left.sort((a, b) => a.source.localeCompare(b.source))).toEqual([
      { source: "nintendo-import", n: 1 },
      { source: "nintendo-parental", n: 1 },
      { source: "steam", n: 1 },
    ]);
    expect(await rows("select 1 from game_bibliothek.daily_playtime where source = 'demo'")).toHaveLength(0);
    expect(await rows("select 1 from game_bibliothek.devices where source = 'demo'")).toHaveLength(0);
    // games that still have a real entry survive, leftovers are gone
    expect(await rows("select 1 from game_bibliothek.games")).toHaveLength(2);
  });
});
