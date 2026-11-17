// The pages of the app, in the order of the tab bar.
import type { IconName } from "./Icon";
import type { Section } from "./section";

export interface NavItem {
  href: string;
  label: string;
  /** Label in the tab bar, where room is short. */
  short: string;
  /** Short line under the page title. */
  tagline: string;
  section: Section;
  icon: IconName;
  /** In the bar on a phone; the others sit behind «Mehr». */
  primary: boolean;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Übersicht", short: "Übersicht", tagline: "Was zuletzt lief", section: "home", icon: "home", primary: true },
  { href: "/bibliothek/", label: "Bibliothek", short: "Bibliothek", tagline: "Alle Spiele an einem Ort", section: "library", icon: "library", primary: true },
  { href: "/statistiken/", label: "Statistiken", short: "Statistik", tagline: "Spielzeit in Zahlen", section: "stats", icon: "stats", primary: true },
  { href: "/erfolge/", label: "Erfolge", short: "Erfolge", tagline: "Erfolge und Trophäen", section: "achievements", icon: "trophy", primary: true },
  { href: "/chronik/", label: "Chronik", short: "Chronik", tagline: "Dein Spielerleben als Zeitstrahl", section: "chronicle", icon: "chronicle", primary: false },
  { href: "/rueckblick/", label: "Rückblick", short: "Rückblick", tagline: "Dein Jahr als Karten", section: "review", icon: "review", primary: false },
  { href: "/hinzufuegen/", label: "Hinzufügen", short: "Hinzufügen", tagline: "Ein Spiel von Hand eintragen", section: "add", icon: "plus", primary: false },
  { href: "/plattformen/", label: "Plattformen", short: "Plattform", tagline: "Quellen und Sync", section: "platforms", icon: "gamepad", primary: false },
];

export const PRIMARY = NAV.filter((item) => item.primary);
export const SECONDARY = NAV.filter((item) => !item.primary);

export function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, ""));
}

/** The page's entry in the navigation; a game page belongs to the library. */
export function currentItem(pathname: string): NavItem {
  if (pathname.startsWith("/spiel")) return NAV[1]!;
  return NAV.find((item) => isActive(item.href, pathname)) ?? NAV[0]!;
}
