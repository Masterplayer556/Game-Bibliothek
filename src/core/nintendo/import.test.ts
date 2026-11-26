import { describe, expect, it } from "vitest";
import {
  buildImportBatch,
  combineImports,
  importVariant,
  parseDate,
  parseDuration,
  parseImportCsv,
  supersededImportRows,
} from "./import";

const TODAY = "2026-11-10";

describe("parseDuration", () => {
  it("reads the formats of the Nintendo Store app", () => {
    expect(parseDuration("1 Std. 15 Min.")).toEqual({ minutes: 75, estimated: false });
    expect(parseDuration("45 Min.")).toEqual({ minutes: 45, estimated: false });
    expect(parseDuration("5 Std. 0 Min.")).toEqual({ minutes: 300, estimated: false });
    expect(parseDuration("Für kurze Zeit")).toEqual({ minutes: 5, estimated: true });
  });

  it("reads plain minutes and other common spellings", () => {
    expect(parseDuration("90")).toEqual({ minutes: 90, estimated: false });
    expect(parseDuration("1:30")).toEqual({ minutes: 90, estimated: false });
    expect(parseDuration("2h 5min")).toEqual({ minutes: 125, estimated: false });
    expect(parseDuration("3 Stunden")).toEqual({ minutes: 180, estimated: false });
  });

  it("reads decimal hours", () => {
    expect(parseDuration("1.5 h")).toEqual({ minutes: 90, estimated: false });
    expect(parseDuration("1,5 Std.")).toEqual({ minutes: 90, estimated: false });
    expect(parseDuration("0.25 Stunden")).toEqual({ minutes: 15, estimated: false });
    expect(parseDuration("1,5")).toEqual({ minutes: 90, estimated: false });
    expect(parseDuration("2.75")).toEqual({ minutes: 165, estimated: false });
    expect(parseDuration("1.5h 10min")).toEqual({ minutes: 100, estimated: false });
    // more than a day cannot be hours: minutes with a fraction
    expect(parseDuration("90.0")).toEqual({ minutes: 90, estimated: false });
  });

  it("rejects nonsense", () => {
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("viel")).toBeNull();
  });
});

describe("parseDate", () => {
  it("reads Swiss and ISO dates", () => {
    expect(parseDate("17.02.2026")).toBe("2026-02-17");
    expect(parseDate("4.1.26")).toBe("2026-01-04");
    expect(parseDate("2021-12-09")).toBe("2021-12-09");
  });

  it("rejects impossible dates", () => {
    expect(parseDate("31.02.2026")).toBeNull();
    expect(parseDate("02/17/2026")).toBeNull();
  });
});

describe("parseImportCsv", () => {
  it("takes the delimiter from the first data line, not from a comment above it", () => {
    const csv = [
      "# Exportiert am 26.11.2026, von Hand ergänzt, Zeiten gerundet",
      "Spiel;Datum;Dauer;Gerät",
      "Mario, Luigi und Co.;17.02.2026;45 Min.;Switch 1",
    ].join("\n");
    const { rows, problems } = parseImportCsv(csv, TODAY);
    expect(problems).toEqual([]);
    expect(rows.map((r) => [r.title, r.date, r.minutes, r.device])).toEqual([["Mario, Luigi und Co.", "2026-02-17", 45, "switch1"]]);
  });

  it("reads the template format with header, comments and empty lines", () => {
    const csv = [
      "﻿Spiel;Datum;Dauer;Gerät",
      "# Kommentar",
      "",
      "Minecraft for Nintendo Switch;17.02.2026;1 Std. 15 Min.;",
      "Minecraft for Nintendo Switch;04.01.2026;Für kurze Zeit;Switch 2",
      '"Mario; Luigi";09.12.2021;45 Min.;Switch 1',
    ].join("\r\n");
    const { rows, problems } = parseImportCsv(csv, TODAY);
    expect(problems).toEqual([]);
    expect(rows).toEqual([
      { title: "Minecraft for Nintendo Switch", listedAs: "Minecraft for Nintendo Switch", date: "2026-02-17", minutes: 75, device: null, estimated: false, line: 4 },
      { title: "Minecraft for Nintendo Switch", listedAs: "Minecraft for Nintendo Switch", date: "2026-01-04", minutes: 5, device: "switch2", estimated: true, line: 5 },
      { title: "Mario; Luigi", listedAs: "Mario; Luigi", date: "2021-12-09", minutes: 45, device: "switch1", estimated: false, line: 6 },
    ]);
  });

  it("accepts commas and tabs as separators", () => {
    expect(parseImportCsv("Miitopia,2024-05-01,30", TODAY).rows[0]).toMatchObject({ title: "Miitopia", minutes: 30 });
    expect(parseImportCsv("Miitopia\t01.05.2024\t30 Min.", TODAY).rows[0]).toMatchObject({ date: "2024-05-01" });
  });

  it("merges lines that appear twice instead of adding them up", () => {
    const csv = "Miitopia;01.05.2024;30 Min.\nMIITOPIA;01.05.2024;30 Min.\nMiitopia;01.05.2024;45 Min.";
    const { rows } = parseImportCsv(csv, TODAY);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.minutes).toBe(45);
  });

  it("reports unreadable lines with their line number and keeps the rest", () => {
    const csv = [
      "Miitopia;01.05.2024;30 Min.",
      ";01.05.2024;30 Min.",
      "Miitopia;irgendwann;30 Min.",
      "Miitopia;01.05.2024;lange",
      "Miitopia;01.05.2024;30 Min.;Wii",
      "Miitopia;01.05.2030;30 Min.",
      "Miitopia;02.05.2024;2000",
    ].join("\n");
    const { rows, problems } = parseImportCsv(csv, TODAY);
    expect(rows).toHaveLength(1);
    expect(problems.map((p) => p.line)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(problems[2]!.message).toMatch(/Dauer nicht lesbar/);
    expect(problems[4]!.message).toMatch(/Zukunft/);
  });
});

describe("combineImports", () => {
  it("joins several files and counts a day listed in two files once, the longer one", () => {
    const a = parseImportCsv("Spiel;Datum;Dauer\nMiitopia;01.05.2024;30 Min.\nPikmin 4;02.05.2024;1 Std. 0 Min.", TODAY);
    const b = parseImportCsv("Miitopia;01.05.2024;45 Min.\nMiitopia;03.05.2024;20 Min.\nKaputt;gestern;5", TODAY);
    const { rows, problems } = combineImports([
      { name: "a.csv", result: a },
      { name: "b.csv", result: b },
    ]);
    expect(rows.map((r) => [r.title, r.date, r.minutes]).sort()).toEqual([
      ["Miitopia", "2024-05-01", 45],
      ["Miitopia", "2024-05-03", 20],
      ["Pikmin 4", "2024-05-02", 60],
    ]);
    expect(problems).toEqual([{ line: 3, message: "Datum nicht lesbar: «gestern».", file: "b.csv" }]);
  });

  it("changes nothing for a single file", () => {
    const a = parseImportCsv("Miitopia;01.05.2024;30 Min.", TODAY);
    expect(combineImports([{ name: "a.csv", result: a }]).rows).toEqual(a.rows);
  });
});

describe("DELTARUNE versions", () => {
  it("turns the demo and both versions into one game; the version is the console", () => {
    expect(importVariant("DELTARUNE Chapter 1&2", null)).toEqual({ title: "DELTARUNE", device: "switch1" });
    expect(importVariant("DELTARUNE Chapter 1 & 2", "switch2")).toEqual({ title: "DELTARUNE", device: "switch1" });
    expect(importVariant("Deltarune Demo", null)).toEqual({ title: "DELTARUNE", device: "switch1" });
    expect(importVariant("DELTARUNE Nintendo Switch 2 Edition", null)).toEqual({ title: "DELTARUNE", device: "switch2" });
    expect(importVariant("DELTARUNE (Switch 2)", "switch1")).toEqual({ title: "DELTARUNE", device: "switch2" });
    expect(importVariant("DELTARUNE", null)).toEqual({ title: "DELTARUNE", device: "switch1" });
    expect(importVariant("DELTARUNE™", "switch2")).toEqual({ title: "DELTARUNE", device: "switch2" });
    expect(importVariant("Undertale", null)).toEqual({ title: "Undertale", device: null });
  });

  it("adds up the demo and the full game on the same day, keeps the Switch 2 apart", () => {
    const csv = [
      "DELTARUNE Chapter 1&2;10.03.2025;30 Min.",
      "DELTARUNE Chapter 1&2;10.03.2025;30 Min.", // the same line twice: once
      "DELTARUNE;10.03.2025;45 Min.",
      "DELTARUNE Nintendo Switch 2 Edition;20.06.2025;1 Std. 0 Min.",
      "DELTARUNE;20.06.2025;20 Min.",
    ].join("\n");
    const { rows } = parseImportCsv(csv, TODAY);
    expect(new Set(rows.map((r) => r.title))).toEqual(new Set(["DELTARUNE"]));
    const batch = buildImportBatch(rows, { existingGames: [], existingDevices: [] });
    expect(batch.games.map((g) => [g.externalId, g.title])).toEqual([["import:deltarune", "DELTARUNE"]]);
    expect(batch.dailyPlaytime.map((d) => [d.date, d.deviceExternalId, d.minutes])).toEqual([
      ["2025-03-10", "import:switch1", 75],
      ["2025-06-20", "import:switch2", 60],
      ["2025-06-20", "import:switch1", 20],
    ]);
  });
});

describe("buildImportBatch", () => {
  const rows = parseImportCsv(
    [
      "Minecraft for Nintendo Switch;09.12.2021;2 Std. 0 Min.",
      "Minecraft for Nintendo Switch;17.02.2026;1 Std. 15 Min.",
      "Minecraft for Nintendo Switch;18.02.2026;30 Min.;Switch 2",
      "Miitopia;01.05.2024;Für kurze Zeit",
    ].join("\n"),
    TODAY,
  ).rows;

  it("assigns days before the Switch 2 to the Switch 1 and later days to «unknown»", () => {
    const batch = buildImportBatch(rows, { existingGames: [], existingDevices: [] });
    expect(batch.source).toBe("nintendo-import");
    expect(batch.dailyPlaytime.map((r) => [r.date, r.deviceExternalId])).toEqual([
      ["2021-12-09", "import:switch1"],
      ["2026-02-17", "import:switch-unknown"],
      ["2026-02-18", "import:switch2"],
      ["2024-05-01", "import:switch1"],
    ]);
    expect(batch.devices.map((d) => d.kind).sort()).toEqual(["other", "switch1", "switch2"]);
    expect(batch.dailyPlaytime[3]).toMatchObject({ minutes: 5, estimated: true });
  });

  it("uses real consoles and existing entries where they exist", () => {
    const batch = buildImportBatch(rows, {
      existingGames: [{ externalId: "0100MINECRAFT", title: "Minecraft" }],
      existingDevices: [
        { externalId: "console-2", kind: "switch2" },
        { externalId: "import:switch1", kind: "switch1" },
      ],
    });
    // "Minecraft for Nintendo Switch" matches the existing "Minecraft" entry
    expect(batch.games.map((g) => g.externalId)).toEqual(["0100MINECRAFT", "import:miitopia"]);
    expect(batch.dailyPlaytime.find((r) => r.date === "2026-02-18")?.deviceExternalId).toBe("console-2");
    // the Switch 1 placeholder already exists, only «unknown» is new
    expect(batch.devices.map((d) => d.externalId)).toEqual(["import:switch-unknown"]);
  });

  it("gives imported games no lifetime total: it is derived from the days that count", () => {
    const batch = buildImportBatch(rows, { existingGames: [], existingDevices: [] });
    expect(batch.games.every((g) => g.totalPlaytimeMinutes === undefined)).toBe(true);
  });
});

describe("supersededImportRows", () => {
  it("replaces earlier rows of a game and day that the new import covers", () => {
    const stored = [
      { id: 1, platformGameId: "e1", deviceId: "import:switch1", date: "2024-05-01" }, // moved to a real console
      { id: 2, platformGameId: "e1", deviceId: "console-1", date: "2024-05-01" }, // written again
      { id: 3, platformGameId: "e2", deviceId: "console-1", date: "2024-05-02" }, // other entry, same game
      { id: 4, platformGameId: "e1", deviceId: "import:switch1", date: "2024-05-03" }, // day not in the new import
      { id: 5, platformGameId: "x", deviceId: "console-1", date: "2024-05-01" }, // other game
    ];
    const written = [
      { platformGameId: "e1", deviceId: "console-1", date: "2024-05-01" },
      { platformGameId: "e1", deviceId: "console-1", date: "2024-05-02" },
    ];
    const gameOf = (id: string) => (id === "x" ? "game-x" : "game-1");
    expect(supersededImportRows(stored, written, gameOf)).toEqual([1, 3]);
  });
});
