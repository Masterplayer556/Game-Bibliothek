// Edge Function: searches IGDB for the app (choose another game, add a game).
// The IGDB secret must not reach the browser, so the search runs here.
//
// Input (POST, JSON): { query }
// Output: { results: IgdbGame[] } or { error }
import { authorize, reply } from "../_common/http.ts";
import { IgdbError, login, searchGames, type IgdbSession } from "../_shared/igdb-client.ts";

let cached: { session: IgdbSession; until: number } | null = null;

async function session(): Promise<IgdbSession | null> {
  const clientId = Deno.env.get("GB_IGDB_CLIENT_ID");
  const clientSecret = Deno.env.get("GB_IGDB_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  // A warm function keeps its Twitch token for a while.
  if (cached && cached.until > Date.now()) return cached.session;
  const s = await login(fetch, { clientId, clientSecret });
  cached = { session: s, until: Date.now() + 6 * 3600 * 1000 };
  return s;
}

Deno.serve(async (request: Request) => {
  const caller = await authorize(request);
  if (caller instanceof Response) return caller;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return reply(400, { error: "Ungültige Anfrage." });
  }
  const query = typeof body.query === "string" ? body.query.trim().slice(0, 120) : "";
  if (query.length < 2) return reply(400, { error: "Bitte mindestens zwei Zeichen eingeben." });

  try {
    const s = await session();
    if (!s) {
      return reply(503, { error: "IGDB ist noch nicht eingerichtet (GitHub-Secrets IGDB_CLIENT_ID und IGDB_CLIENT_SECRET, dann Workflow «Edge Functions deployen»)." });
    }
    return reply(200, { results: await searchGames(s, query, 10) });
  } catch (error) {
    cached = null;
    return reply(502, { error: error instanceof IgdbError ? error.message : "IGDB ist gerade nicht erreichbar." });
  }
});
