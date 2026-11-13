// Buttons «Jetzt synchronisieren» / «Verbindung testen»: start through the Edge Function
// «trigger-sync», then follow the run in sync_runs (written by the sync script).
import type { SupabaseClient } from "@supabase/supabase-js";

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

export async function startSync(db: SupabaseClient, mode: "sync" | "test", adapter: string | null): Promise<string> {
  const { data, error } = await db.functions.invoke("trigger-sync", { body: { mode, adapter } });
  if (error) {
    let message = "Der Sync konnte nicht gestartet werden.";
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      if (context.status === 404) message = "Die Function «trigger-sync» ist noch nicht eingerichtet (Workflow «Edge Functions deployen»).";
      try {
        const body = (await context.json()) as { error?: unknown; runId?: unknown };
        // Already running: follow that run instead of failing.
        if (context.status === 409 && typeof body.runId === "string") return body.runId;
        if (typeof body.error === "string") message = body.error;
      } catch {
        // no readable body
      }
    }
    throw new Error(message);
  }
  return (data as { runId: string }).runId;
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
