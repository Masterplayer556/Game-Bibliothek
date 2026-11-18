"use client";

import { useState } from "react";
import { generateKey } from "@/core/crypto";

/**
 * Creates CREDENTIALS_ENCRYPTION_KEY in the browser. Nothing is sent or stored. Only needed to
 * set up the GitHub secret the first time, so it asks before making one: a new key in the
 * secret makes the stored logins unreadable.
 */
export function KeyGenerator() {
  const [key, setKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!key) return;
    await navigator.clipboard.writeText(key);
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-1.5 text-xs text-muted">
      <p>
        Schlüssel für <code className="font-mono">CREDENTIALS_ENCRYPTION_KEY</code>:{" "}
        <button
          type="button"
          className="link"
          onClick={() => {
            const sure = window.confirm(
              "Bist du sicher? Einen neuen Schlüssel brauchst du nur bei der ersten Einrichtung.\n\n" +
                "Trägst du ihn als CREDENTIALS_ENCRYPTION_KEY ein, sind die gespeicherten Anmeldungen " +
                "(PlayStation, Nintendo) nicht mehr lesbar und müssen neu verbunden werden.",
            );
            if (!sure) return;
            setKey(generateKey());
            setCopied(false);
          }}
        >
          {key ? "neu erzeugen" : "erzeugen"}
        </button>
        {key ? (
          <>
            {" · "}
            <button type="button" className="link" onClick={copy}>
              {copied ? "kopiert" : "kopieren"}
            </button>
          </>
        ) : null}
      </p>
      {key ? (
        <>
          <input
            readOnly
            value={key}
            aria-label="Erzeugter Schlüssel"
            className="rounded-control border border-border-strong bg-field px-2.5 py-1.5 font-mono text-xs text-text"
            onFocus={(e) => e.currentTarget.select()}
          />
          <p>
            Entsteht nur in deinem Browser. Nur für die erste Einrichtung: Ein neuer Schlüssel im
            Secret macht die gespeicherten Anmeldungen unlesbar.
          </p>
        </>
      ) : null}
    </div>
  );
}
