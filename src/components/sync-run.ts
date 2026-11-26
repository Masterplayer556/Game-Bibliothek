"use client";

// The sync run shown under «Synchronisieren», kept by the LibraryProvider rather than the page:
// leaving the page no longer forgets a running sync, and when it finishes the data is reloaded
// wherever one is. Coming back to the app checks the run at once instead of waiting.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage } from "@/lib/errors";
import { isFinished, isStale, latestRun, loadRun, startSync, type SyncRun } from "@/lib/sync-control";
import { getSupabase } from "@/lib/supabase";

const POLL_MS = 5000;

export interface SyncRunState {
  run: SyncRun | null;
  busy: boolean;
  error: string | null;
  start: (mode: "sync" | "test", adapter: string | null) => Promise<void>;
}

export function useSyncRun(onFinished: () => void): SyncRunState {
  const [run, setRun] = useState<SyncRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const following = useRef<string | null>(null);
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  }, [onFinished]);

  // Plain functions over refs: they are recreated per render but always act on the same timer.
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    following.current = null;
  };
  const check = async (runId: string) => {
    try {
      const r = await loadRun(getSupabase(), runId);
      if (!r || following.current !== runId) return;
      setRun(r);
      if (isFinished(r.status) || isStale(r, new Date())) {
        stop();
        if (isFinished(r.status)) finished.current();
      }
    } catch {
      // try again with the next tick
    }
  };
  const follow = (runId: string) => {
    stop();
    following.current = runId;
    timer.current = setInterval(() => void check(runId), POLL_MS);
  };
  // The last run (also one started by the schedule): shown, and followed while it is open.
  const showLatest = async () => {
    try {
      const r = await latestRun(getSupabase());
      if (!r) return;
      setRun(r);
      if (!isFinished(r.status) && !isStale(r, new Date())) follow(r.id);
    } catch {
      // nothing to show
    }
  };
  const handlers = useRef({ check, showLatest, stop });
  useEffect(() => {
    handlers.current = { check, showLatest, stop };
  });

  useEffect(() => {
    void handlers.current.showLatest();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (following.current) void handlers.current.check(following.current);
      else void handlers.current.showLatest();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      handlers.current.stop();
    };
  }, []);

  const start = async (mode: "sync" | "test", adapter: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const runId = await startSync(getSupabase(), mode, adapter);
      const r = await loadRun(getSupabase(), runId);
      if (r) setRun(r);
      follow(runId);
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  };

  // Stable, so the context value only changes with the run itself.
  const startRef = useRef(start);
  useEffect(() => {
    startRef.current = start;
  });
  const stableStart = useCallback((mode: "sync" | "test", adapter: string | null) => startRef.current(mode, adapter), []);
  return useMemo(() => ({ run, busy, error, start: stableStart }), [run, busy, error, stableStart]);
}
