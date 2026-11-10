// Runs the real migration files against an in-memory Postgres (PGlite) and checks that
// row level security behaves as promised: nothing is readable without login, other users
// see nothing, and platform_credentials is unreadable from the browser roles.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, migrationFiles } from "./testing/database";

const OWNER = "11111111-1111-1111-1111-111111111111";
const STRANGER = "22222222-2222-2222-2222-222222222222";

let db: PGlite;

async function as<T>(
  role: "anon" | "authenticated",
  user: { id: string; email: string } | null,
  run: () => Promise<T>,
): Promise<T> {
  await db.exec("begin");
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user?.id ?? ""]);
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      user ? JSON.stringify({ sub: user.id, email: user.email }) : "",
    ]);
    await db.exec(`set local role ${role}`);
    return await run();
  } finally {
    await db.exec("rollback");
  }
}

const owner = { id: OWNER, email: "Owner@Example.com" };
const stranger = { id: STRANGER, email: "stranger@example.com" };

async function publicTables(): Promise<string[]> {
  const result = await db.query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public' order by 1",
  );
  return result.rows.map((r) => r.tablename);
}

beforeAll(async () => {
  db = await createTestDatabase();

  await db.query("insert into auth.users (id, email) values ($1, $2), ($3, $4)", [
    OWNER,
    "owner@example.com",
    STRANGER,
    stranger.email,
  ]);
  await db.exec("insert into app_private.allowed_emails (email) values ('owner@example.com')");

  // Seed one row per table as the table owner (bypasses RLS like the secret key does).
  await db.exec(`
    insert into public.games (id, user_id, title, normalized_title)
      values ('aaaaaaaa-0000-0000-0000-000000000001', '${OWNER}', 'Demo', 'demo');
    insert into public.devices (id, user_id, platform, kind, label, external_id, source)
      values ('bbbbbbbb-0000-0000-0000-000000000001', '${OWNER}', 'nintendo', 'switch2', 'Switch 2', 'd1', 'demo');
    insert into public.platform_games (id, user_id, game_id, platform, source, external_id, title)
      values ('cccccccc-0000-0000-0000-000000000001', '${OWNER}', 'aaaaaaaa-0000-0000-0000-000000000001', 'nintendo', 'demo', 'demo:1', 'Demo');
    insert into public.playtime_snapshots (user_id, platform_game_id, total_minutes, source)
      values ('${OWNER}', 'cccccccc-0000-0000-0000-000000000001', 10, 'demo');
    insert into public.daily_playtime (user_id, platform_game_id, device_id, play_date, minutes, source)
      values ('${OWNER}', 'cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', '2026-01-01', 30, 'demo');
    insert into public.achievements (user_id, platform_game_id, external_id, name)
      values ('${OWNER}', 'cccccccc-0000-0000-0000-000000000001', 'a1', 'First');
    insert into public.game_user_data (game_id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000001', '${OWNER}');
    insert into public.platform_connections (user_id, adapter_id, platform) values ('${OWNER}', 'steam', 'steam');
    insert into public.platform_credentials (user_id, adapter_id, kind, ciphertext) values ('${OWNER}', 'psn', 'refresh_token', 'v1:x:y');
    insert into public.sync_runs (user_id, mode, trigger) values ('${OWNER}', 'sync', 'local');
    insert into public.app_settings (user_id) values ('${OWNER}');
  `);
});

describe("migrations", () => {
  it("apply cleanly", async () => {
    expect(migrationFiles().length).toBeGreaterThan(0);
    expect((await publicTables()).length).toBeGreaterThanOrEqual(11);
  });

  it("enable row level security on every table", async () => {
    const result = await db.query<{ relname: string }>(`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public', 'app_private') and c.relkind = 'r' and not c.relrowsecurity`);
    expect(result.rows.map((r) => r.relname)).toEqual([]);
  });

  it("define no policy at all for platform_credentials", async () => {
    const result = await db.query(
      "select 1 from pg_policies where schemaname = 'public' and tablename = 'platform_credentials'",
    );
    expect(result.rows).toHaveLength(0);
  });
});

describe("row level security", () => {
  it("shows nothing without login (anon)", async () => {
    for (const table of await publicTables()) {
      const outcome = await as("anon", null, async () => {
        try {
          const r = await db.query(`select * from public.${table}`);
          return r.rows.length;
        } catch {
          return "denied";
        }
      });
      expect(outcome === "denied" || outcome === 0, `anon can read ${table}`).toBe(true);
    }
  });

  it("lets the allowed user read their own rows", async () => {
    const readable = [
      "games",
      "devices",
      "platform_games",
      "playtime_snapshots",
      "daily_playtime",
      "achievements",
      "game_user_data",
      "platform_connections",
      "sync_runs",
      "app_settings",
    ];
    for (const table of readable) {
      const count = await as("authenticated", owner, async () => {
        const r = await db.query(`select * from public.${table}`);
        return r.rows.length;
      });
      expect(count, `owner cannot read ${table}`).toBe(1);
    }
  });

  it("shows nothing to another logged-in user", async () => {
    for (const table of await publicTables()) {
      const outcome = await as("authenticated", stranger, async () => {
        try {
          const r = await db.query(`select * from public.${table}`);
          return r.rows.length;
        } catch {
          return "denied";
        }
      });
      expect(outcome === "denied" || outcome === 0, `stranger can read ${table}`).toBe(true);
    }
  });

  it("shows nothing to a user with the right id but an e-mail that is not allowed", async () => {
    const count = await as(
      "authenticated",
      { id: OWNER, email: "someone-else@example.com" },
      async () => (await db.query("select * from public.games")).rows.length,
    );
    expect(count).toBe(0);
  });

  it("keeps platform_credentials unreadable and unwritable, even for the owner", async () => {
    for (const sql of [
      "select * from public.platform_credentials",
      `insert into public.platform_credentials (user_id, adapter_id, kind, ciphertext) values ('${OWNER}', 'x', 'y', 'z')`,
      "update public.platform_credentials set ciphertext = 'hacked'",
      "delete from public.platform_credentials",
    ]) {
      await expect(as("authenticated", owner, () => db.query(sql)), sql).rejects.toThrow(
        /permission denied/,
      );
    }
  });

  it("does not let the browser write connection status or sync runs", async () => {
    await expect(
      as("authenticated", owner, () =>
        db.query("update public.platform_connections set status = 'ok'"),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as("authenticated", owner, () =>
        db.query(
          `insert into public.sync_runs (user_id, mode, trigger) values ('${OWNER}', 'sync', 'manual')`,
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("does not let a user write rows for someone else", async () => {
    await expect(
      as("authenticated", stranger, () =>
        db.query(
          `insert into public.games (user_id, title, normalized_title) values ('${OWNER}', 'x', 'x')`,
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      as("authenticated", stranger, () =>
        db.query(
          `insert into public.games (user_id, title, normalized_title) values ('${STRANGER}', 'x', 'x')`,
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("does not expose the allowed e-mail list", async () => {
    await expect(
      as("authenticated", owner, () => db.query("select * from app_private.allowed_emails")),
    ).rejects.toThrow(/permission denied/);
  });

  it("deletes demo data and leftover games through delete_demo_data()", async () => {
    const left = await as("authenticated", owner, async () => {
      await db.query("select public.delete_demo_data()");
      const games = await db.query("select 1 from public.games");
      const daily = await db.query("select 1 from public.daily_playtime");
      return games.rows.length + daily.rows.length;
    });
    expect(left).toBe(0);
  });
});
