import { describe, expect, it } from "vitest";
import { achievementKey, achievementPlatforms, achievementSummary, mergeAchievements } from "./achievements";
import { buildLibrary, type AchievementRow, type RawData } from "./library";

type Entry = RawData["platformGames"][number];

function entry(id: string, gameId: string, platform: Entry["platform"], unlocked: number | null, total: number | null): Entry {
  return {
    id, game_id: gameId, platform, source: platform, external_id: id, title: id, cover_url: null,
    device_kind: platform === "steam" ? "pc" : platform === "psn" ? "ps5" : null, owned: true,
    first_played_at: null, last_played_at: null, total_playtime_minutes: 60,
    achievements_unlocked: unlocked, achievements_total: total,
  };
}

function ach(entryId: string, n: number, name: string, unlockedAt: string | null, rarity: number | null = null): AchievementRow {
  return { platform_game_id: entryId, external_id: String(n), name, description: null, icon_url: null, unlocked_at: unlockedAt, rarity_percent: rarity, tier: null };
}

const library = buildLibrary({
  games: [
    { id: "g-both", title: "Hollow Knight", cover_url: null, genres: [], release_year: null, igdb_id: null },
    { id: "g-ps", title: "Astro Bot", cover_url: null, genres: [], release_year: null, igdb_id: null },
    { id: "g-app", title: "YouTube", cover_url: null, genres: [], release_year: null, igdb_id: null },
    { id: "g-nin", title: "Kirby", cover_url: null, genres: [], release_year: null, igdb_id: null },
  ],
  platformGames: [
    entry("hk-steam", "g-both", "steam", 2, 3),
    entry("hk-psn", "g-both", "psn", 2, 4),
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

// Hollow Knight: «Falsche Ritter» on both platforms (PC only unlocked), «Mantis» on both
// (PS only unlocked), «Grimm» only on PC (locked), and the platinum trophy only on PS.
const HK: AchievementRow[] = [
  ach("hk-steam", 1, "Falsche Ritter", "2026-01-02T10:00:00Z", 40),
  ach("hk-steam", 2, "MANTIS-LORDS!", null, 20),
  ach("hk-steam", 3, "Grimm", "2026-01-05T10:00:00Z"),
  ach("hk-psn", 1, "Falsche Ritter", null, 35),
  ach("hk-psn", 2, "Mantis Lords", "2026-02-01T10:00:00Z", 25),
  ach("hk-psn", 3, "Hollow Knight Platin", null),
  ach("hk-psn", 4, "Grimm", "2026-01-04T10:00:00Z"),
];

describe("achievements per platform", () => {
  it("keeps PC and PlayStation apart: a trophy does not unlock the Steam achievement", () => {
    const pc = achievementSummary(library.games, "steam", HK);
    expect(pc.rows.map((r) => r.key)).toEqual(["hk-steam"]);
    expect([pc.unlocked, pc.total, pc.games]).toEqual([2, 3, 1]);

    const ps = achievementSummary(library.games, "psn", HK);
    expect(ps.rows.map((r) => r.key)).toEqual(["hk-psn", "astro"]); // best share first
    expect([ps.unlocked, ps.total, ps.games]).toEqual([5, 34, 2]);
  });

  it("joins the same achievement on both platforms: unlocked if it is on either", () => {
    const all = achievementSummary(library.games, "all", HK);
    const hk = all.rows.find((r) => r.game.id === "g-both")!;
    // Falsche Ritter, Mantis Lords, Grimm, Platin = 4, of which 3 unlocked somewhere
    expect([hk.unlocked, hk.total, hk.platforms]).toEqual([3, 4, ["steam", "psn"]]);
    expect([all.unlocked, all.total, all.games]).toEqual([6, 34, 2]);
  });

  it("adds the counts up when a list is not stored completely", () => {
    const all = achievementSummary(library.games, "all", HK.slice(0, 5));
    const hk = all.rows.find((r) => r.game.id === "g-both")!;
    expect([hk.unlocked, hk.total]).toEqual([4, 7]);
  });

  it("leaves out entries marked as not a game and platforms without achievements", () => {
    expect(achievementSummary(library.games, "all").rows.some((r) => r.game.id === "g-app" || r.game.id === "g-nin")).toBe(false);
    expect(achievementPlatforms(library.games)).toEqual(["steam", "psn"]);
  });
});

describe("mergeAchievements", () => {
  const platformOf = new Map([["hk-steam", "steam"], ["hk-psn", "psn"]] as const);

  it("matches names regardless of case and punctuation, keeps the earliest unlock and the rarest share", () => {
    expect(achievementKey("MANTIS-LORDS!")).toBe(achievementKey("Mantis Lords"));
    const merged = mergeAchievements(HK, platformOf);
    expect(merged.map((m) => [m.name, m.platforms, m.unlockedOn])).toEqual([
      ["Falsche Ritter", ["steam", "psn"], ["steam"]],
      ["MANTIS-LORDS!", ["steam", "psn"], ["psn"]],
      ["Grimm", ["steam", "psn"], ["steam", "psn"]],
      ["Hollow Knight Platin", ["psn"], []],
    ]);
    const grimm = merged.find((m) => m.name === "Grimm")!;
    expect(grimm.unlockedAt).toBe("2026-01-04T10:00:00Z");
    expect(merged[0]!.rarityPercent).toBe(35);
  });

  it("never joins two achievements of the same platform", () => {
    const twins = [ach("hk-psn", 1, "Grimm", null), ach("hk-psn", 2, "Grimm", null), ach("hk-steam", 1, "Grimm", null)];
    expect(mergeAchievements(twins, platformOf).map((m) => m.platforms)).toEqual([["psn", "steam"], ["psn"]]);
  });
});
