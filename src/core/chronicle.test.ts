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
    ],
    platformGames: [
      // Alpha: Switch, per-day data from the start (no time before tracking)
      { id: "p-a", game_id: "g-a", platform: "nintendo", source: "nintendo-parental", external_id: "a", title: "Alpha", cover_url: null, device_kind: null, owned: true, first_played_at: null, last_played_at: null, total_playtime_minutes: 800, achievements_unlocked: null, achievements_total: null },
      // Beta: PS5, 400 minutes before tracking, two trophies incl. platinum
      { id: "p-b", game_id: "g-b", platform: "psn", source: "psn", external_id: "b", title: "Beta", cover_url: null, device_kind: "ps5", owned: true, first_played_at: "2024-01-05T10:00:00Z", last_played_at: null, total_playtime_minutes: 700, achievements_unlocked: 2, achievements_total: 2 },
      // Gamma: Steam, all achievements, one of them rare
      { id: "p-c", game_id: "g-c", platform: "steam", source: "steam", external_id: "c", title: "Gamma", cover_url: null, device_kind: "pc", owned: true, first_played_at: null, last_played_at: null, total_playtime_minutes: 5000, achievements_unlocked: 2, achievements_total: 2 },
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
    ],
    snapshots: [],
    achievements: [
      { platform_game_id: "p-b", external_id: "1", name: "Erster Schritt", description: null, icon_url: null, unlocked_at: "2025-03-01T20:00:00Z", rarity_percent: 50, tier: "bronze" },
      { platform_game_id: "p-b", external_id: "2", name: "Alles", description: null, icon_url: null, unlocked_at: "2025-03-02T20:00:00Z", rarity_percent: 2, tier: "platinum" },
      { platform_game_id: "p-c", external_id: "1", name: "Anfang", description: null, icon_url: null, unlocked_at: "2024-05-01T10:00:00Z", rarity_percent: 80, tier: null },
      { platform_game_id: "p-c", external_id: "2", name: "Meister", description: null, icon_url: null, unlocked_at: "2024-06-01T10:00:00Z", rarity_percent: 3.5, tier: null },
    ],
    userData: [{ game_id: "g-app", status: null, favorite: false, note: null, hide_from_pile: false, hidden: true }],
    connections: [],
    settings: {},
  };
}

const data = raw();
const library = buildLibrary(data);
const events = buildChronicle(library, data.achievements, { isRare: (p) => p != null && p <= 10 });
const ids = events.map((e) => e.id);

describe("buildChronicle", () => {
  it("starts games on their first date, or on the first day if nothing came before tracking", () => {
    expect(events.find((e) => e.id === "start-g-a")?.date).toBe("2025-01-10");
    expect(events.find((e) => e.id === "start-g-b")?.date).toBe("2024-01-05");
    // Gamma has time before tracking and no first date: its start is unknown
    expect(ids).not.toContain("start-g-c");
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
      ["nintendo", "2025-01-10"],
    ]);
  });

  it("leaves out apps and sorts newest first", () => {
    expect(events.some((e) => e.gameId === "g-app")).toBe(false);
    const dates = events.map((e) => e.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

describe("chronicleYears", () => {
  it("sums each year's played days, newest first", () => {
    const years = chronicleYears(library);
    expect(years.map((y) => y.year)).toEqual([2025]);
    expect(years[0]).toMatchObject({ minutes: 1100, playDays: 5, topGameId: "g-a" });
  });
});
