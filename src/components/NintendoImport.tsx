"use client";

import { useState, type ChangeEvent } from "react";
import { parseImportCsv, type ImportParseResult } from "@/core/nintendo/import";
import { toLocalDate } from "@/core/time";
import { importHistory } from "@/lib/nintendo";
import { getSupabase } from "@/lib/supabase";
import { Button, Card, Notice } from "./ui";
import { errorMessage } from "@/lib/errors";

const TEMPLATE_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/vorlagen/nintendo-import-vorlage.csv`;

export function NintendoImport({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [parsed, setParsed] = useState<ImportParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setMessage(null);
    if (!file) return;
    setFileName(file.name);
    setParsed(parseImportCsv(await file.text(), toLocalDate(new Date())));
  }

  async function save() {
    if (!parsed) return;
    setBusy(true);
    setMessage(null);
    try {
      const summary = await importHistory(getSupabase(), userId, parsed.rows);
      setMessage({ tone: "success", text: `${summary.dailyRows} Tage importiert.` });
      setParsed(null);
      onDone();
    } catch (e) {
      setMessage({ tone: "danger", text: errorMessage(e) });
    }
    setBusy(false);
  }

  const games = parsed ? new Set(parsed.rows.map((r) => r.title.toLowerCase())).size : 0;
  const minutes = parsed ? parsed.rows.reduce((sum, r) => sum + r.minutes, 0) : 0;

  return (
    <Card title="Nintendo-Historie importieren">
      <Notice>
        Für die Zeit vor der Jugendschutz-App: Übertrage die Tage aus der Nintendo-Store-App
        («Spielaktivitäten») in die{" "}
        <a className="underline" href={TEMPLATE_URL} download>
          CSV-Vorlage
        </a>{" "}
        und lade sie hier hoch. Dieselbe Datei zweimal zu importieren ist unschädlich, und Tage, die
        die Konsole selbst meldet, werden nie doppelt gezählt.
      </Notice>
      <input
        type="file"
        accept=".csv,text/csv,text/plain"
        aria-label="CSV-Datei auswählen"
        onChange={onFile}
        className="text-sm file:mr-3 file:rounded-control file:border file:border-border file:bg-surface-raised file:px-3 file:py-2 file:text-text"
      />
      {parsed ? (
        <>
          <Notice>
            {fileName}: {parsed.rows.length} Tage, {games} Spiele, zusammen {Math.floor(minutes / 60)} Std.{" "}
            {minutes % 60} Min.
          </Notice>
          {parsed.problems.length > 0 ? (
            <div>
              <Notice tone="warning">
                {parsed.problems.length} Zeilen sind nicht lesbar und werden übersprungen:
              </Notice>
              <ul className="list-disc pl-5 text-xs text-muted">
                {parsed.problems.slice(0, 8).map((p) => (
                  <li key={p.line}>
                    Zeile {p.line}: {p.message}
                  </li>
                ))}
                {parsed.problems.length > 8 ? <li>… und {parsed.problems.length - 8} weitere</li> : null}
              </ul>
            </div>
          ) : null}
          <div>
            <Button variant="primary" disabled={busy || parsed.rows.length === 0} onClick={save}>
              {busy ? "Importiere …" : "Importieren"}
            </Button>
          </div>
        </>
      ) : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </Card>
  );
}
