// Sync entry point. Independent of Next.js.
//
//   npm run sync                          all configured adapters
//   npm run sync -- --adapter=steam       one adapter
//   npm run sync -- --mode=test           connection test instead of a sync
//
// Options used by the workflow: --run-id=<sync_runs.id> --trigger=schedule|manual
import { parseArgs } from "node:util";
import { consoleLogger, loadLocalEnv } from "./env";
import { adapters } from "./registry";
import { overallStatus, runAdapters } from "./runner";
import { createServiceClient, resolveUserId, SupabaseSyncStore } from "./store";
import type { RunMode } from "./types";

async function main(): Promise<void> {
  loadLocalEnv();
  const { values } = parseArgs({
    options: {
      adapter: { type: "string" },
      mode: { type: "string", default: "sync" },
      "run-id": { type: "string" },
      trigger: { type: "string", default: "local" },
    },
  });
  const mode = values.mode as RunMode;
  if (mode !== "sync" && mode !== "test") throw new Error("--mode must be sync or test");
  const trigger = values.trigger as "schedule" | "manual" | "local";
  if (!["schedule", "manual", "local"].includes(trigger)) throw new Error("Invalid --trigger");
  const only = values.adapter || undefined;

  const db = createServiceClient(process.env);
  const userId = await resolveUserId(db, process.env);
  const store = new SupabaseSyncStore(db, userId, process.env.CREDENTIALS_ENCRYPTION_KEY);

  const runId = await store.startRun({
    runId: values["run-id"] || undefined,
    mode,
    adapterId: only,
    trigger,
  });

  console.log(`Sync run started (mode: ${mode}, adapters: ${only ?? "all"})`);
  try {
    const results = await runAdapters({
      adapters,
      store,
      mode,
      only,
      env: process.env,
      log: consoleLogger,
    });
    const status = overallStatus(results);
    await store.finishRun(runId, status, results);
    console.log(`Sync run finished: ${status} (${results.length} adapters)`);
  } catch (error) {
    await store.finishRun(runId, "error", []).catch(() => undefined);
    throw error;
  }
}

main().catch((error) => {
  // Message only, never the full error object: logs of a public repository are public.
  console.error(`Sync failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(1);
});
