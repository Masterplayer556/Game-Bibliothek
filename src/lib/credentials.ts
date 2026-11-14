// Sends a token typed into the app to the Edge Function «save-credential», which encrypts
// and stores it. The browser never gets read access to stored tokens.
import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeFunction } from "./functions";

export async function saveCredential(db: SupabaseClient, adapter: string, kind: string, value: string): Promise<void> {
  await invokeFunction(db, "save-credential", { adapter, kind, value }, "Speichern fehlgeschlagen. Bitte noch einmal versuchen.");
}
