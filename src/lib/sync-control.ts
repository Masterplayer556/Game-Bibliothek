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
  /** Who started it: the 6-hour schedule, a button in the app or a terminal. */
  trigger?: "schedule" | "manual" | "local";
  status: RunStatus;
  results: RunResult[];
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export const isFinished = (status: RunStatus) => status === "success" || status === "partial" || status === "error";

/**
 * Same window as in the Edge Function «trigger-sync»: after it, a new run may be started. GitHub
 * stops the sync job after 20 minutes (sync.yml); a run may also wait that long behind the
 * scheduled one before it starts. Counted from its start, or from its creation while queued.
 */
export const RUN_STALE_AFTER_MS = 25 * 60_000;

/** An open run that has not reported back for too long (workflow cancelled or never started). */
export function isStale(run: Pick<SyncRun, "status" | "created_at" | "started_at">, now: Date): boolean {
  if (isFinished(run.status)) return false;
  const since = new Date(run.started_at ?? run.created_at).getTime();
  return now.getTime() - since > RUN_STALE_AFTER_MS;
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

/** The last runs, newest first, for «Sync-Verlauf» (the sync keeps 90 days). */
export async function recentRuns(db: SupabaseClient, limit = 20): Promise<SyncRun[]> {
  const { data, error } = await db
    .from("sync_runs")
    .select("id, mode, adapter_id, trigger, status, results, created_at, started_at, finished_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as SyncRun[];
}

/** How long a run took (from its start, else from its creation); null while it is open. */
export function runDurationMs(run: Pick<SyncRun, "created_at" | "started_at" | "finished_at">): number | null {
  if (!run.finished_at) return null;
  const ms = new Date(run.finished_at).getTime() - new Date(run.started_at ?? run.created_at).getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

/** «45 s», «2 Min. 05 s», «1 Std. 02 Min.». */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} Min. ${String(seconds % 60).padStart(2, "0")} s`;
  return `${Math.floor(minutes / 60)} Std. ${String(minutes % 60).padStart(2, "0")} Min.`;
}

/** Sources that failed (error or login expired) in the given runs: how often, newest message. */
export function failuresBySource(runs: readonly SyncRun[]): { adapterId: string; count: number; lastMessage: string | null }[] {
  const out = new Map<string, { adapterId: string; count: number; lastMessage: string | null }>();
  // runs come newest first: the first message seen is the latest
  for (const run of runs) {
    for (const r of run.results ?? []) {
      if (r.outcome !== "error" && r.outcome !== "auth_expired") continue;
      const known = out.get(r.adapterId) ?? { adapterId: r.adapterId, count: 0, lastMessage: r.message ?? null };
      known.count++;
      out.set(r.adapterId, known);
    }
  }
  return [...out.values()].sort((a, b) => b.count - a.count || a.adapterId.localeCompare(b.adapterId));
}
