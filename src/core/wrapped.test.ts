import { describe, expect, it } from "vitest";
import { buildSampleBatches } from "../testing/sample-library";
import { buildChronicle } from "./chronicle";
import { buildLibrary, type AchievementRow, type GameDay, type Library, type RawData } from "./library";
import { availableYears, bestDay, buildWrapped, finishedAndRated, longestStreak, yearRange } from "./wrapped";

const day = (date: string, minutes: number, gameId = "g1", estimated = false): GameDay => ({
  platformGameId: `e-${gameId}`,
  deviceId: null,
  date,
  minutes,
  estimated,
  origin: "daily",
  gameId,
  platform: "nintendo",
  deviceKind: "switch2",
});

const YEAR = { from: "2026-01-01", to: "2026-12-31" };

describe("streaks and best day", () => {
  it("finds the longest run of consecutive play days, across month borders", () => {
    const days = [
      day("2026-01-30", 10), day("2026-01-31", 10), day("2026-02-01", 10), day("2026-02-01", 5, "g2"),
      day("2026-02-03", 10), day("2026-02-04", 10, "g1", true),
    ];
    expect(longestStreak(days, YEAR)).toEqual({ days: 3, from: "2026-01-30", to: "2026-02-01", estimated: false });
    expect(longestStreak([day("2026-03-01", 10, "g1", true)], YEAR)).toEqual({ days: 1, from: "2026-03-01", to: "2026-03-01", estimated: true });
    expect(longestStreak([], YEAR)).toBeNull();
  });

  it("does not count days outside the year", () => {
    expect(longestStreak([day("2025-12-31", 10), day("2026-01-01", 10)], YEAR)?.days).toBe(1);
  });

  it("finds the day with the most playtime and its games", () => {
    const days = [day("2026-05-01", 60), day("2026-05-02", 50), day("2026-05-02", 40, "g2"), day("2026-05-03", 90, "g3")];
    expect(bestDay(days, YEAR)).toEqual({ date: "2026-05-02", minutes: 90, estimated: false, gameIds: ["g1", "g2"] });
  });
});

describe("yearRange and availableYears", () => {
  it("stops the current year at today", () => {
    expect(yearRange(2026, "2026-11-11")).toEqual({ from: "2026-01-01", to: "2026-11-11" });
    expect(yearRange(2025, "2026-11-11")).toEqual({ from: "2025-01-01", to: "2025-12-31" });
  });

  it("lists years with data, newest first, and the running year only from December", () => {
    const days = [day("2025-03-01", 1), day("2026-01-01", 1), day("2025-05-01", 1)];
    expect(availableYears(days, "2026-11-30")).toEqual([2025]);
    expect(availableYears(days, "2026-12-01")).toEqual([2026, 2025]);
    expect(availableYears(days, "2027-01-15")).toEqual([2026, 2025]);
  });
});

function demoRaw(now: Date): RawData {
  // Turn the demo batches into rows, the way the database would return them.
  const raw: RawData = { games: [], platformGames: [], devices: [], daily: [], snapshots: [], achievements: [], userData: [], connections: [], settings: {} };
  const gameIds = new Map<string, string>();
  for (const batch of buildSampleBatches(now)) {
    for (const d of batch.devices) raw.devices.push({ id: d.externalId, platform: batch.platform, kind: d.kind, label: d.label });
    for (const g of batch.games) {
      const key = g.title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z]/g, "").replace(/(fornintendoswitch|javaedition)$/, "");
      if (!gameIds.has(key)) {
        gameIds.set(key, key);
        raw.games.push({ id: key, title: g.title, cover_url: null, genres: key.startsWith("pokemon") ? ["RPG"] : [], release_year: null, igdb_id: null, time_to_beat: null });
      }
      const daily = batch.dailyPlaytime.filter((r) => r.gameExternalId === g.externalId);
      const total = g.totalPlaytimeMinutes ?? daily.reduce((s, r) => s + r.minutes, 0);
      const dates = daily.map((r) => r.date).sort();
      raw.platformGames.push({
        id: g.externalId, game_id: key, platform: batch.platform, source: "demo", external_id: g.externalId, title: g.title,
        cover_url: null, device_kind: g.deviceKind ?? null, owned: g.owned ?? true,
        first_played_at: g.firstPlayedAt ?? (dates[0] ? `${dates[0]}T12:00:00Z` : null),
        last_played_at: g.lastPlayedAt ?? (dates.at(-1) ? `${dates.at(-1)}T12:00:00Z` : null),
        total_playtime_minutes: total, achievements_unlocked: g.achievementsUnlocked ?? null, achievements_total: g.achievementsTotal ?? null,
      });
    }
    for (const r of batch.dailyPlaytime) {
      raw.daily.push({ platform_game_id: r.gameExternalId, device_id: r.deviceExternalId, play_date: r.date, minutes: r.minutes, source: "demo", estimated: false });
    }
    for (const s of batch.snapshots ?? []) {
      raw.snapshots.push({ platform_game_id: s.gameExternalId, taken_at: s.takenAt, total_minutes: s.totalMinutes, last_played_at: s.lastPlayedAt ?? null });
    }
    for (const a of batch.achievements) {
      raw.achievements.push({ platform_game_id: a.gameExternalId, external_id: a.externalId, name: a.name, description: null, icon_url: null, unlocked_at: a.unlockedAt ?? null, rarity_percent: a.rarityPercent ?? null, tier: a.tier ?? null });
    }
  }
  return raw;
}

describe("buildWrapped with demo data", () => {
  const now = new Date("2026-11-11T12:00:00Z");
  const raw = demoRaw(now);
  const library = buildLibrary(raw);
  const wrapped = buildWrapped(library, raw, 2026, { today: "2026-11-11" });

  it("sums the year and compares it with a partly tracked previous year", () => {
    expect(wrapped.range).toEqual({ from: "2026-01-01", to: "2026-11-11" });
    const sum = library.days.filter((d) => d.date.startsWith("2026")).reduce((s, d) => s + d.minutes, 0);
    expect(wrapped.totalMinutes).toBe(sum);
    expect(wrapped.previousYear?.partial).toBe(true);
    expect(wrapped.previousYear!.minutes).toBeGreaterThan(0);
    expect(wrapped.playDays).toBeGreaterThan(250);
  });

  it("names favourites and the top five", () => {
    expect(wrapped.top).toHaveLength(5);
    expect(wrapped.top[0]!.minutes).toBeGreaterThanOrEqual(wrapped.top[4]!.minutes);
    expect(wrapped.favoritePlatform).not.toBeNull();
    expect(wrapped.favoriteDevice).not.toBeNull();
    expect(wrapped.favoriteGenre?.key).toBe("RPG");
  });

  it("finds new games, achievements and the rarest one", () => {
    // released / bought in 2026 according to the demo list
    for (const id of ["haste", "pokemonpokopia", "oneshot"]) expect(wrapped.newGames).toContain(id);
    expect(wrapped.newGames).not.toContain("counterstrike");
    expect(wrapped.achievements.unlocked).toBeGreaterThan(0);
    const rarest = wrapped.achievements.rarest!;
    const unlockedThisYear = raw.achievements.filter((a) => a.unlocked_at?.startsWith("2026") && a.rarity_percent != null);
    expect(rarest.rarity_percent).toBe(Math.min(...unlockedThisYear.map((a) => a.rarity_percent!)));
  });

  it("reports where the year is not fully covered", () => {
    // the demo window starts in September 2025, so 2026 is fully covered …
    expect(wrapped.coverageGaps).toEqual([]);
    // … but 2025 is not
    const previous = buildWrapped(library, raw, 2025, { today: "2026-11-11" });
    expect(previous.coverageGaps.length).toBeGreaterThan(0);
    expect(previous.previousYear).toBeNull();
  });

  it("finds rediscovered games, but not new purchases", () => {
    for (const threshold of [30, 60, 600]) {
      const w = buildWrapped(library, raw, 2026, { today: "2026-11-11", rediscoverMinutes: threshold });
      for (const exit of w.rediscovered) {
        expect(exit.minutesBefore).toBeGreaterThan(0);
        expect(exit.minutesBefore).toBeLessThan(threshold);
        expect(exit.minutesBefore + exit.minutesInYear).toBeGreaterThanOrEqual(threshold);
        expect(wrapped.newGames).not.toContain(exit.gameId);
      }
    }
    // With a high threshold, older games that were barely touched before 2026 qualify
    const w = buildWrapped(library, raw, 2026, { today: "2026-11-11", rediscoverMinutes: 600 });
    expect(w.rediscovered.length).toBeGreaterThan(0);
  });
});

describe("buildWrapped: new games", () => {
  const game = (id: string) => ({ id, title: id, cover_url: null, genres: [], release_year: null, igdb_id: null, time_to_beat: null });
  const entry = (id: string, platform: "steam" | "psn" | "nintendo", total: number, firstPlayedAt: string | null = null) => ({
    id: `p-${id}`, game_id: id, platform, source: platform === "nintendo" ? "nintendo-parental" : platform, external_id: id, title: id,
    cover_url: null, device_kind: null, owned: true, first_played_at: firstPlayedAt, last_played_at: null,
    total_playtime_minutes: total, achievements_unlocked: null, achievements_total: null,
  });
  const snapshot = (id: string, at: string, total: number) => ({ platform_game_id: `p-${id}`, taken_at: at, total_minutes: total, last_played_at: null });
  const raw: RawData = {
    games: ["old-psn", "bought", "fresh-steam", "switch-first-day", "switch-later"].map(game),
    platformGames: [
      // PlayStation dates its first play into 2026, but it already had 600 minutes at a sync
      // before that day: the date cannot be right, and the game is not new
      entry("old-psn", "psn", 700, "2026-03-01T10:00:00Z"),
      // Steam: owned with 0 minutes at the first sync, played in June
      entry("bought", "steam", 90),
      // Steam: first seen in a later sync, already played (no first-played date from Steam)
      entry("fresh-steam", "steam", 45),
      // Switch: played on the first synced day (could be an old game)
      entry("switch-first-day", "nintendo", 30),
      // Switch: first seen after tracking began
      entry("switch-later", "nintendo", 20),
    ],
    devices: [{ id: "d-s2", platform: "nintendo", kind: "switch2", label: "Switch 2" }],
    daily: [
      { platform_game_id: "p-switch-first-day", device_id: "d-s2", play_date: "2026-01-10", minutes: 30, source: "nintendo-parental", estimated: false },
      { platform_game_id: "p-switch-later", device_id: "d-s2", play_date: "2026-04-02", minutes: 20, source: "nintendo-parental", estimated: false },
    ],
    snapshots: [
      snapshot("old-psn", "2026-01-05T06:00:00Z", 600),
      snapshot("old-psn", "2026-05-05T06:00:00Z", 700),
      snapshot("bought", "2026-01-05T06:00:00Z", 0),
      snapshot("bought", "2026-06-20T06:00:00Z", 90),
      snapshot("fresh-steam", "2026-08-01T06:00:00Z", 45),
    ],
    achievements: [],
    userData: [],
    connections: [],
    settings: {},
  };

  it("lists only games that are new since tracking began, by their first day", () => {
    const w = buildWrapped(buildLibrary(raw), raw, 2026, { today: "2026-12-05" });
    expect(w.newGames).toEqual(["switch-later", "bought", "fresh-steam"]);
  });

  it("counts the first session of a game that shows up after tracking began", () => {
    const library = buildLibrary(raw);
    expect(library.days.filter((d) => d.gameId === "fresh-steam").map((d) => [d.date, d.minutes])).toEqual([["2026-08-01", 45]]);
    const w = buildWrapped(library, raw, 2026, { today: "2026-12-05" });
    expect(w.top.find((t) => t.gameId === "fresh-steam")?.minutes).toBe(45);
  });

  it("never lists a new game as rediscovered", () => {
    // fresh-steam's 45 minutes without the fix would look like time «before» the year
    for (const threshold of [10, 60, 1000]) {
      const w = buildWrapped(buildLibrary(raw), raw, 2026, { today: "2026-12-05", rediscoverMinutes: threshold });
      for (const r of w.rediscovered) expect(w.newGames).not.toContain(r.gameId);
    }
  });

  it("puts a new game into the year it was first played", () => {
    const w = buildWrapped(buildLibrary(raw), raw, 2027, { today: "2027-12-05" });
    expect(w.newGames).toEqual([]);
  });
});

describe("buildWrapped: new games by PlayStation's «first played» date", () => {
  const game = (id: string) => ({ id, title: id, cover_url: null, genres: [], release_year: null, igdb_id: null, time_to_beat: null });
  const entry = (id: string, gameId: string, platform: "steam" | "psn" | "nintendo", total: number, firstPlayedAt: string | null = null) => ({
    id, game_id: gameId, platform, source: platform === "nintendo" ? "nintendo-parental" : platform, external_id: id, title: gameId,
    cover_url: null, device_kind: null, owned: true, first_played_at: firstPlayedAt, last_played_at: null,
    total_playtime_minutes: total, achievements_unlocked: null, achievements_total: null,
  });
  const snapshot = (id: string, at: string, total: number) => ({ platform_game_id: id, taken_at: at, total_minutes: total, last_played_at: null });
  // PlayStation and Steam are tracked from mid-November 2026 on.
  const FIRST_PSN_SYNC = "2026-11-13T06:00:00Z";
  const raw: RawData = {
    games: ["ps-2026", "ps-2025", "ps-twice", "ps-and-switch", "ps-and-steam", "ps-fresh", "ps-app", "ps-zero", "ps-comeback"].map(game),
    platformGames: [
      // first played in March 2026, long before tracking began: new in 2026
      entry("p-2026", "ps-2026", "psn", 700, "2026-03-10T18:00:00Z"),
      // first played at Christmas 2025: new in 2025, not in 2026
      entry("p-2025", "ps-2025", "psn", 300, "2025-12-24T18:00:00Z"),
      // two PlayStation versions: the earlier date counts
      entry("p-twice-a", "ps-twice", "psn", 500, "2025-12-30T10:00:00Z"),
      entry("p-twice-b", "ps-twice", "psn", 0, "2026-02-21T10:00:00Z"),
      // new on the PS5 in 2026, but played on the Switch since 2025 (imported history)
      entry("p-switch-ps", "ps-and-switch", "psn", 200, "2026-04-23T10:00:00Z"),
      entry("p-switch-ns", "ps-and-switch", "nintendo", 60, "2025-09-05T12:00:00Z"),
      // new on the PS5 in November, but 23 hours on Steam at its first sync: maybe played for years
      entry("p-steam-ps", "ps-and-steam", "psn", 20, "2026-11-09T19:00:00Z"),
      entry("p-steam-pc", "ps-and-steam", "steam", 1400),
      // new since tracking began, and Sony dates it too: listed once
      entry("p-fresh", "ps-fresh", "psn", 90, "2026-11-18T17:00:00Z"),
      // an app marked «Kein Spiel»
      entry("p-app", "ps-app", "psn", 40, "2026-01-24T10:00:00Z"),
      // started, but less than a minute
      entry("p-zero", "ps-zero", "psn", 0, "2026-04-16T10:00:00Z"),
      // 30 minutes before tracking, an hour after it: new, not rediscovered
      entry("p-comeback", "ps-comeback", "psn", 90, "2026-02-01T10:00:00Z"),
    ],
    devices: [{ id: "d-s1", platform: "nintendo", kind: "switch1", label: "Switch" }],
    daily: [
      { platform_game_id: "p-switch-ns", device_id: "d-s1", play_date: "2025-09-05", minutes: 60, source: "nintendo-import", estimated: false },
    ],
    snapshots: [
      snapshot("p-2026", FIRST_PSN_SYNC, 600),
      snapshot("p-2026", "2026-11-20T06:00:00Z", 700),
      snapshot("p-2025", FIRST_PSN_SYNC, 300),
      snapshot("p-twice-a", FIRST_PSN_SYNC, 500),
      snapshot("p-twice-b", FIRST_PSN_SYNC, 0),
      snapshot("p-switch-ps", FIRST_PSN_SYNC, 200),
      snapshot("p-steam-ps", FIRST_PSN_SYNC, 20),
      snapshot("p-steam-pc", "2026-11-12T06:00:00Z", 1400),
      snapshot("p-fresh", FIRST_PSN_SYNC, 0),
      snapshot("p-fresh", "2026-11-20T06:00:00Z", 90),
      snapshot("p-app", FIRST_PSN_SYNC, 40),
      snapshot("p-zero", FIRST_PSN_SYNC, 0),
      snapshot("p-comeback", FIRST_PSN_SYNC, 30),
      snapshot("p-comeback", "2026-11-20T06:00:00Z", 90),
    ],
    achievements: [],
    userData: [{ game_id: "ps-app", status: null, favorite: false, note: null, hide_from_pile: false, hidden: true, rating: null, completed_on: null }],
    connections: [],
    settings: {},
  };
  const library = buildLibrary(raw);
  const options = { today: "2026-12-05" };

  it("counts a PS5 game first played this year before tracking began, by Sony's day", () => {
    expect(buildWrapped(library, raw, 2026, options).newGames).toEqual(["ps-comeback", "ps-2026", "ps-fresh"]);
  });

  it("puts a game Sony dates into the previous year there, not into this one", () => {
    expect(buildWrapped(library, raw, 2025, options).newGames).toEqual(["ps-2025", "ps-twice"]);
  });

  it("leaves out a game played elsewhere without a known first day, apps and games never really played", () => {
    const all = [2025, 2026].flatMap((year) => buildWrapped(library, raw, year, options).newGames);
    for (const id of ["ps-and-switch", "ps-and-steam", "ps-app", "ps-zero"]) expect(all).not.toContain(id);
    expect(new Set(all).size).toBe(all.length);
  });

  it("ignores a few minutes tried elsewhere before tracking began", () => {
    // started on the PS5 in May, but opened once for a minute on Steam before tracking began
    const tried: RawData = {
      ...raw,
      games: [...raw.games, game("ps-tried"), game("ps-played-pc")],
      platformGames: [
        ...raw.platformGames,
        entry("p-tried-ps", "ps-tried", "psn", 2364, "2026-05-16T10:00:00Z"),
        entry("p-tried-pc", "ps-tried", "steam", 1),
        // the same with 11 minutes on Steam: more than tried, its start stays unknown
        entry("p-pc-ps", "ps-played-pc", "psn", 600, "2026-05-16T10:00:00Z"),
        entry("p-pc-pc", "ps-played-pc", "steam", 11),
      ],
      snapshots: [
        ...raw.snapshots,
        snapshot("p-tried-ps", FIRST_PSN_SYNC, 2364),
        snapshot("p-tried-pc", "2026-11-12T06:00:00Z", 1),
        snapshot("p-pc-ps", FIRST_PSN_SYNC, 600),
        snapshot("p-pc-pc", "2026-11-12T06:00:00Z", 11),
      ],
    };
    const lib = buildLibrary(tried);
    const newGames = buildWrapped(lib, tried, 2026, options).newGames;
    expect(newGames).toContain("ps-tried");
    expect(newGames).not.toContain("ps-played-pc");
    const start = buildChronicle(lib, tried, { isRare: () => false }).find((e) => e.kind === "start" && e.gameId === "ps-tried");
    expect(start?.date).toBe("2026-05-16");
  });

  it("never lists a game both as new and as rediscovered", () => {
    const w = buildWrapped(library, raw, 2026, options);
    expect(w.rediscovered.map((r) => r.gameId)).not.toContain("ps-comeback");
    for (const r of w.rediscovered) expect(w.newGames).not.toContain(r.gameId);
  });

  it("dates «Erstmals gespielt» in the Chronik on the same day", () => {
    const starts = buildChronicle(library, raw, { isRare: () => false })
      .filter((e) => e.kind === "start")
      .map((e) => [e.gameId, e.date]);
    expect(starts).toEqual([
      ["ps-fresh", "2026-11-18"],
      ["ps-2026", "2026-03-10"],
      ["ps-comeback", "2026-02-01"],
      ["ps-twice", "2025-12-30"],
      ["ps-2025", "2025-12-24"],
    ]);
  });
});

describe("buildWrapped: coverage of this and the previous year", () => {
  const raw: RawData = { games: [], platformGames: [], devices: [], daily: [], snapshots: [], achievements: [], userData: [], connections: [], settings: {} };
  const library = (dataSince: Library["dataSince"]): Library => ({ ...buildLibrary(raw), dataSince });
  const wrapped = (dataSince: Library["dataSince"], year = 2026) => buildWrapped(library(dataSince), raw, year, { today: "2026-12-05" });

  it("calls the previous year partial as soon as one platform started after its first day", () => {
    // the Switch history reaches back years (import), Steam and PlayStation started in November
    const w = wrapped({ nintendo: "2021-03-28", steam: "2026-11-12", psn: "2026-11-13" });
    expect(w.previousYear).toEqual({ minutes: 0, partial: true });
    expect(wrapped({ nintendo: "2021-03-28", steam: "2024-02-01" }).previousYear?.partial).toBe(false);
    expect(wrapped({ nintendo: "2025-01-01" }).previousYear?.partial).toBe(false);
    expect(wrapped({ nintendo: "2025-01-02" }).previousYear?.partial).toBe(true);
    // nothing tracked in the previous year at all: no comparison
    expect(wrapped({ steam: "2026-11-12" }).previousYear).toBeNull();
  });

  it("lists every platform that was not tracked the whole year, also those that started later", () => {
    expect(wrapped({ nintendo: "2021-03-28", steam: "2026-11-12", psn: "2026-11-13" }).coverageGaps).toEqual([
      { platform: "steam", since: "2026-11-12" },
      { platform: "psn", since: "2026-11-13" },
    ]);
    // 2025 has none of the Steam and PlayStation time
    expect(wrapped({ nintendo: "2021-03-28", steam: "2026-11-12" }, 2025).coverageGaps).toEqual([{ platform: "steam", since: "2026-11-12" }]);
    expect(wrapped({ nintendo: "2026-01-01" }).coverageGaps).toEqual([]);
  });
});

describe("buildWrapped: achievements", () => {
  const entry = (id: string, gameId: string, platform: "steam" | "psn") => ({
    id, game_id: gameId, platform, source: platform, external_id: id, title: gameId,
    cover_url: null, device_kind: null, owned: true, first_played_at: null, last_played_at: null,
    total_playtime_minutes: 60, achievements_unlocked: 3, achievements_total: 3,
  });
  const ach = (entryId: string, externalId: string, name: string, unlockedAt: string | null, rarity: number | null): AchievementRow => ({
    platform_game_id: entryId, external_id: externalId, name, description: null, icon_url: null,
    unlocked_at: unlockedAt, rarity_percent: rarity, tier: null,
  });
  const raw: RawData = {
    games: [{ id: "hk", title: "Hollow Knight", cover_url: null, genres: [], release_year: null, igdb_id: null, time_to_beat: null }],
    platformGames: [entry("hk-steam", "hk", "steam"), entry("hk-psn", "hk", "psn")],
    devices: [], daily: [], snapshots: [], userData: [], connections: [], settings: {},
    achievements: [
      // the same achievement on PC and PlayStation, both unlocked in 2026: one achievement
      ach("hk-steam", "FALSE_KNIGHT", "Test der Entschlossenheit", "2026-03-01T10:00:00Z", 40),
      ach("hk-psn", "NPWR1_00:1", "Test der Entschlossenheit", "2026-04-01T10:00:00Z", 35),
      // first unlocked on PC in 2025: belongs to 2025, not again to 2026
      ach("hk-steam", "HORNET", "Beschützerin", "2025-12-20T10:00:00Z", 30),
      ach("hk-psn", "NPWR1_00:2", "Beschützerin", "2026-02-01T10:00:00Z", 25),
      // rare on PlayStation, but only unlocked on PC: the PC share counts
      ach("hk-steam", "GRIMM", "Albtraumkönig", "2026-06-01T10:00:00Z", 12),
      ach("hk-psn", "NPWR1_00:3", "Albtraumkönig", null, 2),
      // the same row delivered twice
      ach("hk-psn", "NPWR1_00:4", "Seelentyrann", "2026-07-01T10:00:00Z", 20),
      ach("hk-psn", "NPWR1_00:4", "Seelentyrann", "2026-07-01T10:00:00Z", 20),
    ],
  };
  const library = buildLibrary(raw);

  it("counts an achievement once, in the year of its first unlock", () => {
    expect(buildWrapped(library, raw, 2026, { today: "2026-12-05" }).achievements.unlocked).toBe(3);
    expect(buildWrapped(library, raw, 2025, { today: "2026-12-05" }).achievements.unlocked).toBe(1);
  });

  it("takes the rarest share from a platform where it is unlocked", () => {
    const { rarest } = buildWrapped(library, raw, 2026, { today: "2026-12-05" }).achievements;
    expect([rarest?.name, rarest?.rarity_percent, rarest?.gameId]).toEqual(["Albtraumkönig", 12, "hk"]);
  });

  it("leaves out games marked «Kein Spiel»", () => {
    const hidden = { ...raw, userData: [{ game_id: "hk", status: null, favorite: false, note: null, hide_from_pile: false, hidden: true, rating: null, completed_on: null }] };
    expect(buildWrapped(buildLibrary(hidden), hidden, 2026, { today: "2026-12-05" }).achievements).toEqual({ unlocked: 0, rarest: null });
  });
});

describe("buildWrapped: games added by hand", () => {
  it("do not show up as a platform tracked only from a later day", () => {
    const raw: RawData = {
      games: [{ id: "peg", title: "Peggle", cover_url: null, genres: [], release_year: null, igdb_id: null, time_to_beat: null }],
      platformGames: [{
        id: "p-peg", game_id: "peg", platform: "manual", source: "manual", external_id: "manual:1", title: "Peggle",
        cover_url: null, device_kind: "xbox360", owned: true, first_played_at: null, last_played_at: null,
        total_playtime_minutes: 300, achievements_unlocked: null, achievements_total: null,
      }],
      devices: [], daily: [], achievements: [], userData: [], connections: [], settings: {},
      // the starting value, stored when the game was added in June
      snapshots: [{ platform_game_id: "p-peg", taken_at: "2026-06-01T08:00:00Z", total_minutes: 300, last_played_at: null }],
    };
    const w = buildWrapped(buildLibrary(raw), raw, 2026, { today: "2026-12-05" });
    expect(w.coverageGaps).toEqual([]);
    expect(w.previousYear).toBeNull();
  });
});

describe("finishedAndRated", () => {
  const raw = demoRaw(new Date("2026-11-11T12:00:00Z"));
  const rate = (gameId: string, rating: number | null, completed: string | null) => ({
    game_id: gameId, status: null, favorite: false, note: null, hide_from_pile: false, hidden: false, rating, completed_on: completed,
  });
  const library = buildLibrary({
    ...raw,
    userData: [rate("haste", 5, "2026-03-01"), rate("oneshot", 4, "2026-02-10"), rate("counterstrike", 5, "2025-06-01"), rate("pokemonpokopia", 2, null)],
  });
  const year = yearRange(2026, "2026-11-11");

  it("lists the games finished in the year, in order", () => {
    expect(finishedAndRated(library, year).finished).toEqual(["oneshot", "haste"]);
    expect(finishedAndRated(library, yearRange(2025, "2026-11-11")).finished).toEqual(["counterstrike"]);
  });

  it("ranks rated games played or finished in the year, best first", () => {
    const { topRated } = finishedAndRated(library, year);
    expect(topRated[0]).toEqual({ gameId: expect.stringMatching(/haste|counterstrike/), rating: 5 });
    expect(topRated.map((r) => r.rating)).toEqual([...topRated.map((r) => r.rating)].sort((a, b) => b - a));
    expect(topRated.length).toBeLessThanOrEqual(3);
  });

  it("is empty without ratings, so the review shows no extra cards", () => {
    const plain = buildLibrary(raw);
    expect(finishedAndRated(plain, year)).toEqual({ finished: [], topRated: [] });
  });
});
