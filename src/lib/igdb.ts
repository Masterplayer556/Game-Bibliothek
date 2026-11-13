// IGDB from the browser: search through the Edge Function, apply a choice directly
// (games are my own rows, protected by row level security).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IgdbGame } from "@/core/igdb/client";
import { mergeGames } from "./library-data";

export async function searchIgdb(db: SupabaseClient, query: string): Promise<IgdbGame[]> {
  const { data, error } = await db.functions.invoke("igdb-search", { body: { query } });
  if (error) {
    let message = "Die IGDB-Suche ist fehlgeschlagen.";
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      if (context.status === 404) message = "Die Function «igdb-search» ist noch nicht eingerichtet (Workflow «Edge Functions deployen»).";
      try {
        const body = (await context.json()) as { error?: unknown };
        if (typeof body.error === "string") message = body.error;
      } catch {
        // no readable body
      }
    }
    throw new Error(message);
  }
  return ((data ?? {}) as { results?: IgdbGame[] }).results ?? [];
}

/**
 * Sets the IGDB entry of a game by hand (null = no entry). The sync will not change it again.
 * Another game with the same IGDB id is joined into this one.
 */
export async function applyIgdb(db: SupabaseClient, gameId: string, choice: IgdbGame | null): Promise<void> {
  const { error } = await db
    .from("games")
    .update(
      choice
        ? { igdb_id: choice.igdbId, igdb_locked: true, cover_url: choice.coverUrl, genres: choice.genres, release_year: choice.releaseYear }
        : { igdb_id: null, igdb_locked: true, cover_url: null, genres: [], release_year: null },
    )
    .eq("id", gameId);
  if (error) throw new Error(error.message);
  if (!choice) return;
  const twins = await db.from("games").select("id").eq("igdb_id", choice.igdbId);
  if (twins.error) throw new Error(twins.error.message);
  for (const twin of (twins.data ?? []) as { id: string }[]) {
    if (twin.id !== gameId) await mergeGames(db, gameId, twin.id);
  }
}
