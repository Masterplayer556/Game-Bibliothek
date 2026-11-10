// Test helpers: an in-memory Postgres (PGlite) with the real migrations applied, plus a
// tiny stand-in for the parts of the Supabase client that the app uses.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

// Minimal stand-in for what Supabase provides out of the box.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  -- Worst case: project defaults that hand every new table to the API roles.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
`;

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

export async function createTestDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of migrationFiles()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  return db;
}

type Filter = { column: string; op: "eq" | "in"; value: unknown };
type Result = { data: unknown; error: { message: string; code?: string } | null; count?: number | null };

function encode(value: unknown): unknown {
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  return value;
}

/** Supports exactly the calls used in src/data and sync/store. Runs as table owner. */
class Query implements PromiseLike<Result> {
  private action: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private columns = "*";
  private returning: string | null = null;
  private rows: Record<string, unknown>[] = [];
  private patch: Record<string, unknown> = {};
  private conflict: string | null = null;
  private filters: Filter[] = [];
  private orderBy: string | null = null;
  private window: [number, number] | null = null;
  private countOnly = false;
  private singleMode: "one" | "maybe" | null = null;

  constructor(
    private readonly db: PGlite,
    private readonly table: string,
  ) {}

  select(columns = "*", options?: { count?: "exact"; head?: boolean }) {
    if (this.action === "select") {
      this.columns = columns;
      this.countOnly = options?.head === true;
    } else {
      this.returning = columns;
    }
    return this;
  }
  insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
    this.action = "insert";
    this.rows = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  upsert(rows: Record<string, unknown> | Record<string, unknown>[], options: { onConflict: string }) {
    this.action = "upsert";
    this.rows = Array.isArray(rows) ? rows : [rows];
    this.conflict = options.onConflict;
    return this;
  }
  update(patch: Record<string, unknown>) {
    this.action = "update";
    this.patch = patch;
    return this;
  }
  delete() {
    this.action = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push({ column, op: "eq", value });
    return this;
  }
  in(column: string, value: unknown[]) {
    this.filters.push({ column, op: "in", value });
    return this;
  }
  order(column: string) {
    this.orderBy = column;
    return this;
  }
  range(from: number, to: number) {
    this.window = [from, to];
    return this;
  }
  single() {
    this.singleMode = "one";
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  private where(params: unknown[]): string {
    if (this.filters.length === 0) return "";
    const parts = this.filters.map((f) => {
      params.push(f.value);
      return f.op === "eq" ? `${f.column} = $${params.length}` : `${f.column}::text = any($${params.length}::text[])`;
    });
    return ` where ${parts.join(" and ")}`;
  }

  private async execute(): Promise<Result> {
    const params: unknown[] = [];
    const table = `public.${this.table}`;
    let sql: string;

    if (this.action === "select") {
      if (this.countOnly) {
        sql = `select count(*)::int as count from ${table}${this.where(params)}`;
        const result = await this.db.query<{ count: number }>(sql, params);
        return { data: null, error: null, count: result.rows[0]?.count ?? 0 };
      }
      sql = `select ${this.columns} from ${table}${this.where(params)}`;
      if (this.orderBy) sql += ` order by ${this.orderBy}`;
      if (this.window) sql += ` limit ${this.window[1] - this.window[0] + 1} offset ${this.window[0]}`;
    } else if (this.action === "insert" || this.action === "upsert") {
      if (this.rows.length === 0) return { data: [], error: null };
      const columns = Object.keys(this.rows[0]!);
      const tuples = this.rows.map((row) => {
        const placeholders = columns.map((column) => {
          params.push(encode(row[column]));
          return `$${params.length}`;
        });
        return `(${placeholders.join(", ")})`;
      });
      sql = `insert into ${table} (${columns.join(", ")}) values ${tuples.join(", ")}`;
      if (this.action === "upsert") {
        const keys = this.conflict!.split(",").map((c) => c.trim());
        const updates = columns.filter((c) => !keys.includes(c)).map((c) => `${c} = excluded.${c}`);
        sql += ` on conflict (${keys.join(", ")}) do ${updates.length ? `update set ${updates.join(", ")}` : "nothing"}`;
      }
      if (this.returning) sql += ` returning ${this.returning}`;
    } else if (this.action === "update") {
      const sets = Object.entries(this.patch).map(([column, value]) => {
        params.push(encode(value));
        return `${column} = $${params.length}`;
      });
      sql = `update ${table} set ${sets.join(", ")}${this.where(params)}`;
      if (this.returning) sql += ` returning ${this.returning}`;
    } else {
      sql = `delete from ${table}${this.where(params)}`;
    }

    const result = await this.db.query<Record<string, unknown>>(sql, params);
    const rows = result.rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        // The real API returns timestamps and dates as strings.
        out[key] = value instanceof Date ? value.toISOString() : value;
      }
      return out;
    });
    if (this.singleMode) {
      if (rows.length === 0 && this.singleMode === "one") {
        return { data: null, error: { message: "no rows" } };
      }
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }

  then<A = Result, B = never>(
    onFulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.execute()
      .catch((error: { message?: string; code?: string }): Result => ({
        data: null,
        error: { message: error.message ?? "error", code: error.code },
      }))
      .then(onFulfilled, onRejected);
  }
}

export function createTestClient(db: PGlite): SupabaseClient {
  const client = {
    from: (table: string) => new Query(db, table),
    rpc: async (name: string) => {
      try {
        await db.query(`select public.${name}()`);
        return { data: null, error: null };
      } catch (error) {
        return { data: null, error: { message: (error as Error).message } };
      }
    },
  };
  return client as unknown as SupabaseClient;
}
