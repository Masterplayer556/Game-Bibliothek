"use client";

import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/errors";
import { failuresBySource, formatDuration, isFinished, isStale, recentRuns, runDurationMs, type SyncRun } from "@/lib/sync-control";
import { getSupabase } from "@/lib/supabase";
import { formatDateTime } from "./game-ui";
import { useLibraryContext } from "./LibraryProvider";
import { OUTCOME_TEXT, sourceName, STATUS_TEXT } from "./SyncControls";
import { Card, Notice } from "./ui";

const TRIGGER_TEXT: Record<NonNullable<SyncRun["trigger"]>, string> = {
  schedule: "automatisch",
  manual: "per Knopf",
  local: "von Hand (Terminal)",
};

const RUNS = 20;

function tone(run: SyncRun, stale: boolean): string {
  if (stale) return "text-warning";
  if (run.status === "success") return "text-success";
  if (run.status === "error") return "text-danger";
  if (run.status === "partial") return "text-warning";
  return "text-muted";
}

/** The last runs with status, duration and the result per source: one-off or recurring failure? */
export function SyncHistory() {
  const { run: current } = useLibraryContext().sync;
  const [runs, setRuns] = useState<SyncRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Read again whenever the run under «Synchronisieren» changes its state (e.g. it finished).
  const key = current ? `${current.id}:${current.status}` : "";

  useEffect(() => {
    let active = true;
    recentRuns(getSupabase(), RUNS).then(
      (r) => {
        if (!active) return;
        setRuns(r);
        setError(null);
      },
      (e: unknown) => {
        if (active) setError(errorMessage(e));
      },
    );
    return () => {
      active = false;
    };
  }, [key]);

  const now = new Date();
  const failures = runs ? failuresBySource(runs) : [];

  return (
    <Card title="Sync-Verlauf" subtitle={`Die letzten ${RUNS} Läufe`} icon="list" tone="stats" collapsible>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {!runs && !error ? <Notice>Lade …</Notice> : null}
      {runs && runs.length === 0 ? <Notice>Noch kein Lauf.</Notice> : null}
      {failures.length > 0 ? (
        <Notice tone="warning">
          Fehler in diesen Läufen: {failures.map((f) => `${sourceName(f.adapterId)} ${f.count}×`).join(", ")}.
        </Notice>
      ) : runs && runs.length > 0 ? (
        <Notice>In diesen Läufen gab es keinen Fehler.</Notice>
      ) : null}
      {runs && runs.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {runs.map((r) => {
            const stale = isStale(r, now);
            const duration = runDurationMs(r);
            const problems = (r.results ?? []).filter((x) => x.outcome === "error" || x.outcome === "auth_expired");
            return (
              <li key={r.id}>
                <details className="rounded-control border border-border bg-surface-raised p-2.5 text-sm">
                  <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-2">
                    <span>
                      {formatDateTime(r.created_at)}
                      <span className="text-xs text-muted">
                        {" · "}
                        {r.mode === "test" ? "Test" : "Sync"}
                        {r.adapter_id ? ` ${sourceName(r.adapter_id)}` : ""}
                        {r.trigger ? `, ${TRIGGER_TEXT[r.trigger]}` : ""}
                      </span>
                    </span>
                    <span className={`text-xs font-semibold ${tone(r, stale)}`}>
                      {stale ? "keine Rückmeldung" : STATUS_TEXT[r.status]}
                      {duration !== null ? <span className="font-normal text-muted"> · {formatDuration(duration)}</span> : null}
                    </span>
                  </summary>
                  {problems.length > 0 ? (
                    <ul className="mt-1 text-xs text-warning">
                      {problems.map((p) => (
                        <li key={p.adapterId}>
                          {sourceName(p.adapterId)}: {OUTCOME_TEXT[p.outcome] ?? p.outcome}
                          {p.message ? ` · ${p.message}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {isFinished(r.status) && r.results.length > 0 ? (
                    <ul className="mt-1 text-xs text-muted">
                      {r.results
                        .filter((x) => x.outcome !== "error" && x.outcome !== "auth_expired")
                        .map((x) => (
                          <li key={x.adapterId}>
                            {sourceName(x.adapterId)}: {OUTCOME_TEXT[x.outcome] ?? x.outcome}
                            {x.message ? ` · ${x.message}` : ""}
                          </li>
                        ))}
                    </ul>
                  ) : null}
                  {!isFinished(r.status) && !stale ? <p className="mt-1 text-xs text-muted">Läuft noch.</p> : null}
                </details>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Card>
  );
}
