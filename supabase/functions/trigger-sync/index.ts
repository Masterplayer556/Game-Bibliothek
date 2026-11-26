// Edge Function: starts the GitHub Actions workflow «Sync» for the buttons
// «Jetzt synchronisieren» and «Verbindung testen».
//
// Input (POST, JSON): { mode: "sync" | "test", adapter?: string }
// Output: { runId } – the app follows the progress in sync_runs – or { error }
//
// Secrets: GB_GITHUB_DISPATCH_TOKEN (fine-grained token, this repository only,
// «Actions: Read and write») and GB_GITHUB_REPO («owner/name»).
import { authorize, reply } from "../_common/http.ts";

/**
 * A new run is refused while another one is open and gave news less than this long ago: its
 * start, or its creation while it still waits. GitHub stops the sync job after 20 minutes and a
 * run can wait that long behind the scheduled one. Same window as RUN_STALE_AFTER_MS in the app.
 */
const BUSY_WINDOW_MINUTES = 25;
const ADAPTER_PATTERN = /^[a-z0-9-]{1,40}$/;
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

Deno.serve(async (request: Request) => {
  const caller = await authorize(request);
  if (caller instanceof Response) return caller;
  const { admin, userId } = caller;

  const token = Deno.env.get("GB_GITHUB_DISPATCH_TOKEN");
  const repo = Deno.env.get("GB_GITHUB_REPO");
  if (!token || !repo || !REPO_PATTERN.test(repo)) {
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
  const since = Date.now() - BUSY_WINDOW_MINUTES * 60_000;
  const open = await admin
    .from("sync_runs")
    .select("id, created_at, started_at")
    .eq("user_id", userId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(20);
  if (open.error) return reply(500, { error: "Der Sync-Status ist nicht lesbar." });
  const busy = ((open.data ?? []) as { id: string; created_at: string; started_at: string | null }[]).find(
    (r) => new Date(r.started_at ?? r.created_at).getTime() >= since,
  );
  if (busy) {
    return reply(409, { error: "Es läuft schon ein Sync. Bitte warten, bis er fertig ist.", runId: busy.id });
  }

  const created = await admin
    .from("sync_runs")
    .insert({ user_id: userId, mode, adapter_id: adapter, trigger: "manual", status: "queued" })
    .select("id")
    .single();
  if (created.error || !created.data) return reply(500, { error: "Der Sync konnte nicht angelegt werden." });
  const runId = created.data.id as string;

  // null = started. A run that could not be started must not stay «queued»: it would block
  // the button for the whole busy window.
  let problem: string | null = null;
  try {
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
    // Each refusal has its own cause and its own fix (guide SETUP-SUPABASE-GITHUB, step 6).
    if (response.status === 401) {
      problem = "GitHub kennt den Token nicht (abgelaufen, gelöscht oder falsch kopiert). Neuen Token erstellen.";
    } else if (response.status === 403) {
      problem = "Der Token darf keine Workflows starten: Ihm fehlt «Actions: Read and write».";
    } else if (response.status === 404) {
      problem = `Der Token sieht das Repo ${repo} nicht: Beim Token unter «Repository access» dieses Repo auswählen.`;
    } else if (response.status === 422) {
      problem = "GitHub findet den Workflow «Sync» auf main nicht oder lehnt die Eingaben ab.";
    } else if (response.status !== 204) {
      problem = `GitHub antwortet mit Status ${response.status}.`;
    }
    if (problem) {
      // GitHub's own reason, for the run's log (not shown in the button's message).
      console.error(`dispatch ${response.status}: ${(await response.text().catch(() => "")).slice(0, 300)}`);
    }
  } catch {
    problem = "GitHub ist gerade nicht erreichbar.";
  }
  if (problem) {
    await admin
      .from("sync_runs")
      .update({ status: "error", finished_at: new Date().toISOString(), results: [{ adapterId: "github", outcome: "error", message: problem }] })
      .eq("id", runId);
    return reply(502, { error: `Der Sync konnte nicht gestartet werden: ${problem}` });
  }
  return reply(200, { runId });
});
