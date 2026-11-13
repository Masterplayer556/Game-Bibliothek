// Sends a token typed into the app to the Edge Function «save-credential», which encrypts
// and stores it. The browser never gets read access to stored tokens.
import type { SupabaseClient } from "@supabase/supabase-js";

export async function saveCredential(db: SupabaseClient, adapter: string, kind: string, value: string): Promise<void> {
  const { error } = await db.functions.invoke("save-credential", { body: { adapter, kind, value } });
  if (!error) return;
  let message = "Speichern fehlgeschlagen. Bitte noch einmal versuchen.";
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    if (context.status === 404) {
      message = "Die Function «save-credential» ist noch nicht eingerichtet (Workflow «Edge Functions deployen» starten).";
    }
    try {
      const body = (await context.json()) as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch {
      // no readable body
    }
  }
  throw new Error(message);
}
