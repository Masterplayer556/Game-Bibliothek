// Shared by all Edge Functions of this app: CORS, JSON replies and the login check.
// (Runs on Deno. Unlike ../_shared, this folder is committed, not generated.)
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const SCHEMA = "game_bibliothek";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

export interface Caller {
  admin: SupabaseClient;
  userId: string;
  encryptionKey: string;
}

/**
 * Checks the login token and the allowed e-mail. Returns the caller, or a ready Response
 * to send back. The gateway does not verify tokens (deployed with --no-verify-jwt).
 *
 * CORS is open on purpose: access is decided by the login token in the Authorization
 * header, which another website cannot send, not by cookies.
 */
export async function authorize(request: Request): Promise<Caller | Response> {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return reply(405, { error: "Nur POST ist erlaubt." });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const encryptionKey = Deno.env.get("GB_CREDENTIALS_ENCRYPTION_KEY");
  if (!url || !serviceKey) return reply(500, { error: "Die Function ist nicht richtig eingerichtet." });
  if (!encryptionKey) {
    return reply(500, {
      error: "Das Secret GB_CREDENTIALS_ENCRYPTION_KEY fehlt. Bitte den Workflow «Edge Functions deployen» noch einmal starten.",
    });
  }

  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "Nicht angemeldet." });
  // The cast drops the schema name from the type, as in the app's own clients.
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: SCHEMA },
  }) as unknown as SupabaseClient;
  const { data, error } = await admin.auth.getUser(token);
  const user = data?.user;
  // An address nobody has confirmed proves nothing about who is calling.
  if (error || !user?.email || !user.email_confirmed_at) return reply(401, { error: "Nicht angemeldet." });

  const allowed = await admin.rpc("is_allowed_email", { candidate: user.email });
  if (allowed.error || allowed.data !== true) return reply(403, { error: "Kein Zugriff." });
  return { admin, userId: user.id, encryptionKey };
}
