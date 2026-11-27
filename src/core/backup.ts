// «Daten herunterladen»: a backup of everything the app stores for me, as one JSON file, and
// the library as a table (CSV) for a spreadsheet. Pure functions; reading is in src/lib/backup.ts.
import { PLATFORM_LABEL, STATUS_LABEL } from "./labels";
import type { LibraryGame } from "./library";
import { toLocalDate } from "./time";

/** The tables of the backup, in the order they are written. Credentials are never readable. */
export const BACKUP_TABLES = [
  "games",
  "game_user_data",
  "platform_games",
  "devices",
  "daily_playtime",
  "playtime_snapshots",
  "achievements",
  "platform_connections",
  "sync_runs",
  "app_settings",
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export const BACKUP_FORMAT = "game-bibliothek-backup";
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  /** Rows per table, for a quick check after a restore. */
  counts: Record<BackupTable, number>;
  tables: Record<BackupTable, Record<string, unknown>[]>;
}

export function buildBackup(tables: Record<BackupTable, Record<string, unknown>[]>, now: Date): Backup {
  const counts = Object.fromEntries(BACKUP_TABLES.map((t) => [t, tables[t].length])) as Record<BackupTable, number>;
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), counts, tables };
}

/** «game-bibliothek-2026-11-27.json» (the day in Europe/Zurich). */
export function backupFileName(now: Date, extension: "json" | "csv", part = ""): string {
  return `game-bibliothek${part ? `-${part}` : ""}-${toLocalDate(now)}.${extension}`;
}

/** One CSV field: quoted when it holds the separator, a quote or a line break. */
export function csvField(value: string | number | boolean | null | undefined, separator = ";"): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // A leading = + - @ would start a formula in a spreadsheet: keep it as text.
  const safe = /^[=+\-@]/.test(text) && typeof value === "string" ? `'${text}` : text;
  return /["\n\r]/.test(safe) || safe.includes(separator) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * The library as a table: one row per game. Semicolons and a byte order mark, so Excel with
 * Swiss settings opens it with umlauts and columns right away. Hours with a decimal point.
 */
export function libraryCsv(games: readonly LibraryGame[]): string {
  const header = [
    "Titel",
    "Plattformen",
    "Spielzeit (Std.)",
    "Zuletzt gespielt",
    "Status",
    "Favorit",
    "Bewertung",
    "Durchgespielt am",
    "Erfolge",
    "Erfolge gesamt",
    "Genres",
    "Erscheinungsjahr",
    "Kein Spiel",
    "Notiz",
  ];
  const rows = games.map((g) => [
    g.title,
    g.platforms.map((p) => PLATFORM_LABEL[p]).join(", "),
    (g.totalMinutes / 60).toFixed(1),
    g.lastPlayedAt ? toLocalDate(g.lastPlayedAt) : "",
    g.status ? STATUS_LABEL[g.status] : "",
    g.favorite ? "ja" : "",
    g.rating ?? "",
    g.completedOn ?? "",
    g.achievements?.unlocked ?? "",
    g.achievements?.total ?? "",
    g.genres.join(", "),
    g.releaseYear ?? "",
    g.hidden ? "ja" : "",
    g.note,
  ]);
  return "﻿" + [header, ...rows].map((r) => r.map((v) => csvField(v)).join(";")).join("\r\n") + "\r\n";
}
