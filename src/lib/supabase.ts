import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DB_SCHEMA } from "@/core/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** False until the two public build variables are set (see docs/SETUP-SUPABASE-GITHUB.md). */
export const isSupabaseConfigured = url !== "" && publishableKey !== "";

/**
 * Where the login is kept in localStorage: Supabase's own default name, given explicitly so the
 * app can read it when starting without a connection (see use-session.ts).
 */
export const AUTH_STORAGE_KEY = (() => {
  try {
    return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  } catch {
    return "sb-auth-token";
  }
})();

let client: SupabaseClient | null = null;

/** Browser client. All access is protected by login + row level security. */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");
  client ??= createClient(url, publishableKey, {
    db: { schema: DB_SCHEMA },
    auth: { storageKey: AUTH_STORAGE_KEY },
  }) as unknown as SupabaseClient;
  return client;
}
