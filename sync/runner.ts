// Runs every adapter on its own. A failing adapter never blocks the others.
import {
  AdapterError,
  type AdapterContext,
  type AdapterRunResult,
  type Logger,
  type PlatformAdapter,
  type RunMode,
  type SyncStore,
} from "./types";

export interface RunOptions {
  adapters: readonly PlatformAdapter[];
  store: SyncStore;
  mode: RunMode;
  /** Run only this adapter. */
  only?: string;
  env: Readonly<Record<string, string | undefined>>;
  log: Logger;
  now?: Date;
  fetch?: typeof fetch;
}

/** Removes secret values from a message before it is stored or shown. */
export function redact(message: string, secrets: readonly (string | undefined)[]): string {
  let out = message;
  for (const secret of secrets) {
    if (secret && secret.length >= 6) out = out.split(secret).join("***");
  }
  return out.slice(0, 500);
}

export async function runAdapters(options: RunOptions): Promise<AdapterRunResult[]> {
  const { adapters, store, mode, only, env, log } = options;
  const now = options.now ?? new Date();
  const results: AdapterRunResult[] = [];

  const selected = only ? adapters.filter((a) => a.id === only) : adapters;
  if (only && selected.length === 0) {
    throw new Error(`Unknown adapter: ${only}`);
  }

  for (const adapter of selected) {
    const nowIso = now.toISOString();
    let secrets: (string | undefined)[] = adapter.requiredEnv.map((name) => env[name]);
    try {
      if (!(await store.isEnabled(adapter.id))) {
        log.info(`${adapter.id}: disabled, skipped`);
        results.push({ adapterId: adapter.id, outcome: "skipped_disabled" });
        continue;
      }

      const credentials = await store.getCredentials(adapter.id);
      secrets = [...secrets, ...Object.values(credentials)];
      const ctx: AdapterContext = {
        credentials,
        env,
        previousGames: mode === "sync" ? await store.getPreviousGames(adapter) : new Map(),
        now,
        log,
        fetch: options.fetch ?? fetch,
      };

      if (!(await adapter.isConfigured(ctx))) {
        const missingEnv = adapter.requiredEnv.filter((name) => !env[name]);
        await store.setConnection(adapter, {
          status: "not_connected",
          configured: false,
          lastError: null,
          details: { missingEnv },
        });
        log.info(`${adapter.id}: not configured, skipped`);
        results.push({ adapterId: adapter.id, outcome: "skipped_not_configured" });
        continue;
      }

      if (mode === "test") {
        const test = await adapter.testConnection(ctx);
        if (test.credentialUpdates?.length) {
          await store.saveCredentials(adapter.id, test.credentialUpdates);
        }
        await store.setConnection(adapter, {
          status: test.ok ? "ok" : "error",
          configured: true,
          lastError: test.ok ? null : redact(test.message, secrets),
          tokenExpiresAt: test.tokenExpiresAt,
          details: { lastTestAt: nowIso, lastTestMessage: redact(test.message, secrets) },
        });
        log.info(`${adapter.id}: connection test ${test.ok ? "ok" : "failed"}`);
        results.push({
          adapterId: adapter.id,
          outcome: test.ok ? "ok" : "error",
          message: redact(test.message, secrets),
        });
        continue;
      }

      const result = await adapter.sync(ctx);
      // Tokens first: a rotated token must survive even if saving the data fails.
      if (result.credentialUpdates?.length) {
        await store.saveCredentials(adapter.id, result.credentialUpdates);
      }
      const summary = await store.saveBatch(result.batch, now);
      await store.setConnection(adapter, {
        status: "ok",
        configured: true,
        lastSyncAt: nowIso,
        lastSuccessAt: nowIso,
        lastError: null,
        dataSince: result.dataSince,
        tokenExpiresAt: result.tokenExpiresAt,
        details: { warnings: result.warnings?.length ?? 0 },
      });
      log.info(
        `${adapter.id}: ok (${summary.games} games, ${summary.newGames} new, ${summary.snapshots} snapshots, ` +
          `${summary.dailyRows} daily rows, ${summary.achievements} achievements)`,
      );
      results.push({
        adapterId: adapter.id,
        outcome: "ok",
        summary,
        warnings: result.warnings?.length ?? 0,
      });
    } catch (error) {
      const kind = error instanceof AdapterError ? error.kind : "unknown";
      const raw = error instanceof Error ? error.message : String(error);
      const message = redact(raw, secrets);
      const authExpired = kind === "auth_expired";
      // The public log only gets the kind of error, the details go to the database.
      log.warn(`${adapter.id}: failed (${kind})`);
      try {
        await store.setConnection(adapter, {
          status: authExpired ? "auth_expired" : "error",
          configured: true,
          lastSyncAt: mode === "sync" ? nowIso : undefined,
          lastError: message,
        });
      } catch {
        log.warn(`${adapter.id}: status could not be saved`);
      }
      results.push({
        adapterId: adapter.id,
        outcome: authExpired ? "auth_expired" : "error",
        message,
      });
    }
  }
  return results;
}

export function overallStatus(results: readonly AdapterRunResult[]): "success" | "partial" | "error" {
  const failed = results.filter((r) => r.outcome === "error" || r.outcome === "auth_expired").length;
  const ok = results.filter((r) => r.outcome === "ok").length;
  if (failed === 0) return "success";
  return ok > 0 ? "partial" : "error";
}
