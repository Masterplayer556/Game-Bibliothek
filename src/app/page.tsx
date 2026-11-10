"use client";

import { Dashboard } from "@/components/Dashboard";
import { LoginForm } from "@/components/LoginForm";
import { Card, Notice } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";

export default function HomePage() {
  const session = useSession();

  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-page p-page">
      <header>
        <h1 className="text-2xl font-bold">Game Bibliothek</h1>
        <p className="text-sm text-muted">Grundgerüst: Login und Datenbank.</p>
      </header>

      {!isSupabaseConfigured ? (
        <Card title="Noch nicht eingerichtet">
          <Notice tone="warning">
            Die App kennt noch kein Supabase-Projekt. Trage die beiden Build-Variablen
            <code className="font-mono"> NEXT_PUBLIC_SUPABASE_URL</code> und
            <code className="font-mono"> NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> ein.
          </Notice>
          <Notice>Die Schritte stehen in der Anleitung «SETUP-SUPABASE-GITHUB» im Ordner docs.</Notice>
        </Card>
      ) : session === undefined ? (
        <Notice>Lade …</Notice>
      ) : session === null ? (
        <LoginForm />
      ) : (
        <Dashboard session={session} />
      )}
    </main>
  );
}
