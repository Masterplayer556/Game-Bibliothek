"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { gameHref } from "@/components/game-ui";
import { useLibraryContext } from "@/components/LibraryProvider";
import { Button, Card, fieldClass, Notice } from "@/components/ui";
import { DEVICE_LABEL, MANUAL_DEVICE_KINDS } from "@/core/labels";
import type { DeviceKind } from "@/core/types";
import { addManualGame } from "@/lib/library-data";
import { getSupabase } from "@/lib/supabase";

export default function AddGamePage() {
  const router = useRouter();
  const { session, reload } = useLibraryContext();
  const [title, setTitle] = useState("");
  const [deviceKind, setDeviceKind] = useState<DeviceKind>("xbox360");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [owned, setOwned] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const h = hours.trim() === "" ? 0 : Number(hours);
    const m = minutes.trim() === "" ? 0 : Number(minutes);
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0) {
      setError("Bitte die Spielzeit als Zahl eingeben.");
      return;
    }
    const total = hours.trim() === "" && minutes.trim() === "" ? null : Math.round(h * 60 + m);
    setBusy(true);
    setError(null);
    try {
      const id = await addManualGame(getSupabase(), session.user.id, { title, deviceKind, minutes: total, owned });
      await reload();
      router.push(gameHref(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      setBusy(false);
    }
  }

  return (
    <Card title="Spiel von Hand hinzufügen">
      <Notice>
        Für Spiele ohne Schnittstelle, z. B. Disc-Spiele oder ältere Konsolen. Gibt es das Spiel schon
        auf einer anderen Plattform, wird es automatisch über den Titel zugeordnet. Die Suche über IGDB
        kommt in Phase 7.
      </Notice>
      <form onSubmit={onSubmit} className="flex flex-col gap-stack">
        <label className="flex flex-col gap-1 text-sm">
          Titel
          <input className={fieldClass} required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          System
          <select className={fieldClass} value={deviceKind} onChange={(e) => setDeviceKind(e.target.value as DeviceKind)}>
            {MANUAL_DEVICE_KINDS.map((k) => (
              <option key={k} value={k}>{k === "other" ? "Anderes" : DEVICE_LABEL[k]}</option>
            ))}
          </select>
        </label>
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend>Bisherige Spielzeit (optional)</legend>
          <div className="flex gap-2">
            <input className={`${fieldClass} w-24`} inputMode="numeric" placeholder="Std." aria-label="Stunden" value={hours} onChange={(e) => setHours(e.target.value)} />
            <input className={`${fieldClass} w-24`} inputMode="numeric" placeholder="Min." aria-label="Minuten" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </div>
          <span className="text-xs text-muted">Zählt zur Gesamtspielzeit, aber nicht als «heute gespielt».</span>
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={owned} onChange={(e) => setOwned(e.target.checked)} />
          Noch im Besitz
        </label>
        <div>
          <Button type="submit" variant="primary" disabled={busy || title.trim() === ""}>
            {busy ? "Speichere …" : "Hinzufügen"}
          </Button>
        </div>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </form>
    </Card>
  );
}
