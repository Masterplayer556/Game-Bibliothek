// Runs the metadata providers after the platform adapters, each on its own: a failing
// provider never blocks the run. Mirrors what runner.ts does for platform adapters.
import type { SupabaseClient } from "@supabase/supabase-js";
import { redact } from "../runner";
import type { AdapterRunResult, Logger, RunMode } from "../types";
import { enrichMetadata, setMetadataStatus } from "./enrich";
import type { MetadataProvider } from "./types";

export interface MetadataRunOptions {
  db: SupabaseClient;
  userId: string;
  providers: readonly MetadataProvider[];
  mode: RunMode;
  /** The run is limited to this adapter or provider. */
  only?: string;
  env: Readonly<Record<string, string | undefined>>;
  fetch: typeof fetch;
  log: Logger;
  now?: Date;
}

export async function runMetadataProviders(options: MetadataRunOptions): Promise<AdapterRunResult[]> {
  const { db, userId, mode, only, env, log } = options;
  const results: AdapterRunResult[] = [];

  for (const provider of options.providers) {
    // A sync of one platform still fetches covers for its new games; a test of one platform
    // does not test the providers.
    if (mode === "test" && only && only !== provider.id) continue;
    const now = options.now ?? new Date();

    if (!provider.isConfigured(env)) {
      await setMetadataStatus(db, userId, provider, {
        status: "not_connected",
        configured: false,
        details: { missingEnv: provider.requiredEnv.filter((name) => !env[name]) },
      }, now);
      log.info(`${provider.id}: not configured, skipped`);
      results.push({ adapterId: provider.id, outcome: "skipped_not_configured" });
      continue;
    }

    const secrets = provider.requiredEnv.map((name) => env[name]);
    try {
      if (mode === "test") {
        const test = await provider.testConnection(env, options.fetch);
        const message = redact(test.message, secrets);
        await setMetadataStatus(db, userId, provider, {
          status: test.ok ? "ok" : "error",
          configured: true,
          error: test.ok ? null : message,
          details: { lastTestMessage: message },
          success: test.ok,
        }, now);
        log.info(`${provider.id}: connection test ${test.ok ? "ok" : "failed"}`);
        results.push({ adapterId: provider.id, outcome: test.ok ? "ok" : "error", message });
        continue;
      }
      const summary = await enrichMetadata({ db, userId, provider, env, fetch: options.fetch, now, log });
      await setMetadataStatus(db, userId, provider, { status: "ok", configured: true, details: { ...summary }, success: true }, now);
      results.push({ adapterId: provider.id, outcome: "ok" });
    } catch (error) {
      const message = redact(error instanceof Error ? error.message : "Unbekannter Fehler", secrets);
      // The public log only says that it failed, the details go to the database.
      log.warn(`${provider.id}: failed`);
      await setMetadataStatus(db, userId, provider, { status: "error", configured: true, error: message }, now).catch(() => undefined);
      results.push({ adapterId: provider.id, outcome: "error", message });
    }
  }
  return results;
}
