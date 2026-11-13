// Marks known apps (YouTube, Netflix, …) as «Kein Spiel», once per game. A game that already
// has my own data is never touched, so un-hiding an entry in the app sticks.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isKnownApp } from "../src/core/apps";
import { fetchAll } from "../src/data/persist";

export async function markKnownApps(db: SupabaseClient, userId: string): Promise<number> {
  const games = await fetchAll<{ id: string; title: string }>((from, to) =>
    db.from("games").select("id, title").eq("user_id", userId).order("id").range(from, to),
  );
  const apps = games.filter((g) => isKnownApp(g.title));
  if (apps.length === 0) return 0;
  const existing = await fetchAll<{ game_id: string }>((from, to) =>
    db.from("game_user_data").select("game_id").eq("user_id", userId).order("game_id").range(from, to),
  );
  const touched = new Set(existing.map((e) => e.game_id));
  const rows = apps
    .filter((g) => !touched.has(g.id))
    .map((g) => ({ game_id: g.id, user_id: userId, hidden: true }));
  if (rows.length === 0) return 0;
  const { error } = await db.from("game_user_data").insert(rows);
  if (error) throw new Error(`Could not mark apps: ${error.message}`);
  return rows.length;
}
