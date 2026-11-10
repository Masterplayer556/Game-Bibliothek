"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { ADAPTER_CATALOG } from "@/core/adapter-catalog";
import type { ConnectionStatus } from "@/core/types";
import { COUNTED_TABLES, loadDemoData, loadOverview, removeDemoData, type Overview } from "@/lib/overview";
import { getSupabase } from "@/lib/supabase";
import { KeyGenerator } from "./KeyGenerator";
import { NintendoConnect } from "./NintendoConnect";
import { NintendoImport } from "./NintendoImport";
import { Button, Card, Notice } from "./ui";

/** Adapters up to this phase exist. */
const BUILT_UP_TO_PHASE = 2;

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  not_connected: "Noch nicht verbunden",
  ok: "Verbunden",
  error: "Fehler",
  auth_expired: "Anmeldung abgelaufen",
  disabled: "Ausgeschaltet",
};

function formatDate(value: string | null): string {
  if (!value) return "noch nie";
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Zurich",
  }).format(new Date(value));
}

export function Dashboard({ session }: { session: Session }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setOverview(await loadOverview(getSupabase()));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadOverview(getSupabase()).then(
      (result) => {
        if (active) setOverview(result);
      },
      (e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      },
    );
    return () => {
      active = false;
    };
  }, []);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    }
    await refresh();
    setBusy(null);
  }

  const supabase = getSupabase();
  const empty = overview !== null && overview.counts.games === 0;

  return (
    <>
      <Card title="Anmeldung">
        <Notice tone="success">Angemeldet als {session.user.email}</Notice>
        <div>
          <Button onClick={() => supabase.auth.signOut()}>Abmelden</Button>
        </div>
      </Card>

      <Card title="Datenbank">
        {error ? (
          <>
            <Notice tone="danger">Die Datenbank antwortet mit einem Fehler: {error}</Notice>
            <Notice>
              Häufigste Ursachen: Die Migration wurde noch nicht ausgeführt, oder deine E-Mail steht
              noch nicht in der Liste der erlaubten Adressen. Beides steht in der Anleitung
              «SETUP-SUPABASE-GITHUB».
            </Notice>
          </>
        ) : overview ? (
          <>
            <Notice tone="success">Verbindung zur Datenbank funktioniert.</Notice>
            <dl className="grid grid-cols-2 gap-stack sm:grid-cols-5">
              {COUNTED_TABLES.map(([table, label]) => (
                <div key={table} className="rounded-control bg-surface-raised p-3">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="text-xl font-semibold tabular-nums">{overview.counts[table]}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <Notice>Lade …</Notice>
        )}
      </Card>

      <Card title="Demo-Daten">
        <Notice>
          Füllt die App mit deiner Spieleliste und erfundenen Spielzeiten der letzten 14 Monate.
          Demo-Einträge lassen sich jederzeit komplett entfernen; echte Daten bleiben unberührt.
        </Notice>
        {overview ? (
          <Notice>Aktuell {overview.demoEntries} Demo-Einträge.</Notice>
        ) : null}
        <div className="flex flex-wrap gap-stack">
          <Button
            variant="primary"
            disabled={busy !== null}
            onClick={() => run("load", () => loadDemoData(supabase, session.user.id))}
          >
            {busy === "load" ? "Lade Demo-Daten …" : "Demo-Daten laden"}
          </Button>
          <Button disabled={busy !== null} onClick={() => run("remove", () => removeDemoData(supabase))}>
            {busy === "remove" ? "Lösche …" : "Demo-Daten löschen"}
          </Button>
        </div>
        {empty && !busy ? <Notice>Die Bibliothek ist noch leer.</Notice> : null}
      </Card>

      <Card title="Plattformen">
        <ul className="flex flex-col gap-stack">
          {ADAPTER_CATALOG.map((adapter) => {
            const connection = overview?.connections.find((c) => c.adapter_id === adapter.id);
            const status = connection?.status ?? "not_connected";
            const missing = connection?.details?.missingEnv ?? [];
            return (
              <li key={adapter.id} className="rounded-control bg-surface-raised p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{adapter.displayName}</span>
                  <span className={status === "ok" ? "text-sm text-success" : "text-sm text-muted"}>
                    {STATUS_LABEL[status]}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  {connection
                    ? `Letzter erfolgreicher Sync: ${formatDate(connection.last_success_at)}`
                    : adapter.availableFromPhase <= BUILT_UP_TO_PHASE
                      ? "Bereit zum Verbinden."
                      : `Wird in Phase ${adapter.availableFromPhase} gebaut.`}
                </p>
                {missing.length > 0 ? (
                  <p className="text-xs text-warning">Fehlende GitHub-Secrets: {missing.join(", ")}</p>
                ) : null}
                {connection?.last_error ? (
                  <p className="text-xs text-danger">{connection.last_error}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      <NintendoConnect onDone={refresh} />
      <NintendoImport userId={session.user.id} onDone={refresh} />

      <KeyGenerator />
    </>
  );
}
