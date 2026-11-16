// Edge Function: stores a token typed into the app, encrypted. Currently: the PlayStation
// NPSSO. The sync exchanges it for a refresh token on its next run and keeps it (encrypted)
// to log in again when the refresh token runs out.
//
// Input (POST, JSON): { adapter: "psn", kind: "npsso", value }
// Output: { ok: true } or { error }
import { encryptSecret } from "../_shared/crypto.ts";
import { authorize, reply } from "../_common/http.ts";

/** What may be stored, and how a valid value looks. */
const ALLOWED: Record<string, Record<string, { pattern: RegExp; message: string }>> = {
  psn: {
    npsso: {
      pattern: /^[A-Za-z0-9]{64}$/,
      message: "Die NPSSO besteht aus genau 64 Buchstaben und Ziffern. Bitte nur den Wert zwischen den Anführungszeichen kopieren.",
    },
  },
};

/** Accepts the bare value or the whole page {"npsso":"…"}. */
function extract(value: string): string {
  const text = value.trim();
  const fromJson = /"npsso"\s*:\s*"([^"]+)"/.exec(text);
  return (fromJson ? fromJson[1]! : text).trim();
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
  const adapter = typeof body.adapter === "string" ? body.adapter : "";
  const kind = typeof body.kind === "string" ? body.kind : "";
  const rule = ALLOWED[adapter]?.[kind];
  if (!rule) return reply(400, { error: "Dieser Wert kann hier nicht gespeichert werden." });
  const value = typeof body.value === "string" ? extract(body.value) : "";
  if (!rule.pattern.test(value)) return reply(400, { error: rule.message });

  const saved = await caller.admin.from("platform_credentials").upsert(
    {
      user_id: caller.userId,
      adapter_id: adapter,
      kind,
      ciphertext: await encryptSecret(value, caller.encryptionKey),
    },
    { onConflict: "user_id,adapter_id,kind" },
  );
  if (saved.error) return reply(500, { error: "Der Wert konnte nicht gespeichert werden." });

  if (adapter === "psn") {
    // A new NPSSO replaces the old login: drop the refresh token so the NPSSO is used.
    await caller.admin
      .from("platform_credentials")
      .delete()
      .eq("user_id", caller.userId)
      .eq("adapter_id", "psn")
      .eq("kind", "refresh_token");
    await caller.admin.from("platform_connections").upsert(
      {
        user_id: caller.userId,
        adapter_id: "psn",
        platform: "psn",
        status: "not_connected",
        configured: true,
        last_error: null,
        details: { npssoSavedAt: new Date().toISOString() },
      },
      { onConflict: "user_id,adapter_id" },
    );
  }
  return reply(200, { ok: true });
});
