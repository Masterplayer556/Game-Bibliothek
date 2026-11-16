import type { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestClient, createTestDatabase } from "../../supabase/testing/database";
import { runMetadataProviders } from "./run";
import type { MetadataProvider } from "./types";

const USER = "11111111-1111-1111-1111-111111111111";
const silent = { info: () => undefined, warn: () => undefined };
let pg: PGlite;
let db: SupabaseClient;

function provider(over: Partial<MetadataProvider> = {}): MetadataProvider {
  return {
    id: "igdb",
    displayName: "IGDB",
    requiredEnv: ["IGDB_CLIENT_ID", "IGDB_CLIENT_SECRET"],
    isConfigured: (env) => Boolean(env.IGDB_CLIENT_ID && env.IGDB_CLIENT_SECRET),
    testConnection: async () => ({ ok: true, message: "IGDB antwortet." }),
    findMany: async () => new Map(),
    ...over,
  };
}

const ENV = { IGDB_CLIENT_ID: "client-id", IGDB_CLIENT_SECRET: "top-secret-value" };
const run = (p: MetadataProvider, mode: "sync" | "test", env: Record<string, string> = ENV, only?: string) =>
  runMetadataProviders({ db, userId: USER, providers: [p], mode, only, env, fetch, log: silent });
const status = async () =>
  (await pg.query<{ status: string; configured: boolean; last_error: string | null; details: Record<string, unknown> }>(
    "select status, configured, last_error, details from game_bibliothek.platform_connections where adapter_id = 'igdb'",
  )).rows[0]!;

beforeAll(async () => {
  pg = await createTestDatabase();
  await pg.query("insert into auth.users (id, email) values ($1, 'owner@example.com')", [USER]);
  db = createTestClient(pg);
}, 60_000);

describe("runMetadataProviders", () => {
  it("reports a provider without secrets as not connected and names what is missing", async () => {
    const results = await run(provider(), "sync", { IGDB_CLIENT_ID: "client-id" });
    expect(results).toEqual([{ adapterId: "igdb", outcome: "skipped_not_configured" }]);
    expect(await status()).toMatchObject({ status: "not_connected", configured: false, details: { missingEnv: ["IGDB_CLIENT_SECRET"] } });
  });

  it("stores the result of a connection test", async () => {
    expect(await run(provider(), "test")).toEqual([{ adapterId: "igdb", outcome: "ok", message: "IGDB antwortet." }]);
    expect(await status()).toMatchObject({ status: "ok", configured: true, last_error: null });
  });

  it("does not test the provider when another source is tested", async () => {
    expect(await run(provider(), "test", ENV, "steam")).toEqual([]);
  });

  it("still runs after a sync of a single platform", async () => {
    const results = await run(provider(), "sync", ENV, "steam");
    expect(results).toEqual([{ adapterId: "igdb", outcome: "ok" }]);
  });

  it("keeps secrets out of stored error messages and does not throw", async () => {
    const failing = provider({
      findMany: async () => {
        throw new Error("request to https://example.test/?secret=top-secret-value failed");
      },
    });
    // one game without metadata, so the provider is asked
    await pg.query(
      "insert into game_bibliothek.games (user_id, title, normalized_title) values ($1, 'Some Game', 'some game')",
      [USER],
    );
    const results = await run(failing, "sync");
    expect(results[0]).toMatchObject({ adapterId: "igdb", outcome: "error" });
    expect(results[0]!.message).not.toContain("top-secret-value");
    const row = await status();
    expect(row.status).toBe("error");
    expect(row.last_error).toContain("***");
    expect(row.last_error).not.toContain("top-secret-value");
  });
});
