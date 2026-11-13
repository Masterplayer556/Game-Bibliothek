import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestClient, createTestDatabase } from "../supabase/testing/database";
import { emptyBatch } from "../src/core/types";
import { persistBatch } from "../src/data/persist";
import { markKnownApps } from "./mark-apps";

const USER = "11111111-1111-1111-1111-111111111111";
let pg: PGlite;

beforeAll(async () => {
  pg = await createTestDatabase();
  await pg.query("insert into auth.users (id, email) values ($1, 'owner@example.com')", [USER]);
  await persistBatch(createTestClient(pg), USER, {
    ...emptyBatch("psn", "psn"),
    games: [
      { externalId: "a", title: "YouTube", totalPlaytimeMinutes: 900 },
      { externalId: "b", title: "Netflix", totalPlaytimeMinutes: 100 },
      { externalId: "c", title: "Minecraft", totalPlaytimeMinutes: 50 },
    ],
  });
});

describe("markKnownApps", () => {
  it("marks apps once and respects my own choice afterwards", async () => {
    const db = createTestClient(pg);
    expect(await markKnownApps(db, USER)).toBe(2);
    const hidden = await pg.query<{ title: string }>(
      "select g.title from game_bibliothek.game_user_data u join game_bibliothek.games g on g.id = u.game_id where u.hidden order by 1",
    );
    expect(hidden.rows.map((r) => r.title)).toEqual(["Netflix", "YouTube"]);

    // I show Netflix again in the app: the next sync leaves it alone
    await pg.query("update game_bibliothek.game_user_data u set hidden = false from game_bibliothek.games g where g.id = u.game_id and g.title = 'Netflix'");
    expect(await markKnownApps(db, USER)).toBe(0);
    const netflix = await pg.query<{ hidden: boolean }>(
      "select u.hidden from game_bibliothek.game_user_data u join game_bibliothek.games g on g.id = u.game_id where g.title = 'Netflix'",
    );
    expect(netflix.rows[0]!.hidden).toBe(false);
  });
});
