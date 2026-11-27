import { describe, expect, it } from "vitest";
import {
  achievementKey,
  achievementPlatforms,
  achievementSummary,
  dedupeSharedTrophyLists,
  mergeAchievements,
  rareUnlocks,
  recentUnlocks,
  shownEntries,
} from "./achievements";
import { isRare, readRareLimit } from "./rare";
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

describe("dedupeSharedTrophyLists", () => {
  const entry = (id: string, unlocked: number, total: number) => ({
    id, game_id: "g", platform: "psn" as const, source: "psn", external_id: id, title: "Game", cover_url: null, device_kind: "ps5" as const,
    owned: true, first_played_at: null, last_played_at: null, total_playtime_minutes: 60, achievements_unlocked: unlocked, achievements_total: total,
  });
  const trophy = (entryId: string, list: string, n: number, unlocked: boolean): AchievementRow => ({
    platform_game_id: entryId, external_id: `${list}:${n}`, name: `T${n}`, description: null, icon_url: null,
    unlocked_at: unlocked ? "2026-05-01T10:00:00Z" : null, rarity_percent: 10, tier: "bronze",
  });
  const raw = (achievements: AchievementRow[], entries = [entry("ps4", 2, 3), entry("ps5", 2, 3)]): RawData => ({
    games: [{ id: "g", title: "Game", cover_url: null, genres: [], release_year: null, igdb_id: null }],
    platformGames: entries, devices: [], daily: [], snapshots: [], achievements, userData: [], connections: [], settings: {},
  });

  it("counts a list shared by the PS4 and PS5 version once", () => {
    const shared = [0, 1, 2].flatMap((n) => [trophy("ps4", "NPWR1_00", n, n < 2), trophy("ps5", "NPWR1_00", n, n < 2)]);
    const out = dedupeSharedTrophyLists(raw(shared));
    expect(out.achievements).toHaveLength(3);
    const game = buildLibrary(out).games[0]!;
    expect(game.achievements).toEqual({ unlocked: 2, total: 3 });
    expect(achievementSummary([game], "all", out.achievements)).toMatchObject({ unlocked: 2, total: 3 });
    expect(achievementSummary([game], "psn", out.achievements).rows).toHaveLength(1);
  });

  it("leaves separate lists of two versions alone", () => {
    const separate = [0, 1, 2].flatMap((n) => [trophy("ps4", "NPWR1_00", n, n < 2), trophy("ps5", "NPWR2_00", n, n < 2)]);
    const input = raw(separate);
    expect(dedupeSharedTrophyLists(input)).toBe(input);
  });
});

describe("achievements page lists", () => {
  const rows = [
    ach("hk-steam", 1, "Erster Schritt", "2026-01-01T10:00:00Z", 80),
    ach("hk-psn", 1, "ERSTER SCHRITT ", "2026-01-03T10:00:00Z", 60),
    ach("hk-steam", 2, "Pantheon", "2026-02-01T10:00:00Z", 2.5),
    ach("hk-psn", 2, "Pantheon", "2026-02-05T10:00:00Z", 1.5),
    ach("astro", 1, "Retter", "2026-03-01T10:00:00Z", 4),
    ach("astro", 2, "Gesperrt", null, 1),
    ach("yt", 1, "App", "2026-03-02T10:00:00Z", 1),
  ];

  it("shows every entry of a game for «all», one entry for a platform", () => {
    const all = shownEntries(achievementSummary(library.games, "all", rows).rows, "all");
    expect([...all.keys()].sort()).toEqual(["astro", "hk-psn", "hk-steam"]);
    const psn = shownEntries(achievementSummary(library.games, "psn", rows).rows, "psn");
    expect([...psn.keys()].sort()).toEqual(["astro", "hk-psn"]);
    expect(psn.get("astro")?.game.id).toBe("g-ps");
  });

  it("lists the latest unlocks of the shown entries", () => {
    const shown = shownEntries(achievementSummary(library.games, "all", rows).rows, "all");
    expect(recentUnlocks(rows, shown, 2).map((a) => a.name)).toEqual(["Retter", "Pantheon"]);
  });

  it("lists rare unlocks once per game and name, with the lower share, rarest first", () => {
    const shown = shownEntries(achievementSummary(library.games, "all", rows).rows, "all");
    const rare = rareUnlocks(rows, shown, (p) => isRare(p, "5"));
    expect(rare.map((a) => [a.name, a.rarity_percent])).toEqual([
      ["Pantheon", 1.5],
      ["Retter", 4],
    ]);
  });
});

describe("rare limit", () => {
  it("reads the stored limit or falls back to 10 %", () => {
    expect(readRareLimit({ rareLimit: "3" })).toBe("3");
    expect(readRareLimit({ rareLimit: "7" })).toBe("10");
    expect(readRareLimit({})).toBe("10");
  });

  it("counts «<1» as below one percent and unknown shares as not rare", () => {
    expect(isRare(1, "1")).toBe(true);
    expect(isRare(1, "<1")).toBe(false);
    expect(isRare(0.5, "<1")).toBe(true);
    expect(isRare(null, "10")).toBe(false);
  });
});
