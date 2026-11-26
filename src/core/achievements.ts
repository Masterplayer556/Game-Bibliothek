// Achievements per platform, and the same achievement on PC and PlayStation joined.
//
// Steam achievements and PlayStation trophies are separate lists: a trophy never unlocks the
// Steam achievement. For «Zusammen» the two lists of one game are joined by name (both are
// read in German): an achievement counts as unlocked if it is unlocked on either platform.
// Achievements without a twin (e.g. the platinum trophy) stay on their own.
import type { AchievementRow as RawAchievement, LibraryGame, PlatformEntry, RawData } from "./library";
import type { PlatformId } from "./types";

/** «all» = PC and PlayStation joined. */
export type AchievementFilter = "all" | PlatformId;

export interface MergedAchievement {
  key: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  /** Platforms that have this achievement. */
  platforms: PlatformId[];
  /** Platforms on which it is unlocked. */
  unlockedOn: PlatformId[];
  /** Earliest unlock on any platform. */
  unlockedAt: string | null;
  /** Lowest share of players (rarest platform), if known. */
  rarityPercent: number | null;
}

export interface ProgressRow {
  key: string;
  game: LibraryGame;
  platforms: PlatformId[];
  unlocked: number;
  total: number;
}

export interface AchievementSummary {
  rows: ProgressRow[];
  unlocked: number;
  total: number;
  /** Games with at least one row. */
  games: number;
}

type EntryWithAchievements = PlatformEntry & { achievements: { unlocked: number; total: number } };
const hasAchievements = (e: PlatformEntry): e is EntryWithAchievements => !!e.achievements && e.achievements.total > 0;

/** Lower case letters and digits only: «KENNE DEINEN PARTNER» = «Kenne deinen Partner!». */
export function achievementKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * Joins the achievements of several platform entries of one game by name. Within one
 * platform nothing is joined, even if two achievements share a name.
 */
export function mergeAchievements(
  rows: readonly RawAchievement[],
  platformOf: ReadonlyMap<string, PlatformId>,
): MergedAchievement[] {
  const groups: (MergedAchievement & { byPlatform: Set<PlatformId> })[] = [];
  const open = new Map<string, (typeof groups)[number][]>();
  for (const row of rows) {
    const platform = platformOf.get(row.platform_game_id);
    if (!platform) continue;
    const key = achievementKey(row.name) || `${row.platform_game_id}:${row.external_id}`;
    const candidates = open.get(key) ?? [];
    let group = candidates.find((g) => !g.byPlatform.has(platform));
    if (!group) {
      group = {
        key: `${key}#${candidates.length}`,
        name: row.name,
        description: row.description,
        iconUrl: row.icon_url,
        platforms: [],
        unlockedOn: [],
        unlockedAt: null,
        rarityPercent: null,
        byPlatform: new Set(),
      };
      candidates.push(group);
      open.set(key, candidates);
      groups.push(group);
    }
    group.byPlatform.add(platform);
    group.platforms.push(platform);
    group.description ??= row.description;
    group.iconUrl ??= row.icon_url;
    if (row.unlocked_at) {
      group.unlockedOn.push(platform);
      if (!group.unlockedAt || row.unlocked_at < group.unlockedAt) group.unlockedAt = row.unlocked_at;
    }
    if (row.rarity_percent != null) {
      group.rarityPercent = group.rarityPercent == null ? row.rarity_percent : Math.min(group.rarityPercent, row.rarity_percent);
    }
  }
  return groups.map((g) => ({
    key: g.key,
    name: g.name,
    description: g.description,
    iconUrl: g.iconUrl,
    platforms: g.platforms,
    unlockedOn: g.unlockedOn,
    unlockedAt: g.unlockedAt,
    rarityPercent: g.rarityPercent,
  }));
}

/** Platforms that have achievements in the library, PC first. */
export function achievementPlatforms(games: readonly LibraryGame[]): PlatformId[] {
  const found = new Set(games.flatMap((g) => g.entries.filter(hasAchievements).map((e) => e.platform)));
  const order: PlatformId[] = ["steam", "psn"];
  return [...order.filter((p) => found.has(p)), ...[...found].filter((p) => !order.includes(p))];
}

/**
 * Progress rows, best share first. One row per platform entry for a single platform; for
 * «all» one row per game, with PC and PlayStation joined where the achievement list is known.
 * Entries marked «Kein Spiel» are left out.
 */
export function achievementSummary(
  games: readonly LibraryGame[],
  filter: AchievementFilter,
  achievements: readonly RawAchievement[] = [],
): AchievementSummary {
  const byEntry = new Map<string, RawAchievement[]>();
  for (const a of achievements) {
    const list = byEntry.get(a.platform_game_id) ?? [];
    list.push(a);
    byEntry.set(a.platform_game_id, list);
  }

  const rows: ProgressRow[] = [];
  for (const game of games) {
    if (game.hidden) continue;
    const entries = game.entries.filter(hasAchievements);
    if (filter !== "all") {
      for (const e of entries.filter((x) => x.platform === filter)) {
        rows.push({ key: e.id, game, platforms: [e.platform], ...e.achievements });
      }
      continue;
    }
    if (entries.length === 0) continue;
    const platforms = [...new Set(entries.map((e) => e.platform))];
    // Join only when every list is stored completely; otherwise add up the counts.
    const complete = entries.length > 1 && entries.every((e) => (byEntry.get(e.id)?.length ?? 0) === e.achievements.total);
    if (complete) {
      const merged = mergeAchievements(
        entries.flatMap((e) => byEntry.get(e.id)!),
        new Map(entries.map((e) => [e.id, e.platform] as const)),
      );
      rows.push({ key: game.id, game, platforms, unlocked: merged.filter((m) => m.unlockedOn.length > 0).length, total: merged.length });
    } else {
      rows.push({
        key: game.id,
        game,
        platforms,
        unlocked: entries.reduce((s, e) => s + e.achievements.unlocked, 0),
        total: entries.reduce((s, e) => s + e.achievements.total, 0),
      });
    }
  }
  rows.sort((a, b) => b.unlocked / b.total - a.unlocked / a.total || a.game.title.localeCompare(b.game.title, "de"));
  return {
    rows,
    unlocked: rows.reduce((s, r) => s + r.unlocked, 0),
    total: rows.reduce((s, r) => s + r.total, 0),
    games: new Set(rows.map((r) => r.game.id)).size,
  };
}

/** The trophy list of a PlayStation trophy («NPWR12345_00:7» → «NPWR12345_00»). */
function trophyList(externalId: string): string | null {
  const cut = externalId.lastIndexOf(":");
  return cut > 0 ? externalId.slice(0, cut) : null;
}

/**
 * PS4 and PS5 versions of a game can share one trophy list (one list, one progress). Each
 * version is its own entry and stores the list, so it would count twice. Of the entries
 * sharing a list, the one with the most unlocked trophies keeps it; the others lose its rows
 * and its counts (null if nothing else is left). Separate lists of two versions stay as they are.
 */
export function dedupeSharedTrophyLists(raw: RawData): RawData {
  const psn = new Set(raw.platformGames.filter((e) => e.platform === "psn").map((e) => e.id));
  const byList = new Map<string, Map<string, RawAchievement[]>>();
  for (const a of raw.achievements) {
    if (!psn.has(a.platform_game_id)) continue;
    const list = trophyList(a.external_id);
    if (!list) continue;
    const entries = byList.get(list) ?? new Map<string, RawAchievement[]>();
    const rows = entries.get(a.platform_game_id) ?? [];
    rows.push(a);
    entries.set(a.platform_game_id, rows);
    byList.set(list, entries);
  }

  const dropped = new Map<string, Set<string>>(); // entry → lists it loses
  const lost = new Map<string, { unlocked: number; total: number }>();
  for (const [list, entries] of byList) {
    if (entries.size < 2) continue;
    const ranked = [...entries.entries()].sort(
      (a, b) => b[1].filter((r) => r.unlocked_at).length - a[1].filter((r) => r.unlocked_at).length || a[0].localeCompare(b[0]),
    );
    for (const [entryId, rows] of ranked.slice(1)) {
      const lists = dropped.get(entryId) ?? new Set<string>();
      lists.add(list);
      dropped.set(entryId, lists);
      const sum = lost.get(entryId) ?? { unlocked: 0, total: 0 };
      sum.unlocked += rows.filter((r) => r.unlocked_at).length;
      sum.total += rows.length;
      lost.set(entryId, sum);
    }
  }
  if (dropped.size === 0) return raw;

  return {
    ...raw,
    achievements: raw.achievements.filter((a) => {
      const list = trophyList(a.external_id);
      return !(list && dropped.get(a.platform_game_id)?.has(list));
    }),
    platformGames: raw.platformGames.map((e) => {
      const minus = lost.get(e.id);
      if (!minus || e.achievements_total == null) return e;
      const total = e.achievements_total - minus.total;
      return total > 0
        ? { ...e, achievements_total: total, achievements_unlocked: Math.max(0, (e.achievements_unlocked ?? 0) - minus.unlocked) }
        : { ...e, achievements_total: null, achievements_unlocked: null };
    }),
  };
}
