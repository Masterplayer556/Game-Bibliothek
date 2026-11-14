// The run log against the real schema (in-memory Postgres).
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestClient, createTestDatabase } from "../supabase/testing/database";
import { SupabaseSyncStore } from "./store";

const USER = "11111111-1111-1111-1111-111111111111";
const NOW = new Date("2026-11-14T12:00:00Z");
let pg: PGlite;
let store: SupabaseSyncStore;

const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

async function addRun(status: string, createdAt: string): Promise<string> {
  const result = await pg.query<{ id: string }>(
    "insert into game_bibliothek.sync_runs (user_id, mode, trigger, status, created_at) values ($1, 'sync', 'manual', $2, $3) returning id",
    [USER, status, createdAt],
  );
  return result.rows[0]!.id;
}

async function statusOf(id: string): Promise<string | null> {
  const result = await pg.query<{ status: string }>("select status from game_bibliothek.sync_runs where id = $1", [id]);
  return result.rows[0]?.status ?? null;
}

beforeAll(async () => {
  pg = await createTestDatabase();
  await pg.query("insert into auth.users (id, email) values ($1, 'owner@example.com')", [USER]);
  store = new SupabaseSyncStore(createTestClient(pg), USER, undefined);
}, 60_000);

describe("SupabaseSyncStore run log", () => {
  it("reuses the run created by the app and creates one otherwise", async () => {
    const queued = await addRun("queued", minutesAgo(1));
    expect(await store.startRun({ runId: queued, mode: "sync", trigger: "manual" })).toBe(queued);
    expect(await statusOf(queued)).toBe("running");

    const created = await store.startRun({ mode: "test", adapterId: "steam", trigger: "schedule" });
    expect(created).not.toBe(queued);
    await store.finishRun(created, "success", [{ adapterId: "steam", outcome: "ok" }]);
    expect(await statusOf(created)).toBe("success");
    await store.finishRun(queued, "partial", []);
  });

  it("closes runs that never reported back and removes old ones", async () => {
    const dead = await addRun("running", minutesAgo(45));
    const neverStarted = await addRun("queued", minutesAgo(31));
    const fresh = await addRun("running", minutesAgo(10));
    const old = await addRun("success", minutesAgo(91 * 24 * 60));
    const recent = await addRun("success", minutesAgo(89 * 24 * 60));

    expect(await store.tidyRuns(NOW)).toEqual({ closed: 2, removed: 1 });
    expect(await statusOf(dead)).toBe("error");
    expect(await statusOf(neverStarted)).toBe("error");
    expect(await statusOf(fresh)).toBe("running");
    expect(await statusOf(old)).toBeNull();
    expect(await statusOf(recent)).toBe("success");
    // a second pass finds nothing
    expect(await store.tidyRuns(NOW)).toEqual({ closed: 0, removed: 0 });
  });
});
