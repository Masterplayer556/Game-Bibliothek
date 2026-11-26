// Re-importing Nintendo history against the real schema (in-memory Postgres).
import type { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestClient, createTestDatabase } from "../../supabase/testing/database";
import { buildLibrary } from "../core/library";
import { parseImportCsv } from "../core/nintendo/import";
import { emptyBatch } from "../core/types";
import { persistBatch } from "../data/persist";
import { loadRawData, mergeGames, splitEntry } from "./library-data";
import { importHistory } from "./nintendo";

const USER = "11111111-1111-1111-1111-111111111111";
let pg: PGlite;
let db: SupabaseClient;

beforeAll(async () => {
  pg = await createTestDatabase();
  await pg.query("insert into auth.users (id, email) values ($1, 'owner@example.com')", [USER]);
  db = createTestClient(pg);
}, 60_000);

const file = parseImportCsv(["Miitopia;01.05.2024;1 Std. 0 Min.", "Miitopia;02.05.2024;30 Min."].join("\n"), "2026-11-26").rows;

async function miitopia() {
  const library = buildLibrary(await loadRawData(db));
  const game = library.games.find((g) => g.title === "Miitopia")!;
  return { total: game.totalMinutes, days: library.days.filter((d) => d.gameId === game.id).map((d) => [d.date, d.minutes]) };
}

describe("importHistory", () => {
  it("counts every day once when the same file is imported again", async () => {
    await importHistory(db, USER, file);
    expect(await miitopia()).toEqual({ total: 90, days: [["2024-05-01", 60], ["2024-05-02", 30]] });
    await importHistory(db, USER, file);
    expect(await miitopia()).toEqual({ total: 90, days: [["2024-05-01", 60], ["2024-05-02", 30]] });
  });

  it("still counts every day once after a real Switch was connected", async () => {
    // The console now exists: the days of the import move from the placeholder to it.
    const batch = emptyBatch("nintendo", "nintendo-parental");
    batch.devices.push({ externalId: "console-1", kind: "switch1", label: "Switch" });
    await persistBatch(db, USER, batch);
    await importHistory(db, USER, file);
    expect(await miitopia()).toEqual({ total: 90, days: [["2024-05-01", 60], ["2024-05-02", 30]] });
    const rows = await pg.query<{ n: number }>("select count(*)::int as n from game_bibliothek.daily_playtime");
    expect(rows.rows[0]!.n).toBe(2);
  });
});

describe("merging an imported game with its synced twin", () => {
  it("counts a day both sources report once, and both again after splitting", async () => {
    // The app reports the same game under another title: a separate game at first.
    const batch = emptyBatch("nintendo", "nintendo-parental");
    batch.devices.push({ externalId: "console-1", kind: "switch1", label: "Switch" });
    batch.games.push({ externalId: "app-miitopia", title: "Miitopia Deluxe" });
    batch.dailyPlaytime.push({ gameExternalId: "app-miitopia", deviceExternalId: "console-1", date: "2024-05-01", minutes: 60 });
    await persistBatch(db, USER, batch);

    const games = async () => buildLibrary(await loadRawData(db)).games;
    const total = async (id: string) => (await games()).find((g) => g.id === id)!.totalMinutes;
    const imported = (await games()).find((g) => g.title === "Miitopia")!;
    const synced = (await games()).find((g) => g.title === "Miitopia Deluxe")!;
    expect([imported.totalMinutes, synced.totalMinutes]).toEqual([90, 60]);

    await mergeGames(db, imported.id, synced.id);
    // 1 May from the app (60), 2 May from the import (30): not 90 + 60.
    expect(await total(imported.id)).toBe(90);

    const merged = (await games()).find((g) => g.id === imported.id)!;
    const splitId = await splitEntry(db, USER, merged.entries.find((e) => e.title === "Miitopia Deluxe")!);
    expect(await total(imported.id)).toBe(90);
    expect(await total(splitId)).toBe(60);
  });
});
