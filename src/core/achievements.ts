// Achievements per platform. Steam achievements and PlayStation trophies are separate lists:
// a trophy never unlocks the Steam achievement of the same game, and the other way round.
import type { LibraryGame, PlatformEntry } from "./library";
import type { PlatformId } from "./types";

/** «all» = every platform, each counted on its own. */
export type AchievementFilter = "all" | PlatformId;

export interface AchievementRow {
  game: LibraryGame;
  entry: PlatformEntry & { achievements: { unlocked: number; total: number } };
}

export interface AchievementSummary {
  rows: AchievementRow[];
  unlocked: number;
  total: number;
  /** Games with at least one row (a game on PC and PS counts once). */
  games: number;
}

const hasAchievements = (e: PlatformEntry): e is AchievementRow["entry"] => !!e.achievements && e.achievements.total > 0;

/** Platforms that have achievements in the library, in a fixed order. */
export function achievementPlatforms(games: readonly LibraryGame[]): PlatformId[] {
  const found = new Set(games.flatMap((g) => g.entries.filter(hasAchievements).map((e) => e.platform)));
  return (["steam", "psn"] as PlatformId[]).filter((p) => found.has(p)).concat([...found].filter((p) => p !== "steam" && p !== "psn"));
}

/** Rows sorted by share unlocked, best first. Hidden entries («Kein Spiel») are left out. */
export function achievementSummary(games: readonly LibraryGame[], filter: AchievementFilter): AchievementSummary {
  const rows: AchievementRow[] = games
    .filter((g) => !g.hidden)
    .flatMap((g) =>
      g.entries.filter(hasAchievements).filter((e) => filter === "all" || e.platform === filter).map((entry) => ({ game: g, entry })),
    )
    .sort(
      (a, b) =>
        b.entry.achievements.unlocked / b.entry.achievements.total - a.entry.achievements.unlocked / a.entry.achievements.total ||
        a.game.title.localeCompare(b.game.title, "de"),
    );
  return {
    rows,
    unlocked: rows.reduce((s, r) => s + r.entry.achievements.unlocked, 0),
    total: rows.reduce((s, r) => s + r.entry.achievements.total, 0),
    games: new Set(rows.map((r) => r.game.id)).size,
  };
}
