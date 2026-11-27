// Reads the backup from the real migrations (PGlite) with the sample library.
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createTestClient, createTestDatabase } from "../../supabase/testing/database";
import { persistBatch } from "@/data/persist";
import { buildSampleBatches } from "@/testing/sample-library";
import { BACKUP_TABLES } from "@/core/backup";
import { loadBackup } from "./backup";

const USER = "11111111-1111-1111-1111-111111111111";
let db: SupabaseClient;

beforeAll(async () => {
  const pg = await createTestDatabase();
  await pg.query("insert into auth.users (id, email) values ($1, 'owner@example.com')", [USER]);
  db = createTestClient(pg);
  const now = new Date("2026-11-11T12:00:00Z");
  for (const batch of buildSampleBatches(now)) await persistBatch(db, USER, batch, now);
});

describe("loadBackup", () => {
  it("reads every table completely, and the file is plain JSON", async () => {
    const backup = await loadBackup(db, new Date("2026-11-27T10:00:00Z"));
    expect(Object.keys(backup.tables)).toEqual([...BACKUP_TABLES]);
    expect(backup.counts.games).toBeGreaterThan(5);
    expect(backup.counts.achievements + backup.counts.daily_playtime).toBeGreaterThan(300);
    for (const table of BACKUP_TABLES) expect(backup.tables[table]).toHaveLength(backup.counts[table]);
    const ids = backup.tables.daily_playtime.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(JSON.parse(JSON.stringify(backup)).counts).toEqual(backup.counts);
  });
});
