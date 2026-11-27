import { describe, expect, it } from "vitest";
import { BACKUP_TABLES, backupFileName, buildBackup, csvField, libraryCsv } from "./backup";
import { buildLibrary, type RawData } from "./library";

describe("backup", () => {
  it("names the file after the day in Zurich", () => {
    expect(backupFileName(new Date("2026-11-26T23:30:00Z"), "json")).toBe("game-bibliothek-2026-11-27.json");
    expect(backupFileName(new Date("2026-11-26T12:00:00Z"), "csv", "spiele")).toBe("game-bibliothek-spiele-2026-11-26.csv");
  });

  it("counts the rows of every table", () => {
    const tables = Object.fromEntries(BACKUP_TABLES.map((t) => [t, []])) as unknown as Parameters<typeof buildBackup>[0];
    tables.games = [{ id: "a" }, { id: "b" }];
    const backup = buildBackup(tables, new Date("2026-11-27T10:00:00Z"));
    expect(backup).toMatchObject({ format: "game-bibliothek-backup", version: 1, exportedAt: "2026-11-27T10:00:00.000Z" });
    expect(backup.counts.games).toBe(2);
    expect(backup.counts.achievements).toBe(0);
    expect(JSON.parse(JSON.stringify(backup)).tables.games).toEqual([{ id: "a" }, { id: "b" }]);
  });
});

describe("CSV", () => {
  it("quotes fields with separators, quotes or line breaks and keeps formulas as text", () => {
    expect(csvField("Zelda")).toBe("Zelda");
    expect(csvField("A;B")).toBe('"A;B"');
    expect(csvField('Er sagte "hi"')).toBe('"Er sagte ""hi"""');
    expect(csvField("Zeile 1\nZeile 2")).toBe('"Zeile 1\nZeile 2"');
    expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvField(-3)).toBe("-3");
    expect(csvField(null)).toBe("");
  });

  it("writes one row per game with a header", () => {
    const raw: RawData = {
      games: [{ id: "g", title: "Hollow Knight", cover_url: null, genres: ["Indie", "Action"], release_year: 2017, igdb_id: 1, time_to_beat: null }],
      platformGames: [
        { id: "e", game_id: "g", platform: "steam", source: "steam", external_id: "1", title: "Hollow Knight", cover_url: null, device_kind: "pc", owned: true, first_played_at: null, last_played_at: "2026-11-01T20:00:00Z", total_playtime_minutes: 90, achievements_unlocked: 3, achievements_total: 63 },
      ],
      devices: [], daily: [], snapshots: [], achievements: [],
      userData: [{ game_id: "g", status: "completed", favorite: true, note: "Gut; schwer", hide_from_pile: false, hidden: false, rating: 5, completed_on: "2026-10-31" }],
      connections: [], settings: {},
    };
    const csv = libraryCsv(buildLibrary(raw).games);
    expect(csv.startsWith("﻿Titel;Plattformen;")).toBe(true);
    const lines = csv.slice(1).trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('Hollow Knight;Steam;1.5;2026-11-01;Durchgespielt;ja;5;2026-10-31;3;63;Indie, Action;2017;;"Gut; schwer"');
  });
});
