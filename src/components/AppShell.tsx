"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";
import { LibraryProvider } from "./LibraryProvider";
import { LoginForm } from "./LoginForm";
import { Logo } from "./Logo";
import { PixelIcon, type PixelIconName } from "./PixelIcon";
import { ThemeToggle } from "./ThemeToggle";
import { Card, Notice } from "./ui";

interface NavItem {
  href: string;
  label: string;
  /** Short line under the page title. */
  tagline: string;
  section: string;
  icon: PixelIconName;
  /** In the bar on a phone; the others sit behind «Mehr». */
  primary: boolean;
}

// Every section has its own colour (tokens --color-section-*) and icon.
const NAV: NavItem[] = [
  { href: "/", label: "Übersicht", tagline: "Was zuletzt lief", section: "home", icon: "home", primary: true },
  { href: "/bibliothek/", label: "Bibliothek", tagline: "Alle Spiele im Regal", section: "library", icon: "book", primary: true },
  { href: "/statistiken/", label: "Statistiken", tagline: "Spielzeit in Zahlen", section: "stats", icon: "chart", primary: true },
  { href: "/erfolge/", label: "Erfolge", tagline: "Erfolge und Trophäen", section: "achievements", icon: "trophy", primary: true },
  { href: "/pile-of-shame/", label: "Pile of Shame", tagline: "Gekauft, aber kaum gespielt", section: "pile", icon: "pile", primary: false },
  { href: "/rueckblick/", label: "Rückblick", tagline: "Dein Jahr als Karten", section: "review", icon: "star", primary: false },
  { href: "/hinzufuegen/", label: "Hinzufügen", tagline: "Ein Spiel von Hand eintragen", section: "add", icon: "plus", primary: false },
  { href: "/plattformen/", label: "Plattformen", tagline: "Quellen und Sync", section: "platforms", icon: "gamepad", primary: false },
];

function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, ""));
}

function sectionVar(section: string): CSSProperties {
  return { "--section": `var(--color-section-${section})` } as CSSProperties;
}

/** The page's entry in the navigation; a game page belongs to the library. */
function currentItem(pathname: string): NavItem {
  if (pathname.startsWith("/spiel")) return NAV[1]!;
  return NAV.find((item) => isActive(item.href, pathname)) ?? NAV[0]!;
}

/** The large title at the top of a page, as in a phone app. A game page gets a back button instead. */
function PageTitle({ pathname }: { pathname: string }) {
  const router = useRouter();
  if (pathname.startsWith("/spiel")) {
    return (
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/bibliothek/"))}
        className="text-section -ml-1 flex items-center gap-1.5 self-start rounded-control px-1 py-1 text-sm font-medium hover:underline"
      >
        <PixelIcon name="back" className="h-3.5 w-3.5" />
        Zurück
      </button>
    );
  }
  const item = currentItem(pathname);
  return (
    <div className="flex items-center gap-3.5">
      <span className="icon-tile h-12 w-12 rounded-[14px]">
        <PixelIcon name={item.icon} className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-semibold leading-none tracking-tight sm:text-4xl">{item.label}</h1>
        <p className="mt-1.5 text-sm text-muted">{item.tagline}</p>
      </div>
    </div>
  );
}

function shortLabel(item: NavItem): string {
  return item.label === "Pile of Shame" ? "Pile" : item.label;
}

/** One page in the bar: icon over a short label; the current page sits on a pill of its colour. */
function TabLink({ item, active, className = "", style }: { item: NavItem; active: boolean; className?: string; style?: CSSProperties }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      style={{ ...sectionVar(item.section), ...style }}
      className={`tab-item ${active ? "bg-section-soft text-section" : "text-muted hover:text-text"} ${className}`}
    >
      <PixelIcon name={item.icon} className={`h-5 w-5 ${active ? "" : "opacity-80"}`} />
      <span className="whitespace-nowrap">{shortLabel(item)}</span>
    </Link>
  );
}

const PRIMARY = NAV.filter((item) => item.primary);
const SECONDARY = NAV.filter((item) => !item.primary);

/**
 * The bar on a phone. Five slots show at a time on a track of nine:
 *   [4 main pages] [Mehr] [4 more pages]
 * «Mehr» slides the track to the left, so the button moves to the left edge and the other pages
 * follow it in from the right, one after the other. Tapping «Mehr» again slides back.
 */
function PhoneTabBar({ current }: { current: NavItem }) {
  // Open when the current page is one of the «more» pages.
  const [open, setOpen] = useState(!current.primary);

  return (
    <div className="glass pointer-events-auto rounded-[1.6rem] p-1.5 md:hidden">
      <div className="tab-viewport overflow-hidden rounded-[1.1rem]">
        <div className="tab-track" data-open={open}>
          {PRIMARY.map((item, i) => (
            <TabLink
              key={item.href}
              item={item}
              active={item === current}
              className="tab-leaving"
              style={{ transitionDelay: open ? `${i * 25}ms` : `${(PRIMARY.length - i) * 35}ms` }}
            />
          ))}
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Weniger" : "Mehr"}
            onClick={() => setOpen((o) => !o)}
            style={!current.primary ? sectionVar(current.section) : undefined}
            className={`tab-item ${open || !current.primary ? "bg-section-soft text-section" : "text-muted hover:text-text"}`}
          >
            {/* The dots turn into an arrow pointing back. */}
            <span className="relative h-5 w-5">
              <PixelIcon name="more" className={`tab-icon-swap absolute inset-0 h-5 w-5 ${open ? "scale-50 rotate-90 opacity-0" : ""}`} />
              <PixelIcon name="back" className={`tab-icon-swap absolute inset-0 h-5 w-5 ${open ? "" : "scale-50 -rotate-90 opacity-0"}`} />
            </span>
            <span>Mehr</span>
          </button>
          {SECONDARY.map((item, i) => (
            <TabLink
              key={item.href}
              item={item}
              active={item === current}
              className="tab-following"
              style={{ transitionDelay: open ? `${60 + i * 55}ms` : "0ms", "--follow": `${(i + 1) * 18}px` } as CSSProperties}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** The bar at the bottom, frosted glass: the sliding bar on a phone, all eight pages from tablet width. */
function TabBar({ pathname }: { pathname: string }) {
  const current = currentItem(pathname);
  return (
    <nav
      aria-label="Hauptnavigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      {/* A new group of pages (main or «more») starts the phone bar in the matching position. */}
      <PhoneTabBar key={current.primary ? "main" : "more"} current={current} />
      <div className="glass pointer-events-auto hidden gap-0.5 rounded-[1.6rem] p-1.5 md:flex">
        {NAV.map((item) => (
          <TabLink key={item.href} item={item} active={item === current} />
        ))}
      </div>
    </nav>
  );
}

// A row of book spines for the foot of the page: [height in px, colour token].
const FOOT_SPINES: [number, string][] = [
  [22, "cloth-1"], [28, "section-library"], [18, "cloth-3"], [26, "cloth-5"], [30, "section-achievements"], [20, "cloth-2"],
  [24, "section-stats"], [29, "cloth-4"], [17, "section-pile"], [25, "cloth-1"], [21, "section-review"], [30, "cloth-3"],
  [19, "section-platforms"], [27, "cloth-2"], [23, "section-add"], [29, "cloth-5"], [18, "section-home"], [25, "cloth-4"],
  [28, "cloth-1"], [20, "section-library"], [26, "cloth-3"], [30, "section-stats"], [22, "cloth-2"], [17, "section-achievements"],
];

function Foot() {
  return (
    <footer className="mt-2 flex flex-col items-center gap-2">
      <div aria-hidden className="flex w-full flex-col items-center">
        <div className="flex items-end gap-[3px] overflow-hidden px-3">
          {FOOT_SPINES.map(([height, color], i) => (
            <span key={i} className="w-2.5 shrink-0 rounded-t-[2px]" style={{ height, background: `var(--color-${color})` }} />
          ))}
        </div>
        <div className="h-1.5 w-full max-w-sm rounded-[2px] bg-shelf shadow-[inset_0_2px_0_var(--color-shelf-edge)]" />
      </div>
      <p className="text-center text-xs text-muted">
        <span className="font-pixel text-sm uppercase tracking-wider">Game</span>{" "}
        <span className="font-display font-semibold">Bibliothek</span> · alle Spiele in einem Regal
      </p>
    </footer>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const item = currentItem(pathname);

  return (
    <div style={sectionVar(session ? item.section : "home")}>
      <div aria-hidden className="app-backdrop" />

      {/* App bar: frosted glass, stays at the top. */}
      <header className="glass pt-safe sticky top-0 z-30 rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex h-14 w-full max-w-content items-center justify-between gap-3 px-page">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-control">
            <Logo className="h-9 w-9 shrink-0" />
            <span className="flex items-baseline gap-1.5 leading-none">
              <span className="font-pixel text-[1.35rem] uppercase tracking-wider text-accent">Game</span>
              <span className="font-display text-[1.35rem] font-semibold tracking-tight">Bibliothek</span>
            </span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className={`mx-auto flex w-full max-w-content flex-col gap-page px-page pt-5 ${session ? "pb-tabbar" : "pb-10"}`}>
        {session ? <PageTitle pathname={pathname} /> : null}

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
            <main key={pathname} className="anim-page-in flex flex-col gap-page">
              {children}
            </main>
          </LibraryProvider>
        )}
        <Foot />
      </div>

      {session ? <TabBar pathname={pathname} /> : null}
    </div>
  );
}
