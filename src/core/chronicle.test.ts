import { describe, expect, it } from "vitest";
import { buildChronicle, chronicleYears } from "./chronicle";
import { buildLibrary, type RawData } from "./library";

function raw(): RawData {
  return {
    games: [
      { id: "g-a", title: "Alpha", cover_url: null, genres: [], release_year: null, igdb_id: null },
      { id: "g-b", title: "Beta", cover_url: null, genres: [], release_year: null, igdb_id: null },
      { id: "g-c", title: "Gamma", cover_url: null, genres: [], release_year: null, igdb_id: null },
      { id: "g-app", title: "YouTube", cover_url: null, genres: [], release_year: null, igdb_id: null },
      { id: "g-d", title: "Delta", cover_url: null, genres: [], release_year: null, igdb_id: null },
      { id: "g-e", title: "Epsilon", cover_url: null, genres: [], release_year: null, igdb_id: null },
      { id: "g-f", title: "Phi", cover_url: null, genres: [], release_year: null, igdb_id: null },
      { id: "g-g", title: "Gamma Two", cover_url: null, genres: [], release_year: null, igdb_id: null },
    ],
    platformGames: [
      // Alpha: Switch, per-day data from the start (no time before tracking)
      { id: "p-a", game_id: "g-a", platform: "nintendo", source: "nintendo-parental", external_id: "a", title: "Alpha", cover_url: null, device_kind: null, owned: true, first_played_at: null, last_played_at: null, total_playtime_minutes: 800, achievements_unlocked: null, achievements_total: null },
      // Beta: PS5, 400 minutes before tracking, two trophies incl. platinum
      { id: "p-b", game_id: "g-b", platform: "psn", source: "psn", external_id: "b", title: "Beta", cover_url: null, device_kind: "ps5", owned: true, first_played_at: "2024-01-05T10:00:00Z", last_played_at: null, total_playtime_minutes: 700, achievements_unlocked: 2, achievements_total: 2 },
      // Gamma: Steam, all achievements, one of them rare
      { id: "p-c", game_id: "g-c", platform: "steam", source: "steam", external_id: "c", title: "Gamma", cover_url: null, device_kind: "pc", owned: true, first_played_at: null, last_played_at: null, total_playtime_minutes: 5000, achievements_unlocked: 2, achievements_total: 2 },
      // Delta: owned on Steam with 0 minutes at the first sync, played later
      { id: "p-d", game_id: "g-d", platform: "steam", source: "steam", external_id: "d", title: "Delta", cover_url: null, device_kind: "pc", owned: true, first_played_at: null, last_played_at: "2025-04-01T18:00:00Z", total_playtime_minutes: 120, achievements_unlocked: null, achievements_total: null },
      // Gamma Two: already 27 hours on Steam at the first sync
      { id: "p-g", game_id: "g-g", platform: "steam", source: "steam", external_id: "g", title: "Gamma Two", cover_url: null, device_kind: "pc", owned: true, first_played_at: null, last_played_at: "2025-04-02T18:00:00Z", total_playtime_minutes: 1680, achievements_unlocked: null, achievements_total: null },
      // Epsilon: first seen on the Switch after tracking began
      { id: "p-e", game_id: "g-e", platform: "nintendo", source: "nintendo-parental", external_id: "e", title: "Epsilon", cover_url: null, device_kind: null, owned: true, first_played_at: null, last_played_at: null, total_playtime_minutes: 60, achievements_unlocked: null, achievements_total: null },
      // Phi: also new on the Switch, but its history was imported afterwards
      { id: "p-f", game_id: "g-f", platform: "nintendo", source: "nintendo-parental", external_id: "f", title: "Phi", cover_url: null, device_kind: null, owned: true, first_played_at: null, last_played_at: null, total_playtime_minutes: 90, achievements_unlocked: null, achievements_total: null },
      { id: "p-app", game_id: "g-app", platform: "nintendo", source: "nintendo-parental", external_id: "yt", title: "YouTube", cover_url: null, device_kind: null, owned: true, first_played_at: null, last_played_at: null, total_playtime_minutes: 900, achievements_unlocked: null, achievements_total: null },
    ],
    devices: [
      { id: "d-s1", platform: "nintendo", kind: "switch1", label: "Switch" },
      { id: "d-s2", platform: "nintendo", kind: "switch2", label: "Switch 2" },
      { id: "d-ps5", platform: "psn", kind: "ps5", label: "PS5" },
    ],
    daily: [
      { platform_game_id: "p-a", device_id: "d-s1", play_date: "2025-01-10", minutes: 300, source: "x", estimated: false },
      { platform_game_id: "p-a", device_id: "d-s1", play_date: "2025-02-01", minutes: 400, source: "x", estimated: true },
      { platform_game_id: "p-a", device_id: "d-s2", play_date: "2025-06-13", minutes: 100, source: "x", estimated: false },
      { platform_game_id: "p-b", device_id: "d-ps5", play_date: "2025-03-01", minutes: 150, source: "x", estimated: false },
      { platform_game_id: "p-b", device_id: "d-ps5", play_date: "2025-03-02", minutes: 150, source: "x", estimated: false },
      { platform_game_id: "p-app", device_id: "d-s2", play_date: "2025-07-01", minutes: 900, source: "x", estimated: false },
      { platform_game_id: "p-e", device_id: "d-s2", play_date: "2025-07-02", minutes: 60, source: "nintendo-parental", estimated: false },
      { platform_game_id: "p-f", device_id: "d-s2", play_date: "2025-07-03", minutes: 30, source: "nintendo-parental", estimated: false },
      { platform_game_id: "p-f", device_id: "d-s1", play_date: "2023-02-01", minutes: 60, source: "nintendo-import", estimated: false },
    ],
    snapshots: [
      { platform_game_id: "p-d", taken_at: "2025-01-01T06:00:00Z", total_minutes: 0, last_played_at: null },
      { platform_game_id: "p-d", taken_at: "2025-04-01T20:00:00Z", total_minutes: 120, last_played_at: "2025-04-01T18:00:00Z" },
      { platform_game_id: "p-g", taken_at: "2025-01-01T06:00:00Z", total_minutes: 1500, last_played_at: null },
      { platform_game_id: "p-g", taken_at: "2025-04-02T20:00:00Z", total_minutes: 1680, last_played_at: "2025-04-02T18:00:00Z" },
    ],
    achievements: [
      { platform_game_id: "p-b", external_id: "1", name: "Erster Schritt", description: null, icon_url: null, unlocked_at: "2025-03-01T20:00:00Z", rarity_percent: 50, tier: "bronze" },
      { platform_game_id: "p-b", external_id: "2", name: "Alles", description: null, icon_url: null, unlocked_at: "2025-03-02T20:00:00Z", rarity_percent: 2, tier: "platinum" },
      { platform_game_id: "p-c", external_id: "1", name: "Anfang", description: null, icon_url: null, unlocked_at: "2024-05-01T10:00:00Z", rarity_percent: 80, tier: null },
      { platform_game_id: "p-c", external_id: "2", name: "Meister", description: null, icon_url: null, unlocked_at: "2024-06-01T10:00:00Z", rarity_percent: 3.5, tier: null },
    ],
    userData: [{ game_id: "g-app", status: null, favorite: false, note: null, hide_from_pile: false, hidden: true, rating: null, completed_on: null }],
    connections: [],
    settings: {},
  };
}

const data = raw();
const library = buildLibrary(data);
const events = buildChronicle(library, data, { isRare: (p) => p != null && p <= 10 });
const ids = events.map((e) => e.id);

describe("buildChronicle", () => {
  it("shows «first played» only for games that are new since tracking began", () => {
    const starts = events.filter((e) => e.kind === "start").map((e) => [e.gameId, e.date]);
    expect(starts).toEqual([
      ["g-e", "2025-07-02"], // first seen on the Switch after tracking began
      ["g-d", "2025-04-01"], // 0 minutes at the first sync
    ]);
    // Not: games played on the first synced day (Alpha, Beta), with time before (Gamma, Gamma Two),
    // or with imported history (Phi, even though it first showed up as new)
  });

  it("puts milestones on the day the total passed the mark, counting time before tracking", () => {
    const a = events.find((e) => e.id === "milestone-g-a-10")!;
    expect(a.date).toBe("2025-02-01");
    expect(a.estimated).toBe(true);
    // Beta: 400 minutes before tracking + 150 + 150 → past 10 hours on the second day
    expect(events.find((e) => e.id === "milestone-g-b-10")?.date).toBe("2025-03-02");
    // Gamma passed every mark before tracking: no dates to show
    expect(ids.some((id) => id.startsWith("milestone-g-c"))).toBe(false);
  });

  it("shows a platinum instead of «all achievements» on the same day, and rare ones apart", () => {
    expect(events.find((e) => e.kind === "platinum")).toMatchObject({ gameId: "g-b", date: "2025-03-02" });
    expect(ids).not.toContain("complete-p-b");
    expect(events.find((e) => e.id === "complete-p-c")).toMatchObject({ date: "2024-06-01", count: 2 });
    const rare = events.filter((e) => e.kind === "rare");
    expect(rare.map((e) => e.achievement?.name)).toEqual(["Meister"]);
  });

  it("marks the first day on a console only after tracking had begun", () => {
    expect(events.filter((e) => e.kind === "device")).toEqual([
      { id: "device-switch2", kind: "device", date: "2025-06-13", device: "switch2", platform: "nintendo", gameId: "g-a" },
    ]);
    expect(events.filter((e) => e.kind === "tracking").map((e) => [e.platform, e.date])).toEqual([
      ["psn", "2025-03-01"],
      ["steam", "2025-01-01"],
      ["nintendo", "2023-02-01"],
    ]);
  });

  it("leaves out apps and sorts newest first", () => {
    expect(events.some((e) => e.gameId === "g-app")).toBe(false);
    const dates = events.map((e) => e.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

describe("finished games", () => {
  it("adds «Durchgespielt» on the entered day, not for apps", () => {
    const withDays = {
      ...data,
      userData: [
        { game_id: "g-app", status: null, favorite: false, note: null, hide_from_pile: false, hidden: true, rating: 3, completed_on: "2025-05-01" },
        { game_id: "g-b", status: "completed" as const, favorite: false, note: null, hide_from_pile: false, hidden: false, rating: 5, completed_on: "2025-03-02" },
      ],
    };
    const finished = buildChronicle(buildLibrary(withDays), withDays, { isRare: () => false }).filter((e) => e.kind === "finished");
    expect(finished.map((e) => [e.gameId, e.date])).toEqual([["g-b", "2025-03-02"]]);
    // On the same day as the platinum, it comes first.
    const sameDay = buildChronicle(buildLibrary(withDays), withDays, { isRare: () => false }).filter((e) => e.date === "2025-03-02");
    expect(sameDay[0]!.kind).toBe("finished");
  });
});

describe("chronicleYears", () => {
  it("sums each year's played days, newest first", () => {
    const years = chronicleYears(library);
    expect(years.map((y) => y.year)).toEqual([2025, 2023]);
    expect(years[0]).toMatchObject({ topGameId: "g-a" });
    expect(years[1]).toMatchObject({ minutes: 60, playDays: 1, topGameId: "g-f" });
  });
});
