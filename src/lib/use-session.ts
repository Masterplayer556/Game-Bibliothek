"use client";

import { isAuthRetryableFetchError, type Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { clearCache, storedSession } from "./offline-cache";
import { AUTH_STORAGE_KEY, getSupabase, isSupabaseConfigured } from "./supabase";

/** undefined = still loading, null = logged out */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(
    isSupabaseConfigured ? undefined : null,
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data, error }) => {
      // Without a connection an expired access token cannot be refreshed: the client reports no
      // session although the login is still stored. Start with the stored one, so the cached
      // data is shown; the client refreshes it once the connection is back.
      if (!data.session && error && isAuthRetryableFetchError(error)) {
        let stored: string | null = null;
        try {
          stored = localStorage.getItem(AUTH_STORAGE_KEY);
        } catch {
          // no storage
        }
        setSession(storedSession(stored));
        return;
      }
      setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // The first state comes from getSession above (which knows about the offline case).
      if (event === "INITIAL_SESSION") return;
      if (event === "SIGNED_OUT") void clearCache();
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return session;
}
