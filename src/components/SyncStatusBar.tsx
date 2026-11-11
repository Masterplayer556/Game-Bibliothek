// One line per data source: is it connected, and how fresh is its data?
import Link from "next/link";
import { ADAPTER_CATALOG } from "@/core/adapter-catalog";
import { staleConnections, STALE_SYNC_HOURS, type ConnectionRow } from "@/core/library";
import { relativeAge } from "./game-ui";

const STATUS_TEXT: Record<string, string> = {
  ok: "verbunden",
  error: "Fehler",
  auth_expired: "Anmeldung abgelaufen",
  disabled: "ausgeschaltet",
  not_connected: "nicht verbunden",
};

export function SyncStatusBar({ connections, now }: { connections: ConnectionRow[]; now: Date }) {
  const stale = staleConnections(connections, now);
  const connected = ADAPTER_CATALOG.map((a) => ({ adapter: a, row: connections.find((c) => c.adapter_id === a.id) })).filter(
    ({ row, adapter }) => row && row.status !== "not_connected" && adapter.credentialSource !== "none",
  );

  return (
    <section aria-label="Status der Plattformen" className="flex flex-col gap-2">
      {stale.length > 0 ? (
        <p className="rounded-control border border-warning px-3 py-2 text-sm text-warning">
          ⚠ Seit über {STALE_SYNC_HOURS} Stunden kein erfolgreicher Sync für{" "}
          {stale.map((c) => ADAPTER_CATALOG.find((a) => a.id === c.adapter_id)?.displayName ?? c.adapter_id).join(", ")}.
          Prüfe unter <Link className="underline" href="/plattformen/">Plattformen</Link>, ob der automatische Sync noch läuft.
        </p>
      ) : null}
      {connected.length > 0 ? (
        <ul className="flex flex-wrap gap-2 text-xs">
          {connected.map(({ adapter, row }) => (
            <li key={adapter.id} className="rounded-control bg-surface-raised px-2 py-1 text-muted">
              <span className={row!.status === "ok" ? "text-success" : "text-danger"} aria-hidden>
                ●{" "}
              </span>
              {adapter.displayName}: {row!.status === "ok" ? `aktualisiert ${relativeAge(row!.last_success_at, now)}` : STATUS_TEXT[row!.status]}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
