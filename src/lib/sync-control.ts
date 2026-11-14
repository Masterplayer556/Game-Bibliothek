// Buttons «Jetzt synchronisieren» / «Verbindung testen»: start through the Edge Function
// «trigger-sync», then follow the run in sync_runs (written by the sync script).
import type { SupabaseClient } from "@supabase/supabase-js";
import { FunctionError, invokeFunction } from "./functions";

export type RunStatus = "queued" | "running" | "success" | "partial" | "error";

export interface RunResult {
  adapterId: string;
  outcome: string;
  message?: string;
}

export interface SyncRun {
  id: string;
  mode: "sync" | "test";
  adapter_id: string | null;
  status: RunStatus;
  results: RunResult[];
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export const isFinished = (status: RunStatus) => status === "success" || status === "partial" || status === "error";

/** Same window as in the Edge Function «trigger-sync»: after it, a new run may be started. */
export const RUN_STALE_AFTER_MS = 15 * 60_000;

/** An open run that has not reported back for too long (workflow cancelled or never started). */
export function isStale(run: Pick<SyncRun, "status" | "created_at">, now: Date): boolean {
  return !isFinished(run.status) && now.getTime() - new Date(run.created_at).getTime() > RUN_STALE_AFTER_MS;
}

export async function startSync(db: SupabaseClient, mode: "sync" | "test", adapter: string | null): Promise<string> {
  try {
    const answer = await invokeFunction<{ runId?: unknown }>(db, "trigger-sync", { mode, adapter }, "Der Sync konnte nicht gestartet werden.");
    if (typeof answer.runId !== "string") throw new Error("Der Sync konnte nicht gestartet werden.");
    return answer.runId;
  } catch (error) {
    // Already running: follow that run instead of failing.
    if (error instanceof FunctionError && error.status === 409 && typeof error.body.runId === "string") {
      return error.body.runId;
    }
    throw error;
  }
}

export async function loadRun(db: SupabaseClient, runId: string): Promise<SyncRun | null> {
  const { data, error } = await db
    .from("sync_runs")
    .select("id, mode, adapter_id, status, results, created_at, started_at, finished_at")
    .eq("id", runId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SyncRun | null) ?? null;
}

export async function latestRun(db: SupabaseClient): Promise<SyncRun | null> {
  const { data, error } = await db
    .from("sync_runs")
    .select("id, mode, adapter_id, status, results, created_at, started_at, finished_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SyncRun | null) ?? null;
}
