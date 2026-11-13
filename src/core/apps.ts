// Entries that are apps, not games. The sync marks them as «Kein Spiel» once; after that
// the user's own choice in the game detail counts.
import { normalizeTitle } from "./normalize-title";

const KNOWN_APPS = [
  "YouTube",
  "Netflix",
  "Spotify",
  "Twitch",
  "Crunchyroll",
  "Prime Video",
  "Amazon Prime Video",
  "Apple TV",
  "Apple TV+",
  "Apple Music",
  "Sony Pictures Core",
  "Disney+",
  "Plex",
  "DAZN",
  "Wallpaper Engine",
  "3DMark",
  "PlayStation Video",
  "Media Player",
];

const NORMALIZED = new Set(KNOWN_APPS.map((t) => normalizeTitle(t)));

export function isKnownApp(title: string): boolean {
  return NORMALIZED.has(normalizeTitle(title));
}
