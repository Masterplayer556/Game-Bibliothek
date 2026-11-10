// Import of old Nintendo play history (from the «Nintendo Store» app), as CSV.
// The Store app lists one line per game and day: "17.02.2026   1 Std. 15 Min.".
import { normalizeTitle } from "../normalize-title";
import { emptyBatch, type DeviceKind, type LocalDate, type SyncBatch } from "../types";

export const NINTENDO_IMPORT_ID = "nintendo-import";

/** Everything before this day was played on the Switch 1 (the Switch 2 arrived then). */
export const SWITCH2_SINCE_DEFAULT: LocalDate = "2025-06-13";

/** «Für kurze Zeit» in the Store app means less than 15 minutes. */
export const SHORT_PLAY_MINUTES = 5;

export type ImportDevice = "switch1" | "switch2";

export interface ImportRow {
  title: string;
  date: LocalDate;
  minutes: number;
  /** null = not stated in the file */
  device: ImportDevice | null;
  estimated: boolean;
  line: number;
}

export interface ImportProblem {
  line: number;
  message: string;
}

export interface ImportParseResult {
  rows: ImportRow[];
  problems: ImportProblem[];
}

/** "1 Std. 15 Min.", "45 Min.", "5 Std. 0 Min.", "Für kurze Zeit", "90", "1:30" */
export function parseDuration(text: string): { minutes: number; estimated: boolean } | null {
  const t = text.trim().toLowerCase();
  if (t === "") return null;
  if (/kurze zeit|a short time|a little while/.test(t)) {
    return { minutes: SHORT_PLAY_MINUTES, estimated: true };
  }
  if (/^\d+([.,]\d+)?$/.test(t)) {
    return { minutes: Math.round(Number(t.replace(",", "."))), estimated: false };
  }
  const clock = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (clock) return { minutes: Number(clock[1]) * 60 + Number(clock[2]), estimated: false };

  const hours = /(\d+)\s*(std|stunden?|h|hrs?|hours?)\b\.?/.exec(t);
  const minutes = /(\d+)\s*(min|minuten?|m|mins?|minutes?)\b\.?/.exec(t);
  if (!hours && !minutes) return null;
  return {
    minutes: (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0),
    estimated: false,
  };
}

/** "17.02.2026", "17.2.26", "2026-02-17" */
export function parseDate(text: string): LocalDate | null {
  const t = text.trim();
  let year: number, month: number, day: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const swiss = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(t);
  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (swiss) {
    [day, month, year] = [Number(swiss[1]), Number(swiss[2]), Number(swiss[3])];
    if (year < 100) year += 2000;
  } else {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function parseDevice(text: string): ImportDevice | null | "invalid" {
  const t = text.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (t === "") return null;
  if (["switch1", "1", "switch", "nintendoswitch", "nintendoswitch1"].includes(t)) return "switch1";
  if (["switch2", "2", "nintendoswitch2"].includes(t)) return "switch2";
  return "invalid";
}

function detectDelimiter(line: string): string {
  const counts = [";", "\t", ","].map((d) => [d, line.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 0 ? counts[0]![0] : ";";
}

/** Splits one CSV line, honouring double quotes ("Mario, Luigi";…). */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

/**
 * Columns: Spiel; Datum; Dauer; Gerät (optional).
 * Lines listed twice (overlapping screenshots) are merged, keeping the longer duration.
 */
export function parseImportCsv(text: string, today: LocalDate): ImportParseResult {
  const problems: ImportProblem[] = [];
  const byKey = new Map<string, ImportRow>();
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const firstContent = lines.find((l) => l.trim() !== "") ?? "";
  const delimiter = detectDelimiter(firstContent);

  lines.forEach((raw, index) => {
    const line = index + 1;
    if (raw.trim() === "" || raw.trim().startsWith("#")) return;
    const cells = splitLine(raw, delimiter);
    const [title = "", dateText = "", durationText = "", deviceText = ""] = cells;
    if (/^(spiel|titel|title|game)$/i.test(title)) return; // header

    if (title === "") return void problems.push({ line, message: "Spiel fehlt." });
    const date = parseDate(dateText);
    if (!date) return void problems.push({ line, message: `Datum nicht lesbar: «${dateText}».` });
    if (date > today) return void problems.push({ line, message: `Datum liegt in der Zukunft: ${dateText}.` });
    const duration = parseDuration(durationText);
    if (!duration) return void problems.push({ line, message: `Dauer nicht lesbar: «${durationText}».` });
    if (duration.minutes <= 0 || duration.minutes > 1440) {
      return void problems.push({ line, message: `Dauer unmöglich: ${durationText}.` });
    }
    const device = parseDevice(deviceText);
    if (device === "invalid") {
      return void problems.push({ line, message: `Gerät unbekannt: «${deviceText}» (erlaubt: Switch 1, Switch 2 oder leer).` });
    }

    const key = `${normalizeTitle(title)}|${date}|${device ?? ""}`;
    const existing = byKey.get(key);
    if (!existing || duration.minutes > existing.minutes) {
      byKey.set(key, { title, date, minutes: duration.minutes, device, estimated: duration.estimated, line });
    }
  });

  return { rows: [...byKey.values()], problems };
}

export interface ImportContext {
  /** Nintendo entries that already exist, so rows attach to them instead of creating twins. */
  existingGames: readonly { externalId: string; title: string }[];
  existingDevices: readonly { externalId: string; kind: string }[];
  switch2Since?: LocalDate;
}

const IMPORT_DEVICES: Record<ImportDevice | "unknown", { externalId: string; kind: DeviceKind; label: string }> = {
  switch1: { externalId: "import:switch1", kind: "switch1", label: "Switch" },
  switch2: { externalId: "import:switch2", kind: "switch2", label: "Switch 2" },
  unknown: { externalId: "import:switch-unknown", kind: "other", label: "Switch (unbekannt)" },
};

function slug(title: string): string {
  return normalizeTitle(title).replace(/\s+/g, "-");
}

/**
 * Rows → batch. The Store history does not say which console a day was played on:
 * before `switch2Since` it must have been the Switch 1, afterwards it is unknown unless the
 * file states it. Console data always wins over an import for the same game and day.
 */
export function buildImportBatch(rows: readonly ImportRow[], context: ImportContext): SyncBatch {
  const batch = emptyBatch("nintendo", NINTENDO_IMPORT_ID);
  const switch2Since = context.switch2Since ?? SWITCH2_SINCE_DEFAULT;

  const byExactTitle = new Map<string, string>();
  const byNormalizedTitle = new Map<string, string>();
  for (const game of context.existingGames) {
    byExactTitle.set(game.title.trim().toLowerCase(), game.externalId);
    const normalized = normalizeTitle(game.title);
    if (!byNormalizedTitle.has(normalized)) byNormalizedTitle.set(normalized, game.externalId);
  }

  const games = new Map<string, string>(); // externalId → title
  const newDevices = new Set<keyof typeof IMPORT_DEVICES>();

  const deviceFor = (row: ImportRow): string => {
    const wanted: keyof typeof IMPORT_DEVICES =
      row.device ?? (row.date < switch2Since ? "switch1" : "unknown");
    const kind = IMPORT_DEVICES[wanted].kind;
    // Prefer a real console of that kind over an import placeholder.
    const real = context.existingDevices.find((d) => d.kind === kind && !d.externalId.startsWith("import:"));
    if (real && wanted !== "unknown") return real.externalId;
    const known = context.existingDevices.some((d) => d.externalId === IMPORT_DEVICES[wanted].externalId);
    if (!known) newDevices.add(wanted);
    return IMPORT_DEVICES[wanted].externalId;
  };

  for (const row of rows) {
    const externalId =
      byExactTitle.get(row.title.trim().toLowerCase()) ??
      byNormalizedTitle.get(normalizeTitle(row.title)) ??
      `import:${slug(row.title)}`;
    if (!games.has(externalId)) games.set(externalId, row.title);
    batch.dailyPlaytime.push({
      gameExternalId: externalId,
      deviceExternalId: deviceFor(row),
      date: row.date,
      minutes: row.minutes,
      estimated: row.estimated,
    });
  }

  for (const [externalId, title] of games) {
    batch.games.push({ externalId, title, owned: true, achievementsUnlocked: null, achievementsTotal: null });
  }
  for (const key of newDevices) batch.devices.push(IMPORT_DEVICES[key]);
  return batch;
}
