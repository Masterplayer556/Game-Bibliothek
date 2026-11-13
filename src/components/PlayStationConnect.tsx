"use client";

import { useState } from "react";
import { saveCredential } from "@/lib/credentials";
import { guideUrl, workflowUrl } from "@/lib/links";
import { getSupabase } from "@/lib/supabase";
import { Button, Card, fieldClass, Notice } from "./ui";

export function PlayStationConnect({ title, onDone }: { title: string; onDone: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveCredential(getSupabase(), "psn", "npsso", value);
      setValue("");
      setSaved(true);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    }
    setBusy(false);
  }

  return (
    <Card title={title}>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
        <li>
          Im Browser auf{" "}
          <a className="underline" href="https://www.playstation.com/" target="_blank" rel="noopener noreferrer">
            playstation.com
          </a>{" "}
          mit deinem PlayStation-Konto anmelden.
        </li>
        <li>
          Im <strong>gleichen Browser</strong>{" "}
          <a className="underline" href="https://ca.account.sony.com/api/v1/ssocookie" target="_blank" rel="noopener noreferrer">
            diese Seite öffnen
          </a>
          .
        </li>
        <li>Den 64-stelligen Wert bei «npsso» kopieren (oder einfach die ganze Zeile) und hier einfügen.</li>
      </ol>
      <input
        type="password"
        autoComplete="off"
        className={`${fieldClass} font-mono`}
        placeholder="NPSSO"
        aria-label="NPSSO"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div>
        <Button variant="primary" disabled={busy || value.trim() === ""} onClick={save}>
          {busy ? "Speichere …" : "Speichern"}
        </Button>
      </div>
      <Notice>
        Die NPSSO ist wie ein Passwort. Sie wird verschlüsselt gespeichert, beim nächsten Sync gegen
        eine Anmeldung getauscht und danach gelöscht. Etwa alle zwei Monate braucht es eine neue.{" "}
        <a className="underline" href={guideUrl("SETUP-PLAYSTATION.md")} target="_blank" rel="noopener noreferrer">
          Anleitung
        </a>
      </Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {saved ? (
        <Notice tone="success">
          Gespeichert. Jetzt den{" "}
          <a className="underline" href={workflowUrl("sync.yml")} target="_blank" rel="noopener noreferrer">
            Sync
          </a>{" "}
          starten (Modus «test» prüft nur die Anmeldung). Das Ergebnis steht nach etwa einer Minute oben
          bei «PlayStation».
        </Notice>
      ) : null}
    </Card>
  );
}
