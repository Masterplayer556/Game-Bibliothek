// Sync entry point. Independent of Next.js.
//
//   npm run sync                          all configured adapters
//   npm run sync -- --adapter=steam       one adapter
//   npm run sync -- --mode=test           connection test instead of a sync
//
// Options used by the workflow: --run-id=<sync_runs.id> --trigger=schedule|manual
import { parseArgs } from "node:util";
import { consoleLogger, loadLocalEnv } from "./env";
import { markKnownApps } from "./mark-apps";
import { runMetadataProviders } from "./metadata/run";
import { adapters, metadataProviders } from "./registry";
import { overallStatus, runAdapters } from "./runner";
import { createServiceClient, resolveUserId, SupabaseSyncStore } from "./store";
import type { RunMode } from "./types";

// The options come from workflow inputs. Their shape is checked before they are used or
// echoed into the (public) log.
const ADAPTER_ID = /^[a-z0-9-]{1,40}$/;
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const TRIGGERS = ["schedule", "manual", "local"] as const;
type Trigger = (typeof TRIGGERS)[number];

function readOptions(): { mode: RunMode; trigger: Trigger; only?: string; runId?: string } {
  const { values } = parseArgs({
    options: {
      adapter: { type: "string" },
      mode: { type: "string", default: "sync" },
      "run-id": { type: "string" },
      trigger: { type: "string", default: "local" },
    },
  });
  const mode = values.mode;
  if (mode !== "sync" && mode !== "test") throw new Error("--mode must be sync or test");
  const trigger = TRIGGERS.find((t) => t === values.trigger);
  if (!trigger) throw new Error("--trigger must be schedule, manual or local");
  const only = values.adapter || undefined;
  if (only && !ADAPTER_ID.test(only)) throw new Error("--adapter is not a valid adapter id");
  const runId = values["run-id"] || undefined;
  if (runId && !UUID.test(runId)) throw new Error("--run-id is not a valid id");
  return { mode, trigger, only, runId };
}

async function main(): Promise<void> {
  loadLocalEnv();
  const { mode, trigger, only, runId: givenRunId } = readOptions();

  const db = createServiceClient(process.env);
  const userId = await resolveUserId(db, process.env);
  const store = new SupabaseSyncStore(db, userId, process.env.CREDENTIALS_ENCRYPTION_KEY);
  const runId = await store.startRun({ runId: givenRunId, mode, adapterId: only, trigger });

  console.log(`Sync run started (mode: ${mode}, adapters: ${only ?? "all"})`);
  try {
    const metadataOnly = metadataProviders.some((p) => p.id === only);
    const results = metadataOnly
      ? []
      : await runAdapters({ adapters, store, mode, only, env: process.env, log: consoleLogger });

    // Known apps (YouTube, Netflix, …) become «Kein Spiel», once per entry.
    if (mode === "sync") {
      try {
        const marked = await markKnownApps(db, userId);
        if (marked > 0) console.log(`${marked} app(s) marked as not a game`);
      } catch {
        consoleLogger.warn("marking apps failed");
      }
    }

    // Metadata (IGDB) after the platforms, so new games get cover and genres right away.
    results.push(
      ...(await runMetadataProviders({
        db,
        userId,
        providers: metadataProviders,
        mode,
        only,
        env: process.env,
        fetch,
        log: consoleLogger,
      })),
    );

    const status = overallStatus(results);
    await store.finishRun(runId, status, results);
    console.log(`Sync run finished: ${status} (${results.length} sources)`);
    // The run log must not grow forever or keep dead runs open.
    await store.tidyRuns(new Date()).catch(() => consoleLogger.warn("tidying the run log failed"));
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
