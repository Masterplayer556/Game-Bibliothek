// Re-importing Nintendo history against the real schema (in-memory Postgres).
import type { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestClient, createTestDatabase } from "../../supabase/testing/database";
import { buildLibrary } from "../core/library";
import { parseImportCsv } from "../core/nintendo/import";
import { emptyBatch } from "../core/types";
import { persistBatch } from "../data/persist";
import { loadRawData } from "./library-data";
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
