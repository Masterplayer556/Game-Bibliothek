"use client";

import { formatDateTime, formatDay, relativeAge } from "@/components/game-ui";
import { KeyGenerator } from "@/components/KeyGenerator";
import { LibraryGate } from "@/components/LibraryGate";
import { NintendoConnect } from "@/components/NintendoConnect";
import { NintendoImport } from "@/components/NintendoImport";
import { PlayStationConnect } from "@/components/PlayStationConnect";
import { SyncControls } from "@/components/SyncControls";
import { Button, Card } from "@/components/ui";
import { ADAPTER_CATALOG, type AdapterInfo } from "@/core/adapter-catalog";
import type { ConnectionRow } from "@/core/library";
import type { ConnectionStatus } from "@/core/types";
import { guideUrl } from "@/lib/links";
import { getSupabase } from "@/lib/supabase";

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
  const details = (row?.details ?? {}) as { missingEnv?: string[]; warnings?: string[]; npssoSavedAt?: string };
  return (
    <li className="flex flex-col gap-1.5 rounded-2xl border border-border bg-section-soft p-3.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-display text-base font-bold">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--color-platform-${adapter.platform})` }} />
          {adapter.displayName}
        </span>
        <span className={`chip !font-bold ${STATUS_TONE[status]}`}>
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
          {STATUS_LABEL[status]}
        </span>
      </div>
      {row && status !== "not_connected" ? (
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
      {details.npssoSavedAt && status === "not_connected" ? (
        <p className="text-xs text-warning">NPSSO gespeichert: Sie wird beim nächsten Sync geprüft.</p>
      ) : null}
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
        <p className="text-xs text-warning">Neue NPSSO nötig: Karte «PlayStation verbinden» weiter unten.</p>
      ) : null}
      <a className="link text-xs" href={guideUrl(adapter.guide)} target="_blank" rel="noopener noreferrer">
        Anleitung
      </a>
    </li>
  );
}

export default function PlatformsPage() {
  return (
    <LibraryGate>
      {({ raw, reload, userId }) => {
        const now = new Date();
        const nintendo = raw.connections.find((c) => c.adapter_id === "nintendo-parental");
        const psn = raw.connections.find((c) => c.adapter_id === "psn");
        return (
          <>
            <Card title="Quellen" icon="gamepad">
              <ul className="flex flex-col gap-stack">
                {ADAPTER_CATALOG.map((a) => (
                  <AdapterCard key={a.id} adapter={a} row={raw.connections.find((c) => c.adapter_id === a.id)} now={now} />
                ))}
                <AdapterCard
                  adapter={{
                    id: "igdb",
                    platform: "manual",
                    displayName: "IGDB (Cover und Genres)",
                    capabilities: { library: false, totalPlaytime: false, dailyPlaytime: false, achievements: false },
                    credentialSource: "env",
                    requiredEnv: ["IGDB_CLIENT_ID", "IGDB_CLIENT_SECRET"],
                    guide: "SETUP-IGDB.md",
                  }}
                  row={raw.connections.find((c) => c.adapter_id === "igdb")}
                  now={now}
                />
              </ul>
            </Card>

            <SyncControls onFinished={() => void reload()} />

            {/* Open by themselves only when something needs doing (never connected or expired). */}
            <PlayStationConnect
              title={psn?.status === "ok" ? "PlayStation neu anmelden" : "PlayStation verbinden"}
              defaultOpen={psn?.status !== "ok"}
              onDone={() => void reload()}
            />
            <NintendoConnect
              title={nintendo?.status === "ok" ? "Nintendo neu anmelden" : "Nintendo verbinden"}
              defaultOpen={nintendo?.status !== "ok"}
              onDone={() => void reload()}
            />
            <NintendoImport userId={userId} onDone={() => void reload()} />
            <Card title="Konto" icon="user" tone="home">
              <div>
                <Button onClick={() => getSupabase().auth.signOut()}>Abmelden</Button>
              </div>
              <KeyGenerator />
            </Card>
          </>
        );
      }}
    </LibraryGate>
  );
}
