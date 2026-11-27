// Reads every table the app stores for me, for «Daten herunterladen». Row level security
// returns only my own rows; the encrypted logins (platform_credentials) are not readable at all.
import type { SupabaseClient } from "@supabase/supabase-js";
import { BACKUP_TABLES, buildBackup, type Backup, type BackupTable } from "@/core/backup";
import { fetchAll } from "@/data/persist";

/** The column each table is paged by (unique, so no row is read twice or skipped). */
const ORDER: Record<BackupTable, string> = {
  games: "id",
  game_user_data: "game_id",
  platform_games: "id",
  devices: "id",
  daily_playtime: "id",
  playtime_snapshots: "id",
  achievements: "id",
  platform_connections: "adapter_id",
  sync_runs: "id",
  app_settings: "user_id",
};

export async function loadBackup(db: SupabaseClient, now = new Date()): Promise<Backup> {
  const read = (table: BackupTable) =>
    fetchAll<Record<string, unknown>>((from, to) =>
      db.from(table).select("*").order(ORDER[table]).range(from, to) as unknown as PromiseLike<{
        data: Record<string, unknown>[] | null;
        error: { message: string } | null;
      }>,
    );
  // One table after the other: kinder to the database than ten at once, and quick enough.
  const tables = {} as Record<BackupTable, Record<string, unknown>[]>;
  for (const table of BACKUP_TABLES) tables[table] = await read(table);
  return buildBackup(tables, now);
}
