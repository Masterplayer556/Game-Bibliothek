import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DB_SCHEMA } from "@/core/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** False until the two public build variables are set (see docs/SETUP-SUPABASE-GITHUB.md). */
export const isSupabaseConfigured = url !== "" && publishableKey !== "";

let client: SupabaseClient | null = null;

/** Browser client. All access is protected by login + row level security. */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");
  client ??= createClient(url, publishableKey, {
    db: { schema: DB_SCHEMA },
  }) as unknown as SupabaseClient;
  return client;
}
