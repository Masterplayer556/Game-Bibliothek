// Achievements per platform, and the same achievement on PC and PlayStation joined.
//
// Steam achievements and PlayStation trophies are separate lists: a trophy never unlocks the
// Steam achievement. For «Zusammen» the two lists of one game are joined by name (both are
// read in German): an achievement counts as unlocked if it is unlocked on either platform.
// Achievements without a twin (e.g. the platinum trophy) stay on their own.
import { compareTitles, type AchievementRow as RawAchievement, type LibraryGame, type PlatformEntry, type RawData } from "./library";
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
 * The rows of one game grouped into achievements: the same name on several platforms is one
 * achievement. Within one platform nothing is joined, even if two achievements share a name.
 * Rows of entries without a platform in `platformOf` are left out.
 */
export function groupTwins(
  rows: readonly RawAchievement[],
  platformOf: ReadonlyMap<string, PlatformId>,
): { key: string; rows: { row: RawAchievement; platform: PlatformId }[] }[] {
  const groups: { key: string; rows: { row: RawAchievement; platform: PlatformId }[]; platforms: Set<PlatformId> }[] = [];
  const open = new Map<string, typeof groups>();
  for (const row of rows) {
    const platform = platformOf.get(row.platform_game_id);
    if (!platform) continue;
    const key = achievementKey(row.name) || `${row.platform_game_id}:${row.external_id}`;
    const candidates = open.get(key) ?? [];
    let group = candidates.find((g) => !g.platforms.has(platform));
    if (!group) {
      group = { key: `${key}#${candidates.length}`, rows: [], platforms: new Set() };
      candidates.push(group);
      open.set(key, candidates);
      groups.push(group);
    }
    group.platforms.add(platform);
    group.rows.push({ row, platform });
  }
  return groups.map(({ key, rows }) => ({ key, rows }));
}

/** Joins the achievements of several platform entries of one game by name (see groupTwins). */
export function mergeAchievements(
  rows: readonly RawAchievement[],
  platformOf: ReadonlyMap<string, PlatformId>,
): MergedAchievement[] {
  return groupTwins(rows, platformOf).map(({ key, rows: twins }) => {
    const unlocked = twins.filter((t) => t.row.unlocked_at);
    const rarities = twins.map((t) => t.row.rarity_percent).filter((r): r is number => r != null);
    return {
      key,
      name: twins[0]!.row.name,
      description: twins.find((t) => t.row.description != null)?.row.description ?? null,
      iconUrl: twins.find((t) => t.row.icon_url != null)?.row.icon_url ?? null,
      platforms: twins.map((t) => t.platform),
      unlockedOn: unlocked.map((t) => t.platform),
      unlockedAt: unlocked.reduce<string | null>((min, t) => (!min || t.row.unlocked_at! < min ? t.row.unlocked_at! : min), null),
      rarityPercent: rarities.length > 0 ? Math.min(...rarities) : null,
    };
  });
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
  rows.sort((a, b) => b.unlocked / b.total - a.unlocked / a.total || compareTitles(a.game.title, b.game.title));
  return {
    rows,
    unlocked: rows.reduce((s, r) => s + r.unlocked, 0),
    total: rows.reduce((s, r) => s + r.total, 0),
    games: new Set(rows.map((r) => r.game.id)).size,
  };
}

/** A platform entry shown on the achievements page, with its game. */
export interface ShownEntry {
  game: LibraryGame;
  platform: PlatformId;
}

/**
 * The platform entries behind the progress rows: for «all» every entry of the row's platforms,
 * for one platform only the entry of that row.
 */
export function shownEntries(rows: readonly ProgressRow[], filter: AchievementFilter): Map<string, ShownEntry> {
  return new Map(
    rows.flatMap((r) =>
      r.game.entries
        .filter((e) => r.platforms.includes(e.platform) && (filter === "all" || e.id === r.key))
        .map((e) => [e.id, { game: r.game, platform: e.platform }] as const),
    ),
  );
}

/** The latest unlocks of the shown entries, newest first. */
export function recentUnlocks(
  achievements: readonly RawAchievement[],
  entries: ReadonlyMap<string, unknown>,
  limit: number,
): RawAchievement[] {
  return achievements
    .filter((a) => a.unlocked_at && entries.has(a.platform_game_id))
    .sort((a, b) => (b.unlocked_at ?? "").localeCompare(a.unlocked_at ?? ""))
    .slice(0, limit);
}

/**
 * Rare achievements I have, rarest first. The same achievement of one game on PC and
 * PlayStation (same name) appears once, with the lower share.
 */
export function rareUnlocks(
  achievements: readonly RawAchievement[],
  entries: ReadonlyMap<string, ShownEntry>,
  isRare: (percent: number | null) => boolean,
): RawAchievement[] {
  const byKey = new Map<string, RawAchievement>();
  for (const a of achievements) {
    const entry = entries.get(a.platform_game_id);
    if (!a.unlocked_at || !entry || !isRare(a.rarity_percent)) continue;
    const key = `${entry.game.id}|${a.name.trim().toLowerCase()}`;
    const known = byKey.get(key);
    if (!known || (a.rarity_percent ?? 100) < (known.rarity_percent ?? 100)) byKey.set(key, a);
  }
  return [...byKey.values()].sort((a, b) => (a.rarity_percent ?? 100) - (b.rarity_percent ?? 100));
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
