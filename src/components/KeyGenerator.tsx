"use client";

import { useState } from "react";
import { generateKey } from "@/core/crypto";

/**
 * Creates CREDENTIALS_ENCRYPTION_KEY in the browser. Nothing is sent or stored. Rarely needed
 * (only to set up or replace the GitHub secret), so it is one small line.
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
          <p>Entsteht nur in deinem Browser. Sicher aufbewahren: Ohne ihn sind gespeicherte Tokens nicht mehr lesbar.</p>
        </>
      ) : null}
    </div>
  );
}
