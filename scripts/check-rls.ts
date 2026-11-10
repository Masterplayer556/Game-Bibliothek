// Checks the LIVE project from the outside, the way a stranger's browser would:
// with the public key and without login, nothing may be readable or writable.
//
//   npm run check:rls
import { createClient } from "@supabase/supabase-js";
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
];

async function main(): Promise<void> {
  loadLocalEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set");
  }
  const anon = createClient(url, key, { auth: { persistSession: false } });
  let problems = 0;

  for (const table of TABLES) {
    const read = await anon.from(table).select("*").limit(1);
    const readable = !read.error && (read.data?.length ?? 0) > 0;
    const write = await anon.from(table).insert({}).select();
    // 42501 = permission denied / row level security. Anything else is not a clear "no".
    const writable = write.error?.code !== "42501";
    const state = readable || writable ? "PROBLEM" : "ok";
    if (readable || writable) problems++;
    console.log(
      `${state.padEnd(8)}${table.padEnd(24)}read: ${read.error ? "denied" : readable ? "ROWS VISIBLE" : "no rows"}, ` +
        `write: ${writable ? "ALLOWED" : "denied"}`,
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
    console.error(`${problems} problem(s): data is exposed without login!`);
    process.exit(1);
  }
  console.log("All tables are locked without login.");
}

main().catch((error) => {
  console.error(`Check failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(1);
});
