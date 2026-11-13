// Checks the LIVE project from the outside, the way a stranger's browser would:
// with the public key and without login, nothing may be readable or writable.
//
//   npm run check:rls
import { createClient } from "@supabase/supabase-js";
import { DB_SCHEMA } from "../src/core/types";
import { loadLocalEnv } from "../sync/env";

const TABLES = [
  "games",
  "devices",
  "platform_games",
  "playtime_snapshots",
  "daily_playtime",
  "achievements",
  "game_user_data",
  "platform_connections",
  "platform_credentials",
  "sync_runs",
  "app_settings",
  "metadata_cache",
];

async function main(): Promise<void> {
  loadLocalEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set");
  }
  const anon = createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: DB_SCHEMA },
  });
  let problems = 0;

  // The schema must be exposed in the API settings, otherwise nothing can be checked.
  const probe = await anon.from(TABLES[0]!).select("*").limit(1);
  if (probe.error?.code === "PGRST106") {
    console.error(
      `The schema "${DB_SCHEMA}" is not exposed yet. Add it under Project Settings → Data API → ` +
        "Exposed schemas (step 2 of docs/SETUP-SUPABASE-GITHUB.md), then run this check again.",
    );
    process.exit(1);
  }

  for (const table of TABLES) {
    const read = await anon.from(table).select("*").limit(1);
    const readable = !read.error && (read.data?.length ?? 0) > 0;
    const write = await anon.from(table).insert({}).select();
    // 42501 = permission denied / row level security: the only clear "no".
    const writeDenied = write.error?.code === "42501";
    const bad = readable || !writeDenied;
    if (bad) problems++;
    const writeText = writeDenied
      ? "denied"
      : write.error
        ? `UNCLEAR (${write.error.code ?? "no code"})`
        : "ALLOWED";
    console.log(
      `${(bad ? "PROBLEM" : "ok").padEnd(8)}${table.padEnd(24)}` +
        `read: ${read.error ? "denied" : readable ? "ROWS VISIBLE" : "no rows"}, write: ${writeText}`,
    );
  }

  const rpc = await anon.rpc("delete_demo_data");
  if (!rpc.error) {
    problems++;
    console.log("PROBLEM delete_demo_data() can be called without login");
  } else {
    console.log("ok      delete_demo_data()      denied without login");
  }

  if (problems > 0) {
    console.error(`${problems} problem(s): not every table is clearly locked without login.`);
    process.exit(1);
  }
  console.log("All tables are locked without login.");
}

main().catch((error) => {
  console.error(`Check failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(1);
});
