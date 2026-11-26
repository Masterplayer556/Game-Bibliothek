"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { dedupeSharedTrophyLists } from "@/core/achievements";
import { buildLibrary, type Library, type RawData } from "@/core/library";
import { loadRawData, loadRawParts, ReloadOrder, type RawPart } from "@/lib/library-data";
import { getSupabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { useSyncRun, type SyncRunState } from "./sync-run";

/** Coming back to the app (other tab, phone unlocked) reloads the data if it is older than this. */
const RELOAD_ON_RETURN_AFTER_MS = 60_000;

interface LibraryContextValue {
  session: Session;
  raw: RawData | null;
  library: Library | null;
  error: string | null;
  /**
   * Reload after a change: only the tables given (what the change touched), or everything.
   * Resolves when the new data is shown.
   */
  reload: (parts?: readonly RawPart[]) => Promise<void>;
  /** The sync run started (or seen) under «Synchronisieren»; kept while browsing other pages. */
  sync: SyncRunState;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ session, children }: { session: Session; children: ReactNode }) {
  const [raw, setRaw] = useState<RawData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadedAt = useRef(0);
  // Answers can arrive out of order (a slow full reload after a quick one): only newer tables
  // are shown. `shownRef` mirrors `raw` so the decision is made outside the state updater.
  const order = useRef(new ReloadOrder());
  const shownRef = useRef<RawData | null>(null);
  const show = useCallback((ticket: number, fresh: Partial<RawData>) => {
    const next = order.current.take(ticket, fresh, shownRef.current);
    if (!next) return;
    shownRef.current = next;
    setRaw(next);
  }, []);

  const reload = useCallback(
    async (parts?: readonly RawPart[]) => {
      const ticket = order.current.begin();
      try {
        if (parts) {
          show(ticket, await loadRawParts(getSupabase(), parts));
        } else {
          show(ticket, await loadRawData(getSupabase()));
          loadedAt.current = Date.now();
        }
        setError(null);
      } catch (e) {
        setError(errorMessage(e));
      }
    },
    [show],
  );

  useEffect(() => {
    let active = true;
    const ticket = order.current.begin();
    loadRawData(getSupabase()).then(
      (data) => {
        if (!active) return;
        show(ticket, data);
        loadedAt.current = Date.now();
      },
      (e: unknown) => {
        if (active) setError(errorMessage(e));
      },
    );
    // A scheduled sync may have run while the app was in the background.
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - loadedAt.current > RELOAD_ON_RETURN_AFTER_MS) void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload, show]);

  const sync = useSyncRun(useCallback(() => void reload(), [reload]));

  // A trophy list shared by two versions counts once. Done here, on the whole data, so a
  // partial reload never joins a list twice.
  const shown = useMemo(() => (raw ? dedupeSharedTrophyLists(raw) : null), [raw]);
  const library = useMemo(() => (shown ? buildLibrary(shown) : null), [shown]);
  const value = useMemo(
    () => ({ session, raw: shown, library, error, reload, sync }),
    [session, shown, library, error, reload, sync],
  );
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibraryContext(): LibraryContextValue {
  const value = useContext(LibraryContext);
  if (!value) throw new Error("useLibraryContext outside LibraryProvider");
  return value;
}
