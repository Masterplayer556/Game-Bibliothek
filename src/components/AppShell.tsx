"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";
import { LibraryProvider } from "./LibraryProvider";
import { LoginForm } from "./LoginForm";
import { Logo } from "./Logo";
import { PixelIcon, type PixelIconName } from "./PixelIcon";
import { ThemeToggle } from "./ThemeToggle";
import { Card, Notice } from "./ui";

// Every section has its own colour (tokens --color-section-*) and icon.
const NAV: { href: string; label: string; section: string; icon: PixelIconName }[] = [
  { href: "/", label: "Übersicht", section: "home", icon: "home" },
  { href: "/bibliothek/", label: "Bibliothek", section: "library", icon: "book" },
  { href: "/statistiken/", label: "Statistiken", section: "stats", icon: "chart" },
  { href: "/pile-of-shame/", label: "Pile of Shame", section: "pile", icon: "pile" },
  { href: "/erfolge/", label: "Erfolge", section: "achievements", icon: "trophy" },
  { href: "/rueckblick/", label: "Rückblick", section: "review", icon: "star" },
  { href: "/hinzufuegen/", label: "Hinzufügen", section: "add", icon: "plus" },
  { href: "/plattformen/", label: "Plattformen", section: "platforms", icon: "gamepad" },
];

function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, ""));
}

function sectionVar(section: string): CSSProperties {
  return { "--section": `var(--color-section-${section})` } as CSSProperties;
}

/** The section a page belongs to; a game page belongs to the library. */
function sectionOf(pathname: string): string {
  if (pathname.startsWith("/spiel")) return "library";
  return NAV.find((item) => isActive(item.href, pathname))?.section ?? "home";
}

// A row of book spines for the foot of the page: [height in px, colour token].
const FOOT_SPINES: [number, string][] = [
  [22, "cloth-1"], [28, "section-library"], [18, "cloth-3"], [26, "cloth-5"], [30, "section-achievements"], [20, "cloth-2"],
  [24, "section-stats"], [29, "cloth-4"], [17, "section-pile"], [25, "cloth-1"], [21, "section-review"], [30, "cloth-3"],
  [19, "section-platforms"], [27, "cloth-2"], [23, "section-add"], [29, "cloth-5"], [18, "section-home"], [25, "cloth-4"],
  [28, "cloth-1"], [20, "section-library"], [26, "cloth-3"], [30, "section-stats"], [22, "cloth-2"], [17, "section-achievements"],
  [27, "cloth-5"], [24, "section-review"], [29, "cloth-4"], [19, "section-pile"], [25, "cloth-1"], [28, "section-platforms"],
];

function Foot() {
  return (
    <footer className="mt-4 flex flex-col items-center gap-2 pb-2">
      <div aria-hidden className="flex w-full flex-col items-center">
        <div className="flex items-end gap-[3px] overflow-hidden px-3">
          {FOOT_SPINES.map(([height, color], i) => (
            <span key={i} className="w-2.5 shrink-0 rounded-t-[2px]" style={{ height, background: `var(--color-${color})` }} />
          ))}
        </div>
        <div className="h-1.5 w-full max-w-md rounded-[2px] bg-shelf shadow-[inset_0_2px_0_var(--color-shelf-edge)]" />
      </div>
      <p className="text-center text-xs text-muted">
        <span className="font-pixel text-sm uppercase tracking-wider">Game</span>{" "}
        <span className="font-display font-semibold">Bibliothek</span> · alle Spiele in einem Regal
      </p>
    </footer>
  );
}

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
      <ul className="flex min-w-max items-end gap-0.5 border-b-2 border-border-strong text-sm">
        {NAV.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <li key={item.href} style={sectionVar(item.section)}>
              <Link
                href={item.href}
                ref={active ? current : undefined}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-t-control border border-b-0 px-2 ${
                  active
                    ? "border-border-strong bg-surface pb-2 pt-2 font-semibold text-text shadow-[inset_0_3px_0_var(--section)]"
                    : "border-border bg-surface-raised py-1.5 text-muted shadow-[inset_0_2px_0_var(--section)] hover:bg-surface hover:text-text"
                }`}
              >
                <PixelIcon name={item.icon} className={`h-3.5 w-3.5 ${active ? "text-section" : "text-section opacity-70"}`} />
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
  const pathname = usePathname();

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-page p-page" style={sectionVar(sectionOf(pathname))}>
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
      <Foot />
    </div>
  );
}
