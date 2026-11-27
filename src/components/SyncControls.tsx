"use client";

import { useState } from "react";
import { ADAPTER_CATALOG } from "@/core/adapter-catalog";
import { isFinished, isStale, type SyncRun } from "@/lib/sync-control";
import { workflowUrl } from "@/lib/links";
import { formatDateTime } from "./game-ui";
import { useLibraryContext } from "./LibraryProvider";
import { Button, Card, fieldClass, Notice } from "./ui";

const SOURCES = [...ADAPTER_CATALOG.filter((a) => a.credentialSource !== "none"), { id: "igdb", displayName: "IGDB" }];

export const STATUS_TEXT: Record<SyncRun["status"], string> = {
  queued: "wartet auf GitHub …",
  running: "läuft …",
  success: "fertig",
  partial: "fertig, mit Fehlern",
  error: "fehlgeschlagen",
};

export const OUTCOME_TEXT: Record<string, string> = {
  ok: "ok",
  error: "Fehler",
  auth_expired: "Anmeldung abgelaufen",
  skipped_not_configured: "nicht verbunden",
  skipped_disabled: "ausgeschaltet",
};

export function sourceName(id: string): string {
  if (id === "github") return "GitHub";
  return SOURCES.find((s) => s.id === id)?.displayName ?? id;
}

/** The run itself is kept by the LibraryProvider (see sync-run.ts), so it survives leaving the page. */
export function SyncControls() {
  const [source, setSource] = useState("");
  const { run, busy, error, start: startRun } = useLibraryContext().sync;
  const start = (mode: "sync" | "test") => startRun(mode, source || null);

  // A run without any answer for too long no longer blocks the buttons.
  const stale = run !== null && isStale(run, new Date());
  const running = run !== null && !isFinished(run.status) && !stale;

  return (
    <Card title="Synchronisieren" icon="sync" tone="stats">
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
        <div className="flex flex-col gap-1 rounded-control border border-border bg-surface-raised p-3 text-sm" aria-live="polite">
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
              <a className="link" href={workflowUrl("sync.yml")} target="_blank" rel="noopener noreferrer">
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
