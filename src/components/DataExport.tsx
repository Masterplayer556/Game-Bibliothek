"use client";

import { useRef, useState } from "react";
import { backupFileName, libraryCsv } from "@/core/backup";
import type { LibraryGame } from "@/core/library";
import { loadBackup } from "@/lib/backup";
import { errorMessage } from "@/lib/errors";
import { deliverCard, type CardImage } from "@/lib/export-image";
import { getSupabase } from "@/lib/supabase";
import { Button, Notice } from "./ui";

/**
 * «Daten herunterladen»: everything as one JSON file (a backup), or the library as a table.
 * On the iPhone the share sheet opens («In Dateien sichern»); elsewhere the file downloads.
 */
export function DataExport({ games }: { games: readonly LibraryGame[] }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Safari shares only right after a tap: a file that took long to make waits for a second one.
  const [ready, setReady] = useState<CardImage | null>(null);
  const working = useRef(false);

  async function deliver(file: CardImage) {
    const result = await deliverCard(file);
    if (result === "needs-tap") {
      setReady(file);
      setStatus("Die Datei ist bereit: Tippe auf «Teilen».");
      return;
    }
    setReady(null);
    setStatus(result === "downloaded" ? `${file.fileName} heruntergeladen.` : `${file.fileName} bereit.`);
  }

  async function run(make: () => Promise<CardImage>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await deliver(await make());
    } catch (e) {
      setError(errorMessage(e));
    }
    working.current = false;
    setBusy(false);
  }

  const json = () =>
    run(async () => {
      setStatus("Lese alle Daten …");
      const now = new Date();
      const backup = await loadBackup(getSupabase(), now);
      const fileName = backupFileName(now, "json");
      return { fileName, file: new File([JSON.stringify(backup, null, 1)], fileName, { type: "application/json" }) };
    });
  const csv = () =>
    run(async () => {
      const fileName = backupFileName(new Date(), "csv", "spiele");
      return { fileName, file: new File([libraryCsv(games)], fileName, { type: "text/csv" }) };
    });

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="font-semibold">Daten herunterladen</p>
      <p className="text-xs text-muted">
        Eine Sicherung von allem, was die App speichert (Spiele, Spielzeit pro Tag, Erfolge, deine Angaben,
        Sync-Verlauf), als JSON-Datei. Anmeldedaten der Plattformen sind nicht dabei. Die Spieleliste gibt es
        auch als Tabelle (CSV) für Excel oder Numbers.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button icon="download" disabled={busy} onClick={json}>
          Sicherung (JSON)
        </Button>
        <Button icon="list" disabled={busy} onClick={csv}>
          Spieleliste (CSV)
        </Button>
        {ready ? (
          <Button variant="primary" onClick={() => void deliver(ready)}>
            Teilen
          </Button>
        ) : null}
      </div>
      {status ? <p className="text-xs text-muted" aria-live="polite">{status}</p> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </div>
  );
}
