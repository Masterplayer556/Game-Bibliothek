// Queries for the start page. Kept apart from the components that display them.
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDemoBatches } from "@/core/demo";
import { DEMO_SOURCE, type ConnectionStatus } from "@/core/types";
import { deleteDemoData, persistBatch } from "@/data/persist";

export const COUNTED_TABLES = [
  ["games", "Spiele"],
  ["platform_games", "Plattform-Einträge"],
  ["daily_playtime", "Tageswerte"],
  ["playtime_snapshots", "Snapshots"],
  ["achievements", "Erfolge"],
] as const;

export interface ConnectionRow {
  adapter_id: string;
  status: ConnectionStatus;
  last_success_at: string | null;
  last_error: string | null;
  details: { missingEnv?: string[] } | null;
}

export interface Overview {
  counts: Record<string, number>;
  demoEntries: number;
  connections: ConnectionRow[];
}

export async function loadOverview(db: SupabaseClient): Promise<Overview> {
  const counts: Record<string, number> = {};
  for (const [table] of COUNTED_TABLES) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    counts[table] = count ?? 0;
  }
  const demo = await db
    .from("platform_games")
    .select("*", { count: "exact", head: true })
    .eq("source", DEMO_SOURCE);
  if (demo.error) throw new Error(demo.error.message);

  const connections = await db
    .from("platform_connections")
    .select("adapter_id, status, last_success_at, last_error, details");
  if (connections.error) throw new Error(connections.error.message);

  return {
    counts,
    demoEntries: demo.count ?? 0,
    connections: (connections.data ?? []) as ConnectionRow[],
  };
}

export async function loadDemoData(db: SupabaseClient, userId: string): Promise<void> {
  await deleteDemoData(db);
  const now = new Date();
  for (const batch of buildDemoBatches(now)) {
    await persistBatch(db, userId, batch, now);
  }
}

export async function removeDemoData(db: SupabaseClient): Promise<void> {
  await deleteDemoData(db);
}
