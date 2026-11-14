"use client";

import { useEffect, useState } from "react";
import type { NintendoLoginRequest } from "@/core/nintendo/auth";
import { finishLogin, prepareLogin, type NintendoLoginResult } from "@/lib/nintendo";
import { getSupabase } from "@/lib/supabase";
import { Button, Card, Notice } from "./ui";
import { errorMessage } from "@/lib/errors";

const KIND_LABEL: Record<string, string> = { switch1: "Switch", switch2: "Switch 2", other: "Konsole" };

export function NintendoConnect({ onDone, title = "Nintendo verbinden" }: { onDone: () => void; title?: string }) {
  const [login, setLogin] = useState<NintendoLoginRequest | null>(null);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NintendoLoginResult | null>(null);

  useEffect(() => {
    let active = true;
    prepareLogin().then((request) => {
      if (active) setLogin(request);
    });
    return () => {
      active = false;
    };
  }, []);

  async function connect() {
    if (!login) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await finishLogin(getSupabase(), link, login));
      setLink("");
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      // A code works only once: prepare a fresh login for the next attempt.
      setLogin(await prepareLogin(true));
    }
    setBusy(false);
  }

  return (
    <Card title={title}>
      <Notice>
        Holt die Spielzeit pro Tag aus der Jugendschutz-App. Voraussetzung: Die Konsole ist in der
        App «Nintendo Switch Parental Controls» verknüpft.
      </Notice>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
        <li>
          {login ? (
            <a className="underline" href={login.url} target="_blank" rel="noopener noreferrer">
              Nintendo-Login öffnen
            </a>
          ) : (
            "Login wird vorbereitet …"
          )}{" "}
          und mit deinem Nintendo-Account anmelden.
        </li>
        <li>
          Beim roten Knopf «Dieses Konto auswählen» <strong>nicht tippen</strong>, sondern gedrückt
          halten und «Link kopieren» wählen.
        </li>
        <li>Hierher zurückkommen, den Link einfügen und «Verbinden» antippen.</li>
      </ol>
      <textarea
        className="min-h-20 rounded-control border border-border bg-surface-raised px-3 py-2 font-mono text-xs outline-none focus:border-accent"
        placeholder="npf54789befb391a838://auth#…"
        aria-label="Kopierter Link"
        value={link}
        onChange={(e) => setLink(e.target.value)}
      />
      <div>
        <Button variant="primary" disabled={busy || !login || link.trim() === ""} onClick={connect}>
          {busy ? "Verbinde …" : "Verbinden"}
        </Button>
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {result ? (
        <>
          <Notice tone="success">
            Nintendo ist verbunden. Der Token ist verschlüsselt gespeichert
            {result.expiresAt
              ? ` und gilt bis ${new Intl.DateTimeFormat("de-CH", { dateStyle: "medium" }).format(new Date(result.expiresAt))}.`
              : "."}
          </Notice>
          {result.devices === null ? (
            <Notice tone="warning">Die Liste der Konsolen konnte gerade nicht geladen werden. Der nächste Sync versucht es erneut.</Notice>
          ) : result.devices.length === 0 ? (
            <Notice tone="warning">
              Es ist noch keine Konsole mit der Jugendschutz-App verknüpft. Ohne Verknüpfung gibt es
              keine Daten.
            </Notice>
          ) : (
            <Notice>
              Gefundene Konsolen:{" "}
              {result.devices.map((d) => `${d.label} (${KIND_LABEL[d.kind] ?? d.kind})`).join(", ")}
            </Notice>
          )}
          <Notice>Die Spielzeiten kommen mit dem nächsten Sync (automatisch alle 6 Stunden oder sofort mit «Jetzt synchronisieren»).</Notice>
        </>
      ) : null}
    </Card>
  );
}
