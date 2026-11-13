// Edge Function: starts the GitHub Actions workflow «Sync» for the buttons
// «Jetzt synchronisieren» and «Verbindung testen».
//
// Input (POST, JSON): { mode: "sync" | "test", adapter?: string }
// Output: { runId } – the app follows the progress in sync_runs – or { error }
//
// Secrets: GB_GITHUB_DISPATCH_TOKEN (fine-grained token, this repository only,
// «Actions: Read and write») and GB_GITHUB_REPO («owner/name»).
import { authorize, reply } from "../_common/http.ts";

/** A new run is refused while another one started less than this long ago is not finished. */
const BUSY_WINDOW_MINUTES = 15;
const ADAPTER_PATTERN = /^[a-z0-9-]{1,40}$/;

Deno.serve(async (request: Request) => {
  const caller = await authorize(request);
  if (caller instanceof Response) return caller;
  const { admin, userId } = caller;

  const token = Deno.env.get("GB_GITHUB_DISPATCH_TOKEN");
  const repo = Deno.env.get("GB_GITHUB_REPO");
  if (!token || !repo) {
    return reply(503, {
      error: "Der Knopf ist noch nicht eingerichtet: GitHub-Secret DISPATCH_TOKEN fehlt (Anleitung SETUP-SUPABASE-GITHUB).",
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return reply(400, { error: "Ungültige Anfrage." });
  }
  const mode = body.mode === "test" ? "test" : "sync";
  const adapter = typeof body.adapter === "string" && body.adapter !== "" ? body.adapter : null;
  if (adapter && !ADAPTER_PATTERN.test(adapter)) return reply(400, { error: "Unbekannte Quelle." });

  // One run at a time
  const since = new Date(Date.now() - BUSY_WINDOW_MINUTES * 60_000).toISOString();
  const busy = await admin
    .from("sync_runs")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["queued", "running"])
    .gte("created_at", since)
    .limit(1);
  if (busy.error) return reply(500, { error: "Der Sync-Status ist nicht lesbar." });
  if ((busy.data ?? []).length > 0) {
    return reply(409, { error: "Es läuft schon ein Sync. Bitte warten, bis er fertig ist.", runId: busy.data![0]!.id });
  }

  const created = await admin
    .from("sync_runs")
    .insert({ user_id: userId, mode, adapter_id: adapter, trigger: "manual", status: "queued" })
    .select("id")
    .single();
  if (created.error || !created.data) return reply(500, { error: "Der Sync konnte nicht angelegt werden." });
  const runId = created.data.id as string;

  const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/sync.yml/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "game-bibliothek",
    },
    body: JSON.stringify({ ref: "main", inputs: { mode, adapter: adapter ?? "", run_id: runId } }),
  });
  if (response.status !== 204) {
    const reason =
      response.status === 401 || response.status === 403 || response.status === 404
        ? "GitHub lehnt den Token ab (abgelaufen oder ohne «Actions: Read and write» für dieses Repo)."
        : `GitHub antwortet mit Status ${response.status}.`;
    await admin
      .from("sync_runs")
      .update({ status: "error", finished_at: new Date().toISOString(), results: [{ adapterId: "github", outcome: "error", message: reason }] })
      .eq("id", runId);
    return reply(502, { error: `Der Sync konnte nicht gestartet werden: ${reason}` });
  }
  return reply(200, { runId });
});
