"use client";

import { useState } from "react";
import { formatDateTime, formatDay, relativeAge } from "@/components/game-ui";
import { KeyGenerator } from "@/components/KeyGenerator";
import { LibraryGate } from "@/components/LibraryGate";
import { useLibraryContext } from "@/components/LibraryProvider";
import { NintendoConnect } from "@/components/NintendoConnect";
import { NintendoImport } from "@/components/NintendoImport";
import { Button, Card, Notice } from "@/components/ui";
import { ADAPTER_CATALOG, type AdapterInfo } from "@/core/adapter-catalog";
import type { ConnectionRow } from "@/core/library";
import { DEMO_SOURCE, type ConnectionStatus } from "@/core/types";
import { loadDemoData, removeDemoData } from "@/lib/library-data";
import { guideUrl, workflowUrl } from "@/lib/links";
import { getSupabase } from "@/lib/supabase";

/** Adapters up to this phase exist. */
const BUILT_UP_TO_PHASE = 5;

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  not_connected: "Noch nicht verbunden",
  ok: "Verbunden",
  error: "Fehler",
  auth_expired: "Anmeldung abgelaufen",
  disabled: "Ausgeschaltet",
};

const STATUS_TONE: Record<ConnectionStatus, string> = {
  not_connected: "text-muted",
  ok: "text-success",
  error: "text-danger",
  auth_expired: "text-warning",
  disabled: "text-muted",
};

function AdapterCard({ adapter, row, now }: { adapter: AdapterInfo; row: ConnectionRow | undefined; now: Date }) {
  const status = row?.status ?? "not_connected";
  const details = (row?.details ?? {}) as { missingEnv?: string[]; warnings?: string[] };
  const built = adapter.availableFromPhase <= BUILT_UP_TO_PHASE;
  return (
    <li className="flex flex-col gap-1 rounded-control bg-surface-raised p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{adapter.displayName}</span>
        <span className={STATUS_TONE[status]}>{STATUS_LABEL[status]}</span>
      </div>
      {!built ? (
        <p className="text-xs text-muted">Wird in Phase {adapter.availableFromPhase} gebaut.</p>
      ) : row && status !== "not_connected" ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-xs text-muted">
          <dt>Letzter Erfolg</dt>
          <dd title={formatDateTime(row.last_success_at)}>{relativeAge(row.last_success_at, now)}</dd>
          {row.data_since ? (
            <>
              <dt>Daten ab</dt>
              <dd>{formatDay(row.data_since)}</dd>
            </>
          ) : null}
          {row.token_expires_at ? (
            <>
              <dt>Anmeldung gültig bis</dt>
              <dd>{formatDay(row.token_expires_at)}</dd>
            </>
          ) : null}
        </dl>
      ) : (
        <p className="text-xs text-muted">
          {adapter.credentialSource === "env"
            ? "Wird über GitHub-Secrets eingerichtet."
            : adapter.credentialSource === "none"
              ? "Keine Anmeldung nötig."
              : "Anmeldung hier in der App."}
        </p>
      )}
      {details.missingEnv && details.missingEnv.length > 0 ? (
        <p className="text-xs text-warning">Fehlende GitHub-Secrets: {details.missingEnv.join(", ")}</p>
      ) : null}
      {details.warnings && details.warnings.length > 0 ? (
        <p className="text-xs text-warning">Hinweis: {details.warnings.join(", ")}</p>
      ) : null}
      {row?.last_error ? <p className="text-xs text-danger">{row.last_error}</p> : null}
      {status === "auth_expired" && adapter.platform === "nintendo" ? (
        <p className="text-xs text-warning">Nintendo neu anmelden: Karte «Nintendo verbinden» weiter unten.</p>
      ) : null}
      {status === "auth_expired" && adapter.platform === "psn" ? (
        <p className="text-xs text-warning">Neue NPSSO nötig (siehe Anleitung).</p>
      ) : null}
      <a className="text-xs underline" href={guideUrl(adapter.guide)} target="_blank" rel="noopener noreferrer">
        Anleitung
      </a>
    </li>
  );
}

function DemoData({ demoEntries }: { demoEntries: number }) {
  const { session, reload } = useLibraryContext();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await action();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    }
    setBusy(null);
  }

  return (
    <Card title="Demo-Daten">
      <Notice>
        Deine Spieleliste mit erfundenen Spielzeiten der letzten 14 Monate. Lässt sich jederzeit
        komplett entfernen; echte Daten bleiben unberührt. Aktuell {demoEntries} Demo-Einträge.
      </Notice>
      <div className="flex flex-wrap gap-stack">
        <Button variant="primary" disabled={busy !== null} onClick={() => run("load", () => loadDemoData(getSupabase(), session.user.id))}>
          {busy === "load" ? "Lade Demo-Daten …" : demoEntries > 0 ? "Demo-Daten neu laden" : "Demo-Daten laden"}
        </Button>
        <Button
          disabled={busy !== null || demoEntries === 0}
          onClick={() => {
            if (window.confirm("Alle Demo-Daten löschen?")) void run("remove", () => removeDemoData(getSupabase()));
          }}
        >
          {busy === "remove" ? "Lösche …" : "Demo-Daten löschen"}
        </Button>
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Card>
  );
}

export default function PlatformsPage() {
  return (
    <LibraryGate>
      {({ raw, reload, userId }) => {
        const now = new Date();
        const nintendo = raw.connections.find((c) => c.adapter_id === "nintendo-parental");
        const demoEntries = raw.platformGames.filter((p) => p.source === DEMO_SOURCE).length;
        return (
          <>
            <Card title="Quellen">
              <ul className="flex flex-col gap-stack">
                {ADAPTER_CATALOG.map((a) => (
                  <AdapterCard key={a.id} adapter={a} row={raw.connections.find((c) => c.adapter_id === a.id)} now={now} />
                ))}
                <li className="flex flex-col gap-1 rounded-control bg-surface-raised p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">IGDB (Cover und Genres)</span>
                    <span className="text-muted">Noch nicht verbunden</span>
                  </div>
                  <p className="text-xs text-muted">Wird in Phase 7 gebaut.</p>
                </li>
              </ul>
            </Card>

            <Card title="Synchronisieren">
              <Notice>
                Der Sync läuft automatisch alle 6 Stunden. Sofort syncen oder eine Verbindung testen geht
                bis Phase 8 über GitHub: Workflow «Sync» → «Run workflow» (Modus «test» prüft nur die
                Verbindung). Das Ergebnis erscheint nach etwa einer Minute hier.
              </Notice>
              <div className="flex flex-wrap gap-stack">
                <a className="rounded-control bg-accent px-4 py-2 text-sm font-medium text-on-accent" href={workflowUrl("sync.yml")} target="_blank" rel="noopener noreferrer">
                  Sync auf GitHub öffnen
                </a>
                <Button onClick={() => void reload()}>Status neu laden</Button>
              </div>
            </Card>

            <NintendoConnect onDone={() => void reload()} title={nintendo?.status === "ok" ? "Nintendo neu anmelden" : "Nintendo verbinden"} />
            <NintendoImport userId={userId} onDone={() => void reload()} />
            <DemoData demoEntries={demoEntries} />
            <KeyGenerator />
            <Card title="Konto">
              <Button onClick={() => getSupabase().auth.signOut()}>Abmelden</Button>
            </Card>
          </>
        );
      }}
    </LibraryGate>
  );
}
