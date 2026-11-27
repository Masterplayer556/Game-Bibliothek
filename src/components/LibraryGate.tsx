"use client";

import { useState, type ReactNode } from "react";
import type { Library, RawData } from "@/core/library";
import type { RawPart } from "@/lib/library-data";
import { formatDateTime } from "./game-ui";
import { useLibraryContext } from "./LibraryProvider";
import { Button, Card, Notice } from "./ui";

/** «Nochmals»: loads the data again, disabled while it runs. */
function RetryButton({ reload }: { reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      icon="sync"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await reload();
        setBusy(false);
      }}
    >
      {busy ? "Lädt …" : "Nochmals"}
    </Button>
  );
}

/**
 * Shows loading and error states; renders children once the library is there. If loading again
 * fails, the last data stays on screen with a note and «Nochmals».
 */
export function LibraryGate({
  children,
}: {
  children: (ctx: { library: Library; raw: RawData; reload: (parts?: readonly RawPart[]) => Promise<void>; userId: string }) => ReactNode;
}) {
  const { library, raw, error, reload, session, cachedAt } = useLibraryContext();
  if (error && !library) {
    return (
      <Card title="Daten nicht verfügbar" icon="warning">
        <Notice tone="danger">Die Datenbank antwortet mit einem Fehler: {error}</Notice>
        <div>
          <RetryButton reload={() => reload()} />
        </div>
      </Card>
    );
  }
  if (!library || !raw) return <Notice>Lade …</Notice>;
  return (
    <>
      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border bg-surface-raised p-3">
          <Notice tone="warning">
            {cachedAt
              ? `Keine Verbindung zur Datenbank. Angezeigt wird der gespeicherte Stand vom ${formatDateTime(cachedAt)}.`
              : `Neu laden fehlgeschlagen (${error}). Angezeigt wird der letzte Stand.`}
          </Notice>
          <RetryButton reload={() => reload()} />
        </div>
      ) : cachedAt ? (
        <p className="text-xs text-muted" aria-live="polite">
          Stand vom {formatDateTime(cachedAt)} · wird aktualisiert …
        </p>
      ) : null}
      {children({ library, raw, reload, userId: session.user.id })}
    </>
  );
}
