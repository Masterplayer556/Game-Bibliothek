"use client";

import { useState } from "react";
import { generateKey } from "@/core/crypto";
import { Button, Card, Notice } from "./ui";

/** Creates CREDENTIALS_ENCRYPTION_KEY in the browser. Nothing is sent or stored. */
export function KeyGenerator() {
  const [key, setKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!key) return;
    await navigator.clipboard.writeText(key);
    setCopied(true);
  }

  return (
    <Card title="Schlüssel für die Verschlüsselung">
      <Notice>
        Für das GitHub-Secret <code className="font-mono">CREDENTIALS_ENCRYPTION_KEY</code>. Der
        Schlüssel entsteht nur in deinem Browser und wird nirgends gespeichert. Bewahre ihn sicher
        auf: Ohne ihn sind gespeicherte Plattform-Tokens nicht mehr lesbar.
      </Notice>
      <div className="flex flex-wrap gap-stack">
        <Button
          onClick={() => {
            setKey(generateKey());
            setCopied(false);
          }}
        >
          Schlüssel erzeugen
        </Button>
        {key ? <Button onClick={copy}>{copied ? "Kopiert" : "Kopieren"}</Button> : null}
      </div>
      {key ? (
        <input
          readOnly
          value={key}
          aria-label="Erzeugter Schlüssel"
          className="rounded-control border border-border bg-surface-raised px-3 py-2 font-mono text-sm"
          onFocus={(e) => e.currentTarget.select()}
        />
      ) : null}
    </Card>
  );
}
