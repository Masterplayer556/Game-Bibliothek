"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";
import { LibraryProvider } from "./LibraryProvider";
import { LoginForm } from "./LoginForm";
import { Card, Notice } from "./ui";

const NAV = [
  { href: "/", label: "Übersicht" },
  { href: "/bibliothek/", label: "Bibliothek" },
  { href: "/statistiken/", label: "Statistiken" },
  { href: "/pile-of-shame/", label: "Pile of Shame" },
  { href: "/erfolge/", label: "Erfolge" },
  { href: "/rueckblick/", label: "Rückblick" },
  { href: "/hinzufuegen/", label: "Hinzufügen" },
  { href: "/plattformen/", label: "Plattformen" },
];

function Nav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Hauptnavigation" className="-mx-page overflow-x-auto px-page">
      <ul className="flex gap-2 whitespace-nowrap text-sm">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href.replace(/\/$/, ""));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-control px-3 py-2 ${active ? "bg-accent text-on-accent" : "bg-surface-raised text-text"}`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-page p-page">
      <header className="flex flex-col gap-stack">
        <h1 className="text-2xl font-bold">Game Bibliothek</h1>
        {session ? <Nav /> : null}
      </header>

      {!isSupabaseConfigured ? (
        <Card title="Noch nicht eingerichtet">
          <Notice tone="warning">
            Die App kennt noch kein Supabase-Projekt. Die Schritte stehen in der Anleitung
            «SETUP-SUPABASE-GITHUB» im Ordner docs.
          </Notice>
        </Card>
      ) : session === undefined ? (
        <Notice>Lade …</Notice>
      ) : session === null ? (
        <LoginForm />
      ) : (
        <LibraryProvider session={session}>
          <main className="flex flex-col gap-page">{children}</main>
        </LibraryProvider>
      )}
    </div>
  );
}
