"use client";

import { useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";
import { Logo } from "./Logo";
import { Button, Card, fieldClass, Notice } from "./ui";

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

  const field = fieldClass;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-5 pt-4">
    <div className="hero flex flex-col items-center gap-3 px-6 py-8 text-center">
      <Logo className="relative z-[1] h-20 w-20" />
      <h1 className="relative z-[1] font-display text-3xl font-extrabold tracking-tight">Game Bibliothek</h1>
      <p className="relative z-[1] text-sm text-white/85">Steam, PlayStation und Nintendo an einem Ort.</p>
    </div>
    <Card title="Anmelden" icon="user">
      <form onSubmit={onSubmit} className="flex flex-col gap-stack">
        <label className="flex flex-col gap-1 text-sm font-medium">
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
        <label className="flex flex-col gap-1 text-sm font-medium">
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
    </div>
  );
}
