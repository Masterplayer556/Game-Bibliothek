import { describe, expect, it } from "vitest";
import { formatHours, formatMinutes } from "./labels";
import {
  buildLibrary,
  deviceTotals,
  distribution,
  filterLibrary,
  lifetimeByPlatform,
  pileOfShame,
  playtimeSeries,
  staleConnections,
  topGames,
  totalInRange,
  type ConnectionRow,
  type RawData,
} from "./library";

function raw(): RawData {
  return {
    games: [
      { id: "g-mc", title: "Minecraft", cover_url: null, genres: ["Sandbox"], release_year: 2011, igdb_id: null },
      { id: "g-hk", title: "Hollow Knight", cover_url: null, genres: ["Platformer", "Metroidvania"], release_year: 2017, igdb_id: null },
      { id: "g-yt", title: "YouTube", cover_url: null, genres: [], release_year: null, igdb_id: null },
      { id: "g-peg", title: "Peggle", cover_url: null, genres: [], release_year: null, igdb_id: null },
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
      { game_id: "g-yt", status: null, favorite: false, note: null, hide_from_pile: false, hidden: true },
      { game_id: "g-hk", status: "playing", favorite: true, note: "Speedrun", hide_from_pile: false, hidden: false },
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
      { key: "2026-02-23", minutes: 60, estimated: false }, // Sunday 01.03. belongs to this week
      { key: "2026-03-02", minutes: 100, estimated: false },
      { key: "2026-03-09", minutes: 90, estimated: false },
    ]);
    const months = playtimeSeries(lib.days, { from: "2025-12-15", to: "2026-03-31" }, "month");
    expect(months.map((p) => [p.key, p.minutes])).toEqual([
      ["2025-12", 0],
      ["2026-01", 0],
      ["2026-02", 0],
      ["2026-03", 250],
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

describe("pileOfShame", () => {
  it("lists owned, barely played games that are not finished or hidden", () => {
    expect(pileOfShame(lib.games, 60).map((g) => g.id)).toEqual(["g-hk"]);
    // Peggle is not owned any more, YouTube is hidden
    expect(pileOfShame(lib.games, 100_000).map((g) => g.id)).toEqual(["g-hk", "g-mc"]);
  });

  it("respects status and the per-game opt-out", () => {
    const data = raw();
    data.userData[1] = { ...data.userData[1]!, status: "completed" };
    expect(pileOfShame(buildLibrary(data).games, 60)).toEqual([]);
    data.userData[1] = { ...data.userData[1]!, status: null, hide_from_pile: true };
    expect(pileOfShame(buildLibrary(data).games, 60)).toEqual([]);
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
