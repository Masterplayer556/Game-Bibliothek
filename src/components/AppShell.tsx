"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";
import { Icon } from "./Icon";
import { LibraryProvider } from "./LibraryProvider";
import { LoginForm } from "./LoginForm";
import { PixelIcon } from "./PixelIcon";
import { Logo } from "./Logo";
import { currentItem, NAV } from "./navigation";
import { sectionStyle } from "./section";
import { TabBar } from "./TabBar";
import { ThemeToggle } from "./ThemeToggle";
import { Card, Notice } from "./ui";

/** The large title at the top of a page, as in a phone app. A game page gets a back button instead. */
function PageTitle({ pathname }: { pathname: string }) {
  const router = useRouter();
  if (pathname.startsWith("/spiel")) {
    return (
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/bibliothek/"))}
        className="btn btn-secondary -mb-1 self-start !py-2 !pl-2.5 text-section"
      >
        <Icon name="back" className="h-4 w-4" />
        Zurück
      </button>
    );
  }
  const item = currentItem(pathname);
  return (
    <div className="flex items-center gap-4">
      <PixelIcon name={item.icon} className="page-pixel-icon h-[3.6rem] w-[3.6rem]" />
      <div className="min-w-0">
        <h1 className="font-display text-[2.15rem] font-extrabold leading-none tracking-tight sm:text-5xl">{item.label}</h1>
        <p className="mt-1.5 text-sm font-medium text-muted">{item.tagline}</p>
      </div>
    </div>
  );
}

/** The foot of the page: the colours of all sections and the name. */
function Foot() {
  return (
    <footer className="mt-4 flex flex-col items-center gap-3 text-center">
      <div aria-hidden className="flex gap-1.5">
        {NAV.map((item) => (
          <span key={item.href} className="h-2 w-6 rounded-full bg-section" style={sectionStyle(item.section)} />
        ))}
      </div>
      <p className="text-xs text-muted">
        <span className="font-display font-extrabold text-text">Game Bibliothek</span> · alle Spiele an einem Ort
      </p>
    </footer>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const item = currentItem(pathname);

  return (
    <div style={sectionStyle(session ? item.section : "home")}>
      <div aria-hidden className="app-backdrop" />

      {/* App bar: frosted glass, stays at the top. */}
      <header className="glass pt-safe sticky top-0 z-30 !rounded-none !border-x-0 !border-t-0">
        <div className="mx-auto flex h-14 w-full max-w-content items-center justify-between gap-3 px-page">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-control">
            <Logo className="h-9 w-9 shrink-0" />
            <span className="font-display text-[1.3rem] font-extrabold leading-none tracking-tight">
              <span className="bg-linear-to-r from-accent to-accent-2 bg-clip-text text-transparent">Game</span> Bibliothek
            </span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className={`mx-auto flex w-full max-w-content flex-col gap-page px-page pt-6 ${session ? "pb-tabbar" : "pb-10"}`}>
        {!isSupabaseConfigured ? (
          <Card title="Noch nicht eingerichtet" icon="warning">
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
            {/*
              A new page rises in with a short fade (opacity and transform only: no snapshot of
              the whole page, so switching tabs stays instant). The data provider stays outside.
            */}
            <div key={pathname} className="page-enter flex flex-col gap-page">
              <PageTitle pathname={pathname} />
              <main className="flex flex-col gap-page">{children}</main>
            </div>
          </LibraryProvider>
        )}
        <Foot />
      </div>

      {session ? <TabBar /> : null}
    </div>
  );
}
