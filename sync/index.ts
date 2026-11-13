// Sync entry point. Independent of Next.js.
//
//   npm run sync                          all configured adapters
//   npm run sync -- --adapter=steam       one adapter
//   npm run sync -- --mode=test           connection test instead of a sync
//
// Options used by the workflow: --run-id=<sync_runs.id> --trigger=schedule|manual
import { parseArgs } from "node:util";
import { consoleLogger, loadLocalEnv } from "./env";
import { enrichMetadata, setMetadataStatus } from "./metadata/enrich";
import { adapters, metadataProviders } from "./registry";
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
    const metadataOnly = metadataProviders.some((p) => p.id === only);
    const results = metadataOnly
      ? []
      : await runAdapters({ adapters, store, mode, only, env: process.env, log: consoleLogger });

    // Metadata (IGDB) after the platforms, so new games get cover and genres right away.
    for (const provider of metadataProviders) {
      if (only && only !== provider.id && mode === "test") continue;
      const now = new Date();
      if (!provider.isConfigured(process.env)) {
        await setMetadataStatus(db, userId, provider, {
          status: "not_connected",
          configured: false,
          details: { missingEnv: provider.requiredEnv.filter((n) => !process.env[n]) },
        }, now);
        continue;
      }
      try {
        if (mode === "test") {
          const test = await provider.testConnection(process.env, fetch);
          await setMetadataStatus(db, userId, provider, {
            status: test.ok ? "ok" : "error",
            configured: true,
            error: test.ok ? null : test.message,
            details: { lastTestMessage: test.message },
            success: test.ok,
          }, now);
          results.push({ adapterId: provider.id, outcome: test.ok ? "ok" : "error", message: test.message });
        } else {
          const summary = await enrichMetadata({ db, userId, provider, env: process.env, fetch, now, log: consoleLogger });
          await setMetadataStatus(db, userId, provider, { status: "ok", configured: true, details: { ...summary }, success: true }, now);
          results.push({ adapterId: provider.id, outcome: "ok" });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 300) : "Unbekannter Fehler";
        consoleLogger.warn(`${provider.id}: failed`);
        await setMetadataStatus(db, userId, provider, { status: "error", configured: true, error: message }, now).catch(() => undefined);
        results.push({ adapterId: provider.id, outcome: "error", message });
      }
    }
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
