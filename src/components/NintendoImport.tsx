"use client";

import { useState, type ChangeEvent } from "react";
import { combineImports, parseImportCsv, type ImportParseResult } from "@/core/nintendo/import";
import { toLocalDate } from "@/core/time";
import { importHistory } from "@/lib/nintendo";
import { getSupabase } from "@/lib/supabase";
import { Button, Card, Notice } from "./ui";
import { errorMessage } from "@/lib/errors";

const TEMPLATE_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/vorlagen/nintendo-import-vorlage.csv`;

interface ParsedFile {
  name: string;
  result: ImportParseResult;
}

/** «1 Spiel», «3 Spiele». */
function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function formatMinutes(minutes: number): string {
  return `${Math.floor(minutes / 60)} Std. ${minutes % 60} Min.`;
}

function countGames(result: ImportParseResult): number {
  return new Set(result.rows.map((r) => r.title.toLowerCase())).size;
}

function sumMinutes(result: ImportParseResult): number {
  return result.rows.reduce((sum, r) => sum + r.minutes, 0);
}

export function NintendoImport({ userId, onDone }: { userId: string; onDone: () => void }) {
  // Several files at once: each is read on its own, then joined into one import.
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosen = [...(event.target.files ?? [])];
    setMessage(null);
    if (chosen.length === 0) return;
    const today = toLocalDate(new Date());
    setFiles(await Promise.all(chosen.map(async (file) => ({ name: file.name, result: parseImportCsv(await file.text(), today) }))));
  }

  const parsed = files.length > 0 ? combineImports(files) : null;

  async function save() {
    if (!parsed) return;
    setBusy(true);
    setMessage(null);
    try {
      const summary = await importHistory(getSupabase(), userId, parsed.rows);
      const from = files.length === 1 ? "" : ` aus ${files.length} Dateien`;
      setMessage({ tone: "success", text: `${count(summary.dailyRows, "Tag", "Tage")}${from} importiert.` });
      setFiles([]);
      onDone();
    } catch (e) {
      setMessage({ tone: "danger", text: errorMessage(e) });
    }
    setBusy(false);
  }

  return (
    <Card title="Nintendo-Historie importieren" icon="download" tone="add" collapsible>
      <Notice>
        Für die Zeit vor der Jugendschutz-App: Übertrage die Tage aus der Nintendo-Store-App
        («Spielaktivitäten») in die{" "}
        <a className="link" href={TEMPLATE_URL} download>
          CSV-Vorlage
        </a>{" "}
        und lade sie hier hoch, auch mehrere Dateien auf einmal. Dieselbe Datei zweimal zu
        importieren ist unschädlich, ein Tag in mehreren Dateien zählt einmal, und Tage, die die
        Konsole selbst meldet, werden nie doppelt gezählt.
      </Notice>
      <input
        type="file"
        multiple
        accept=".csv,text/csv,text/plain"
        aria-label="CSV-Dateien auswählen"
        onChange={onFiles}
        className="text-sm file:mr-3 file:rounded-control file:border file:border-border-strong file:bg-surface file:px-3 file:py-2 file:text-text"
      />
      {parsed ? (
        <>
          {files.length > 1 ? (
            <ul className="flex flex-col gap-1 text-xs text-muted">
              {files.map((f, i) => (
                <li key={i}>
                  {f.name}: {count(f.result.rows.length, "Tag", "Tage")}, {count(countGames(f.result), "Spiel", "Spiele")}
                  {f.result.problems.length > 0 ? `, ${count(f.result.problems.length, "unlesbare Zeile", "unlesbare Zeilen")}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          <Notice>
            {files.length === 1 ? files[0]!.name : `Zusammen (${files.length} Dateien, doppelte Tage einmal)`}:{" "}
            {count(parsed.rows.length, "Tag", "Tage")}, {count(countGames(parsed), "Spiel", "Spiele")}, {formatMinutes(sumMinutes(parsed))}
          </Notice>
          {parsed.problems.length > 0 ? (
            <div>
              <Notice tone="warning">
                {parsed.problems.length === 1
                  ? "1 Zeile ist nicht lesbar und wird übersprungen:"
                  : `${parsed.problems.length} Zeilen sind nicht lesbar und werden übersprungen:`}
              </Notice>
              <ul className="list-disc pl-5 text-xs text-muted">
                {parsed.problems.slice(0, 8).map((p, i) => (
                  <li key={i}>
                    {files.length > 1 ? `${p.file}, ` : ""}Zeile {p.line}: {p.message}
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
