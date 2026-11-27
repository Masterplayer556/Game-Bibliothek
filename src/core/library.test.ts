import { describe, expect, it } from "vitest";
import { formatHours, formatMinutes } from "./labels";
import {
  buildLibrary,
  compareTitles,
  deviceTotals,
  distribution,
  filterLibrary,
  lifetimeByPlatform,
  lifetimeDistribution,
  lifetimeTopGames,
  playtimeSeries,
  staleConnections,
  topGames,
  totalInRange,
  undatedTime,
  countsAppsInTotal,
  periodTotals,
  rangeFor,
  readStoredFilter,
  timeToBeatSummary,
  type ConnectionRow,
  type RawData,
} from "./library";

function raw(): RawData {
  return {
    games: [
      { id: "g-mc", title: "Minecraft", cover_url: null, genres: ["Sandbox"], release_year: 2011, igdb_id: null, time_to_beat: null },
      { id: "g-hk", title: "Hollow Knight", cover_url: null, genres: ["Platformer", "Metroidvania"], release_year: 2017, igdb_id: null, time_to_beat: null },
      { id: "g-yt", title: "YouTube", cover_url: null, genres: [], release_year: null, igdb_id: null, time_to_beat: null },
      { id: "g-peg", title: "Peggle", cover_url: null, genres: [], release_year: null, igdb_id: null, time_to_beat: null },
    ],
    platformGames: [
      // Minecraft on PS5 (lifetime totals, snapshots) and Switch (per-day data, two consoles)
      { id: "e-mc-psn", game_id: "g-mc", platform: "psn", source: "psn", external_id: "1", title: "Minecraft", cover_url: "https://x/mc.jpg", device_kind: "ps5", owned: true, first_played_at: "2024-01-01T10:00:00Z", last_played_at: "2026-03-02T20:00:00Z", total_playtime_minutes: 1000, achievements_unlocked: 10, achievements_total: 50 },
      { id: "e-mc-nin", game_id: "g-mc", platform: "nintendo", source: "nintendo-parental", external_id: "0100", title: "Minecraft for Nintendo Switch", cover_url: null, device_kind: null, owned: true, first_played_at: "2026-03-01T12:00:00Z", last_played_at: "2026-03-09T12:00:00Z", total_playtime_minutes: 150, achievements_unlocked: null, achievements_total: null },
      { id: "e-hk", game_id: "g-hk", platform: "steam", source: "steam", external_id: "2", title: "Hollow Knight", cover_url: null, device_kind: "pc", owned: true, first_played_at: null, last_played_at: "2026-02-01T20:00:00Z", total_playtime_minutes: 30, achievements_unlocked: 34, achievements_total: 63 },
      { id: "e-yt", game_id: "g-yt", platform: "nintendo", source: "nintendo-parental", external_id: "yt", title: "YouTube", cover_url: null, device_kind: null, owned: true, first_played_at: null, last_played_at: "2026-03-05T12:00:00Z", total_playtime_minutes: 500, achievements_unlocked: null, achievements_total: null },
      { id: "e-peg", game_id: "g-peg", platform: "manual", source: "manual", external_id: "m", title: "Peggle", cover_url: null, device_kind: "xbox360", owned: false, first_played_at: null, last_played_at: null, total_playtime_minutes: 0, achievements_unlocked: null, achievements_total: null },
    ],
    devices: [
      { id: "d-s1", platform: "nintendo", kind: "switch1", label: "Switch" },
      { id: "d-s2", platform: "nintendo", kind: "switch2", label: "Switch 2" },
    ],
    daily: [
      { platform_game_id: "e-mc-nin", device_id: "d-s1", play_date: "2026-03-01", minutes: 60, source: "nintendo-parental", estimated: false },
      { platform_game_id: "e-mc-nin", device_id: "d-s2", play_date: "2026-03-09", minutes: 90, source: "nintendo-parental", estimated: false },
      { platform_game_id: "e-yt", device_id: "d-s2", play_date: "2026-03-05", minutes: 500, source: "nintendo-parental", estimated: false },
    ],
    snapshots: [
      { platform_game_id: "e-mc-psn", taken_at: "2026-03-01T05:00:00Z", total_minutes: 900, last_played_at: null },
      { platform_game_id: "e-mc-psn", taken_at: "2026-03-02T21:00:00Z", total_minutes: 1000, last_played_at: "2026-03-02T20:00:00Z" },
    ],
    achievements: [],
    userData: [
      { game_id: "g-yt", status: null, favorite: false, note: null, hide_from_pile: false, hidden: true, rating: null, completed_on: null },
      { game_id: "g-hk", status: "playing", favorite: true, note: "Speedrun", hide_from_pile: false, hidden: false, rating: null, completed_on: null },
    ],
    connections: [],
    settings: {},
  };
}

const lib = buildLibrary(raw());
const march = { from: "2026-03-01", to: "2026-03-31" };

describe("buildLibrary", () => {
  it("joins platform entries into one game with the sum of their playtime", () => {
    const mc = lib.byId.get("g-mc")!;
    expect(mc.platforms).toEqual(["psn", "nintendo"]);
    expect(mc.totalMinutes).toBe(1150);
    expect(mc.deviceKinds).toEqual(["ps5", "switch1", "switch2"]);
    expect(mc.coverUrl).toBe("https://x/mc.jpg");
    expect(mc.lastPlayedAt).toBe("2026-03-09T12:00:00Z");
  });

  it("adds achievements only over platforms that have them", () => {
    expect(lib.byId.get("g-mc")!.achievements).toEqual({ unlocked: 10, total: 50 });
    expect(lib.byId.get("g-peg")!.achievements).toBeNull();
  });

  it("applies my own data", () => {
    const hk = lib.byId.get("g-hk")!;
    expect([hk.status, hk.favorite, hk.note]).toEqual(["playing", true, "Speedrun"]);
  });

  it("keeps hidden entries out of the played days, but keeps their time separately", () => {
    expect(lib.days.some((d) => d.gameId === "g-yt")).toBe(false);
    expect(lib.appDays.map((d) => [d.gameId, d.minutes])).toEqual([["g-yt", 500]]);
    expect(totalInRange(lib.days, march)).toEqual({ minutes: 250, estimated: false });
  });

  it("tags each day with platform and console", () => {
    const kinds = lib.days.map((d) => [d.date, d.platform, d.deviceKind]);
    expect(kinds).toEqual([
      ["2026-03-01", "nintendo", "switch1"],
      ["2026-03-02", "psn", "ps5"],
      ["2026-03-09", "nintendo", "switch2"],
    ]);
  });

  it("knows from when each platform has data", () => {
    expect(lib.dataSince).toEqual({ nintendo: "2026-03-01", psn: "2026-03-01" });
  });

  it("does not treat games added by hand as a tracked platform", () => {
    // Adding a game by hand stores its starting value as a snapshot.
    const data = raw();
    data.snapshots.push({ platform_game_id: "e-peg", taken_at: "2026-06-01T08:00:00Z", total_minutes: 300, last_played_at: null });
    expect(buildLibrary(data).dataSince).toEqual({ nintendo: "2026-03-01", psn: "2026-03-01" });
  });
});

describe("statistics", () => {
  it("ranks games by time played in the range", () => {
    expect(topGames(lib.days, march, 5)).toEqual([{ gameId: "g-mc", minutes: 250, estimated: false }]);
    expect(topGames(lib.days, { from: "2026-03-05", to: "2026-03-31" }, 5)[0]!.minutes).toBe(90);
  });

  it("splits time by platform, console and genre", () => {
    expect(distribution(lib.days, march, "platform", lib.byId)).toEqual([
      { key: "nintendo", minutes: 150 },
      { key: "psn", minutes: 100 },
    ]);
    expect(distribution(lib.days, march, "device", lib.byId).map((s) => s.key)).toEqual([
      "ps5",
      "switch2",
      "switch1",
    ]);
    expect(distribution(lib.days, march, "genre", lib.byId)).toEqual([{ key: "Sandbox", minutes: 250 }]);
  });

  it("counts the undated time of apps on its own, and reads the «count apps» setting", () => {
    // YouTube: 500 min in total, all of them on a known day: nothing undated
    expect(undatedTime(lib.games, lib.appDays, "apps")).toEqual([]);
    const more = raw();
    more.platformGames.find((p) => p.id === "e-yt")!.total_playtime_minutes = 800;
    const withUndated = buildLibrary(more);
    expect(undatedTime(withUndated.games, withUndated.appDays, "apps")).toEqual([
      { gameId: "g-yt", platform: "nintendo", deviceKind: "switch2", minutes: 300 },
    ]);
    expect(countsAppsInTotal({})).toBe(false);
    expect(countsAppsInTotal({ countAppsInTotal: true })).toBe(true);
    expect(countsAppsInTotal({ countAppsInTotal: "yes" })).toBe(false);
  });

  it("counts time from before the first sync where no date is needed", () => {
    // PS5: 1000 min in total, only 100 of them on a known day. Steam: 30 min, no day at all.
    const undated = undatedTime(lib.games, lib.days);
    expect(undated).toEqual([
      { gameId: "g-mc", platform: "psn", deviceKind: "ps5", minutes: 900 },
      { gameId: "g-hk", platform: "steam", deviceKind: "pc", minutes: 30 },
    ]);
    expect(lifetimeDistribution(lib.days, undated, "platform", lib.byId)).toEqual([
      { key: "psn", minutes: 1000 },
      { key: "nintendo", minutes: 150 },
      { key: "steam", minutes: 30 },
    ]);
    expect(lifetimeDistribution(lib.days, undated, "device", lib.byId)[0]).toEqual({ key: "ps5", minutes: 1000 });
    expect(lifetimeDistribution(lib.days, undated, "genre", lib.byId)[0]).toEqual({ key: "Sandbox", minutes: 1150 });
    expect(lifetimeTopGames(lib.days, undated, 5).map((t) => [t.gameId, t.minutes])).toEqual([
      ["g-mc", 1150],
      ["g-hk", 30],
    ]);
  });

  it("reports lifetime totals per platform without hidden entries", () => {
    expect(lifetimeByPlatform(lib.games)).toEqual([
      { key: "psn", minutes: 1000 },
      { key: "nintendo", minutes: 150 },
      { key: "steam", minutes: 30 },
    ]);
  });

  it("fills empty weeks and months", () => {
    const weeks = playtimeSeries(lib.days, { from: "2026-02-23", to: "2026-03-15" }, "week");
    expect(weeks).toEqual([
      { key: "2026-02-23", minutes: 60, estimatedMinutes: 0, estimated: false }, // Sunday 01.03. belongs to this week
      { key: "2026-03-02", minutes: 100, estimatedMinutes: 0, estimated: false },
      { key: "2026-03-09", minutes: 90, estimatedMinutes: 0, estimated: false },
    ]);
    const months = playtimeSeries(lib.days, { from: "2025-12-15", to: "2026-03-31" }, "month");
    expect(months.map((p) => [p.key, p.minutes])).toEqual([
      ["2025-12", 0],
      ["2026-01", 0],
      ["2026-02", 0],
      ["2026-03", 250],
    ]);
  });

  it("marks a bar as estimated only when most of its time is", () => {
    const day = (date: string, minutes: number, estimated: boolean) =>
      ({ gameId: "g", platform: "nintendo", deviceKind: "switch1", date, minutes, estimated }) as (typeof lib.days)[number];
    const range = { from: "2025-01-01", to: "2025-02-28" };
    const days = [day("2025-01-05", 300, false), day("2025-01-06", 5, true), day("2025-02-01", 5, true), day("2025-02-02", 4, false)];
    const [jan, feb] = playtimeSeries(days, range, "month");
    expect([jan!.estimatedMinutes, jan!.estimated]).toEqual([5, false]);
    expect([feb!.estimatedMinutes, feb!.estimated]).toEqual([5, true]);
  });

  it("also counts by day and by year", () => {
    const daily = playtimeSeries(lib.days, { from: "2026-02-28", to: "2026-03-03" }, "day");
    expect(daily.map((p) => p.key)).toEqual(["2026-02-28", "2026-03-01", "2026-03-02", "2026-03-03"]);
    expect(daily.reduce((sum, p) => sum + p.minutes, 0)).toBe(
      lib.days.filter((d) => d.date >= "2026-02-28" && d.date <= "2026-03-03").reduce((sum, d) => sum + d.minutes, 0),
    );
    const yearly = playtimeSeries(lib.days, { from: "2024-07-01", to: "2026-03-31" }, "year");
    expect(yearly.map((p) => [p.key, p.minutes])).toEqual([
      ["2024", 0],
      ["2025", 0],
      ["2026", 250],
    ]);
  });

  it("splits a game's time by console", () => {
    expect(deviceTotals(lib.byId.get("g-mc")!, lib.days)).toEqual([
      { platform: "psn", deviceKind: "ps5", minutes: 1000 },
      { platform: "nintendo", deviceKind: "switch2", minutes: 90 },
      { platform: "nintendo", deviceKind: "switch1", minutes: 60 },
    ]);
  });
});

describe("filterLibrary", () => {
  it("searches titles of every platform, ignoring accents and case", () => {
    expect(filterLibrary(lib.games, { search: "nintendo switch" }).map((g) => g.id)).toEqual(["g-mc"]);
    expect(filterLibrary(lib.games, { search: "HÖLLOW" }).map((g) => g.id)).toEqual(["g-hk"]);
  });

  it("filters by platform, console, genre and status and hides «not a game» entries", () => {
    expect(filterLibrary(lib.games, { platform: "nintendo" }).map((g) => g.id)).toEqual(["g-mc"]);
    expect(filterLibrary(lib.games, { platform: "nintendo", showHidden: true }).map((g) => g.id).sort()).toEqual(["g-mc", "g-yt"]);
    expect(filterLibrary(lib.games, { device: "switch2" }).map((g) => g.id)).toEqual(["g-mc"]);
    expect(filterLibrary(lib.games, { genre: "Metroidvania" }).map((g) => g.id)).toEqual(["g-hk"]);
    expect(filterLibrary(lib.games, { status: "none" }).map((g) => g.id).sort()).toEqual(["g-mc", "g-peg"]);
  });

  it("sorts by last played, playtime or name", () => {
    expect(filterLibrary(lib.games, {}).map((g) => g.id)).toEqual(["g-mc", "g-hk", "g-peg"]);
    expect(filterLibrary(lib.games, { sort: "playtime" }).map((g) => g.id)).toEqual(["g-mc", "g-hk", "g-peg"]);
    expect(filterLibrary(lib.games, { sort: "name" }).map((g) => g.title)).toEqual(["Hollow Knight", "Minecraft", "Peggle"]);
  });

  it("filters favourites and sorts by achievement progress or release year, unknown last", () => {
    expect(filterLibrary(lib.games, { favorite: true }).map((g) => g.id)).toEqual(["g-hk"]);
    // Hollow Knight 34/63, Minecraft 10/50, Peggle without achievements
    expect(filterLibrary(lib.games, { sort: "achievements" }).map((g) => g.id)).toEqual(["g-hk", "g-mc", "g-peg"]);
    expect(filterLibrary(lib.games, { sort: "releaseYear" }).map((g) => g.id)).toEqual(["g-hk", "g-mc", "g-peg"]);
    const rated = buildLibrary({ ...raw(), userData: [...raw().userData, { game_id: "g-peg", status: null, favorite: false, note: null, hide_from_pile: false, hidden: false, rating: 4, completed_on: null }] });
    expect(filterLibrary(rated.games, { sort: "rating" }).map((g) => g.id)).toEqual(["g-peg", "g-hk", "g-mc"]);
  });

  it("orders titles like German localeCompare (umlauts next to their base letter)", () => {
    const titles = ["Zelda", "Ökolopoly", "Oxenfree", "Ori", "ark", "Äpfel"];
    expect([...titles].sort(compareTitles)).toEqual([...titles].sort((a, b) => a.localeCompare(b, "de")));
    expect([...titles].sort(compareTitles)).toEqual(["Äpfel", "ark", "Ökolopoly", "Ori", "Oxenfree", "Zelda"]);
  });

  it("finds the same games when searching again (cached search texts)", () => {
    const first = filterLibrary(lib.games, { search: "hollow" }).map((g) => g.id);
    expect(filterLibrary(lib.games, { search: "hollow" }).map((g) => g.id)).toEqual(first);
    expect(filterLibrary(lib.games, { search: "peg" }).map((g) => g.id)).toEqual(["g-peg"]);
  });
});

describe("staleConnections", () => {
  const base: ConnectionRow = {
    adapter_id: "steam", platform: "steam", status: "ok", enabled: true, configured: true,
    last_sync_at: null, last_success_at: "2026-11-10T00:00:00Z", last_error: null,
    data_since: null, token_expires_at: null, details: null,
  };
  const now = new Date("2026-11-11T12:00:00Z");

  it("flags connected sources without a recent success", () => {
    expect(staleConnections([base], now)).toHaveLength(1);
    expect(staleConnections([{ ...base, last_success_at: "2026-11-11T06:00:00Z" }], now)).toHaveLength(0);
    expect(staleConnections([{ ...base, last_success_at: null }], now)).toHaveLength(1);
  });

  it("ignores sources that are not connected or switched off", () => {
    expect(staleConnections([{ ...base, status: "not_connected", configured: false }], now)).toHaveLength(0);
    expect(staleConnections([{ ...base, enabled: false }], now)).toHaveLength(0);
  });
});

describe("format", () => {
  it("formats minutes in Swiss German", () => {
    expect(formatMinutes(45)).toBe("45 Min.");
    expect(formatMinutes(75)).toBe("1 Std. 15 Min.");
    expect(formatMinutes(120)).toBe("2 Std.");
    expect(formatHours(90)).toBe("1.5 Std."); // Swiss decimal point
    expect(formatHours(6000)).toBe("100 Std.");
  });
});

describe("rangeFor", () => {
  it("counts back from today, the year from 1 January", () => {
    expect(rangeFor("30d", "2026-03-31", undefined)).toEqual({ from: "2026-03-02", to: "2026-03-31" });
    expect(rangeFor("12m", "2026-03-31", undefined)).toEqual({ from: "2025-04-01", to: "2026-03-31" });
    expect(rangeFor("year", "2026-03-31", undefined)).toEqual({ from: "2026-01-01", to: "2026-03-31" });
  });

  it("starts «all» on the first played day, or today without any", () => {
    expect(rangeFor("all", "2026-03-31", "2024-05-01")).toEqual({ from: "2024-05-01", to: "2026-03-31" });
    expect(rangeFor("all", "2026-03-31", undefined)).toEqual({ from: "2026-03-31", to: "2026-03-31" });
  });
});

describe("periodTotals", () => {
  const library = buildLibrary(raw());
  const all = rangeFor("all", "2026-03-10", library.days[0]?.date);

  it("adds the time without a date only for everything", () => {
    const dated = totalInRange(library.days, all).minutes;
    const undated = undatedTime(library.games, library.days).reduce((s, u) => s + u.minutes, 0);
    const everything = periodTotals(library, all, true, false);
    expect(everything.undatedMinutes).toBe(undated);
    expect(everything.total.minutes).toBe(dated + undated);
    const range = periodTotals(library, all, false, false);
    expect(range.undated).toEqual([]);
    expect(range.total.minutes).toBe(dated);
  });

  it("adds the time in apps only when it counts", () => {
    const without = periodTotals(library, all, true, false);
    const withApps = periodTotals(library, all, true, true);
    expect(without.appMinutes).toBe(500);
    expect(withApps.total.minutes).toBe(without.total.minutes + 500);
  });

  it("counts played days of games only", () => {
    // Minecraft on 1, 2 and 9 March; YouTube (an app) on 5 March does not count.
    expect(periodTotals(library, all, false, false).playedDays).toBe(3);
  });
});

describe("readStoredFilter", () => {
  it("restores a stored filter", () => {
    const filter = { search: "zelda", platform: "nintendo", status: "playing", favorite: true, sort: "name" };
    expect(readStoredFilter(JSON.stringify(filter))).toEqual(filter);
  });

  it("drops unknown or malformed values", () => {
    expect(readStoredFilter(null)).toEqual({ sort: "lastPlayed" });
    expect(readStoredFilter("{kaputt")).toEqual({ sort: "lastPlayed" });
    expect(readStoredFilter("[1]")).toEqual({ sort: "lastPlayed" });
    expect(readStoredFilter(JSON.stringify({ sort: "random", search: 5, favorite: "yes", extra: 1 }))).toEqual({ sort: "lastPlayed" });
  });
});

describe("time to beat", () => {
  const withTimes = () => {
    const r = raw();
    r.games = r.games.map((g) =>
      g.id === "g-hk" ? { ...g, time_to_beat: { hastily: 1200, normally: 1800, completely: 3600, count: 50 } }
      : g.id === "g-mc" ? { ...g, time_to_beat: { hastily: null, normally: null, completely: 6000, count: 3 } }
      : g,
    );
    return buildLibrary(r);
  };

  it("compares my playtime with the usual length", () => {
    const hk = withTimes().byId.get("g-hk")!;
    expect(timeToBeatSummary(hk)).toEqual({
      steps: [
        { kind: "hastily", minutes: 1200 },
        { kind: "normally", minutes: 1800 },
        { kind: "completely", minutes: 3600 },
      ],
      mainMinutes: 1800,
      mineMinutes: 30,
      progress: 30 / 1800,
    });
    // only «everything» known: that is the length; more than it is capped at 100 %
    const mc = withTimes().byId.get("g-mc")!;
    expect(timeToBeatSummary(mc)).toMatchObject({ mainMinutes: 6000, progress: 1150 / 6000 });
    expect(timeToBeatSummary({ timeToBeat: { hastily: 10, normally: null, completely: null, count: 1 }, totalMinutes: 50 })?.progress).toBe(1);
    expect(timeToBeatSummary(withTimes().byId.get("g-peg")!)).toBeNull();
  });

  it("sorts short games first, unknown length last", () => {
    expect(filterLibrary(withTimes().games, { sort: "short" }).map((g) => g.id)).toEqual(["g-hk", "g-mc", "g-peg"]);
  });
});
