"use client";

import { useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";
import { Button, Card, Notice } from "./ui";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) setError("Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.");
    setBusy(false);
  }

  const field =
    "rounded-control border border-border bg-surface-raised px-3 py-2 text-text outline-none focus:border-accent";

  return (
    <Card title="Anmelden">
      <form onSubmit={onSubmit} className="flex flex-col gap-stack">
        <label className="flex flex-col gap-1 text-sm">
          E-Mail
          <input
            className={field}
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Passwort
          <input
            className={field}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Anmelden …" : "Anmelden"}
        </Button>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </form>
    </Card>
  );
}
