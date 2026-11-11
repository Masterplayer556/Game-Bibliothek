import { describe, expect, it } from "vitest";
import { buildDemoBatches } from "./demo";
import { buildLibrary, type GameDay, type RawData } from "./library";
import { availableYears, bestDay, buildWrapped, longestStreak, yearRange } from "./wrapped";

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

  it("lists years with data, newest first", () => {
    expect(availableYears([day("2025-03-01", 1), day("2026-01-01", 1), day("2025-05-01", 1)])).toEqual([2026, 2025]);
  });
});

function demoRaw(now: Date): RawData {
  // Turn the demo batches into rows, the way the database would return them.
  const raw: RawData = { games: [], platformGames: [], devices: [], daily: [], snapshots: [], achievements: [], userData: [], connections: [], settings: {} };
  const gameIds = new Map<string, string>();
  for (const batch of buildDemoBatches(now)) {
    for (const d of batch.devices) raw.devices.push({ id: d.externalId, platform: batch.platform, kind: d.kind, label: d.label });
    for (const g of batch.games) {
      const key = g.title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z]/g, "").replace(/(fornintendoswitch|javaedition)$/, "");
      if (!gameIds.has(key)) {
        gameIds.set(key, key);
        raw.games.push({ id: key, title: g.title, cover_url: null, genres: key.startsWith("pokemon") ? ["RPG"] : [], release_year: null, igdb_id: null });
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
  const wrapped = buildWrapped(library, raw.achievements, 2026, { today: "2026-11-11", pileThresholdMinutes: 60 });

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
    const previous = buildWrapped(library, raw.achievements, 2025, { today: "2026-11-11", pileThresholdMinutes: 60 });
    expect(previous.coverageGaps.length).toBeGreaterThan(0);
    expect(previous.previousYear).toBeNull();
  });

  it("finds games that left the pile of shame, but not new purchases", () => {
    for (const threshold of [30, 60, 600]) {
      const w = buildWrapped(library, raw.achievements, 2026, { today: "2026-11-11", pileThresholdMinutes: threshold });
      for (const exit of w.pileExits) {
        expect(exit.minutesBefore).toBeGreaterThan(0);
        expect(exit.minutesBefore).toBeLessThan(threshold);
        expect(exit.minutesBefore + exit.minutesInYear).toBeGreaterThanOrEqual(threshold);
        expect(wrapped.newGames).not.toContain(exit.gameId);
      }
    }
    // With a high threshold, older games that were barely touched before 2026 qualify
    const w = buildWrapped(library, raw.achievements, 2026, { today: "2026-11-11", pileThresholdMinutes: 600 });
    expect(w.pileExits.length).toBeGreaterThan(0);
  });
});
