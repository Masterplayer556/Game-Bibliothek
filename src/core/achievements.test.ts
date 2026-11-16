import { describe, expect, it } from "vitest";
import { achievementPlatforms, achievementSummary } from "./achievements";
import { buildLibrary, type RawData } from "./library";

type Entry = RawData["platformGames"][number];

function entry(id: string, gameId: string, platform: Entry["platform"], unlocked: number | null, total: number | null): Entry {
  return {
    id, game_id: gameId, platform, source: platform, external_id: id, title: id, cover_url: null,
    device_kind: platform === "steam" ? "pc" : platform === "psn" ? "ps5" : null, owned: true,
    first_played_at: null, last_played_at: null, total_playtime_minutes: 60,
    achievements_unlocked: unlocked, achievements_total: total,
  };
}

const library = buildLibrary({
  games: [
    { id: "g-both", title: "Hollow Knight", cover_url: null, genres: [], release_year: null, igdb_id: null },
    { id: "g-ps", title: "Astro Bot", cover_url: null, genres: [], release_year: null, igdb_id: null },
    { id: "g-app", title: "YouTube", cover_url: null, genres: [], release_year: null, igdb_id: null },
    { id: "g-nin", title: "Kirby", cover_url: null, genres: [], release_year: null, igdb_id: null },
  ],
  platformGames: [
    entry("hk-steam", "g-both", "steam", 10, 20),
    entry("hk-psn", "g-both", "psn", 15, 15),
    entry("astro", "g-ps", "psn", 3, 30),
    entry("yt", "g-app", "psn", 1, 2),
    entry("kirby", "g-nin", "nintendo", null, null),
  ],
  devices: [],
  daily: [],
  snapshots: [],
  achievements: [],
  userData: [{ game_id: "g-app", status: null, favorite: false, note: null, hide_from_pile: false, hidden: true }],
  connections: [],
  settings: {},
});

describe("achievements per platform", () => {
  it("keeps PC and PlayStation apart: a trophy does not unlock the Steam achievement", () => {
    const pc = achievementSummary(library.games, "steam");
    expect(pc.rows.map((r) => r.entry.id)).toEqual(["hk-steam"]);
    expect([pc.unlocked, pc.total, pc.games]).toEqual([10, 20, 1]);

    const ps = achievementSummary(library.games, "psn");
    expect(ps.rows.map((r) => r.entry.id)).toEqual(["hk-psn", "astro"]); // best share first
    expect([ps.unlocked, ps.total, ps.games]).toEqual([18, 45, 2]);
  });

  it("adds both up for «all», counting a game on two platforms once", () => {
    const all = achievementSummary(library.games, "all");
    expect([all.unlocked, all.total, all.rows.length, all.games]).toEqual([28, 65, 3, 2]);
  });

  it("leaves out entries marked as not a game and platforms without achievements", () => {
    expect(achievementSummary(library.games, "all").rows.some((r) => r.game.id === "g-app" || r.game.id === "g-nin")).toBe(false);
    expect(achievementPlatforms(library.games)).toEqual(["steam", "psn"]);
  });
});
