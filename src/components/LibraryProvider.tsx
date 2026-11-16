"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { buildLibrary, type Library, type RawData } from "@/core/library";
import { loadRawData } from "@/lib/library-data";
import { getSupabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";

interface LibraryContextValue {
  session: Session;
  raw: RawData | null;
  library: Library | null;
  error: string | null;
  /** Reload after a change. Resolves when the new data is shown. */
  reload: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ session, children }: { session: Session; children: ReactNode }) {
  const [raw, setRaw] = useState<RawData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRaw(await loadRawData(getSupabase()));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadRawData(getSupabase()).then(
      (data) => {
        if (active) setRaw(data);
      },
      (e: unknown) => {
        if (active) setError(errorMessage(e));
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const library = useMemo(() => (raw ? buildLibrary(raw) : null), [raw]);
  const value = useMemo(() => ({ session, raw, library, error, reload }), [session, raw, library, error, reload]);
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibraryContext(): LibraryContextValue {
  const value = useContext(LibraryContext);
  if (!value) throw new Error("useLibraryContext outside LibraryProvider");
  return value;
}
