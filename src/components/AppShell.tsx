"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";
import { LibraryProvider } from "./LibraryProvider";
import { LoginForm } from "./LoginForm";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
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

/** The pages as index tabs standing on a rail, like the dividers of a card catalogue. */
function Nav() {
  const pathname = usePathname();
  const current = useRef<HTMLAnchorElement>(null);

  // On a phone the row scrolls sideways: keep the current tab in view.
  useEffect(() => {
    current.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <nav aria-label="Hauptnavigation" className="-mx-page overflow-x-auto px-page" style={{ scrollbarWidth: "none" }}>
      <ul className="flex min-w-max items-end gap-1 border-b-2 border-border-strong text-sm">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href.replace(/\/$/, ""));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                ref={active ? current : undefined}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap rounded-t-control border border-b-0 px-3 ${
                  active
                    ? "border-border-strong border-t-accent bg-surface pb-2 pt-1.5 font-semibold text-text shadow-[inset_0_2px_0_var(--color-accent)]"
                    : "border-border bg-surface-raised py-1.5 text-muted hover:bg-surface hover:text-text"
                }`}
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
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0">
            <Link href="/" className="flex items-center gap-2.5 rounded-control">
              <Logo className="h-10 w-10 shrink-0" />
              <span className="flex flex-wrap items-baseline gap-x-1.5 leading-none">
                <span className="font-pixel text-[1.7rem] uppercase tracking-wider text-accent">Game</span>
                <span className="font-display text-[1.7rem] font-semibold tracking-tight">Bibliothek</span>
              </span>
            </Link>
          </h1>
          <ThemeToggle />
        </div>
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
