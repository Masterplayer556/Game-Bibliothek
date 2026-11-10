import { describe, expect, it } from "vitest";
import { buildImportBatch, parseDate, parseDuration, parseImportCsv } from "./import";

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
      { title: "Minecraft for Nintendo Switch", date: "2026-02-17", minutes: 75, device: null, estimated: false, line: 4 },
      { title: "Minecraft for Nintendo Switch", date: "2026-01-04", minutes: 5, device: "switch2", estimated: true, line: 5 },
      { title: "Mario; Luigi", date: "2021-12-09", minutes: 45, device: "switch1", estimated: false, line: 6 },
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
