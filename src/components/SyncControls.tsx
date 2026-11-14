"use client";

import { useEffect, useRef, useState } from "react";
import { ADAPTER_CATALOG } from "@/core/adapter-catalog";
import { isFinished, isStale, latestRun, loadRun, startSync, type SyncRun } from "@/lib/sync-control";
import { workflowUrl } from "@/lib/links";
import { getSupabase } from "@/lib/supabase";
import { formatDateTime } from "./game-ui";
import { Button, Card, fieldClass, Notice } from "./ui";
import { errorMessage } from "@/lib/errors";

const SOURCES = [...ADAPTER_CATALOG.filter((a) => a.credentialSource !== "none"), { id: "igdb", displayName: "IGDB" }];

const STATUS_TEXT: Record<SyncRun["status"], string> = {
  queued: "wartet auf GitHub …",
  running: "läuft …",
  success: "fertig",
  partial: "fertig, mit Fehlern",
  error: "fehlgeschlagen",
};

const OUTCOME_TEXT: Record<string, string> = {
  ok: "ok",
  error: "Fehler",
  auth_expired: "Anmeldung abgelaufen",
  skipped_not_configured: "nicht verbunden",
  skipped_disabled: "ausgeschaltet",
};

function sourceName(id: string): string {
  return SOURCES.find((s) => s.id === id)?.displayName ?? id;
}

export function SyncControls({ onFinished }: { onFinished: () => void }) {
  const [source, setSource] = useState("");
  const [run, setRun] = useState<SyncRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Show the last run (also one started by the schedule) and keep following it if open.
  useEffect(() => {
    let active = true;
    latestRun(getSupabase()).then(
      (r) => {
        if (!active || !r) return;
        setRun(r);
        if (!isFinished(r.status) && !isStale(r, new Date())) follow(r.id);
      },
      () => undefined,
    );
    return () => {
      active = false;
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  function follow(runId: string) {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(async () => {
      try {
        const r = await loadRun(getSupabase(), runId);
        if (!r) return;
        setRun(r);
        if (isFinished(r.status) || isStale(r, new Date())) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          if (isFinished(r.status)) onFinished();
        }
      } catch {
        // try again with the next tick
      }
    }, 5000);
  }

  async function start(mode: "sync" | "test") {
    setBusy(true);
    setError(null);
    try {
      const runId = await startSync(getSupabase(), mode, source || null);
      const r = await loadRun(getSupabase(), runId);
      if (r) setRun(r);
      follow(runId);
    } catch (e) {
      setError(errorMessage(e));
    }
    setBusy(false);
  }

  // A run without any answer for too long no longer blocks the buttons.
  const stale = run !== null && isStale(run, new Date());
  const running = run !== null && !isFinished(run.status) && !stale;

  return (
    <Card title="Synchronisieren">
      <Notice>
        Der Sync läuft automatisch alle 6 Stunden. Hier startest du ihn sofort. Er läuft auf GitHub
        und dauert etwa 1 bis 3 Minuten; die Seite zeigt das Ergebnis, sobald er fertig ist.
      </Notice>
      <label className="flex flex-col gap-1 text-sm">
        Quelle
        <select className={fieldClass} value={source} onChange={(e) => setSource(e.target.value)} disabled={running}>
          <option value="">Alle</option>
          {SOURCES.map((s) => (
            <option key={s.id} value={s.id}>{s.displayName}</option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-stack">
        <Button variant="primary" disabled={busy || running} onClick={() => start("sync")}>
          Jetzt synchronisieren
        </Button>
        <Button disabled={busy || running} onClick={() => start("test")}>
          Verbindung testen
        </Button>
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {run ? (
        <div className="flex flex-col gap-1 rounded-control bg-surface-raised p-3 text-sm" aria-live="polite">
          <div className="flex justify-between gap-2">
            <span>
              {run.mode === "test" ? "Verbindungstest" : "Sync"}
              {run.adapter_id ? ` · ${sourceName(run.adapter_id)}` : ""}
            </span>
            <span className={stale ? "text-warning" : run.status === "success" ? "text-success" : run.status === "error" ? "text-danger" : "text-muted"}>
              {stale ? "keine Rückmeldung" : STATUS_TEXT[run.status]}
            </span>
          </div>
          <span className="text-xs text-muted">gestartet {formatDateTime(run.created_at)}</span>
          {isFinished(run.status) && run.results.length > 0 ? (
            <ul className="text-xs">
              {run.results.map((r) => (
                <li key={r.adapterId} className={r.outcome === "ok" || r.outcome.startsWith("skipped") ? "text-muted" : "text-warning"}>
                  {sourceName(r.adapterId)}: {OUTCOME_TEXT[r.outcome] ?? r.outcome}
                  {r.message ? ` · ${r.message}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {stale ? (
            <span className="text-xs text-warning">
              Dieser Lauf hat sich nicht zurückgemeldet. Du kannst einen neuen starten oder{" "}
              <a className="underline" href={workflowUrl("sync.yml")} target="_blank" rel="noopener noreferrer">
                auf GitHub nachsehen
              </a>
              .
            </span>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
