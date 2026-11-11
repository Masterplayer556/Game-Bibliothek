// Steam, official Web API. Lifetime playtime per game (snapshots are derived from it),
// last played, achievements with rarity.
import { getAdapterInfo } from "../../../src/core/adapter-catalog";
import { toLocalDate } from "../../../src/core/time";
import { emptyBatch, type AchievementInput } from "../../../src/core/types";
import {
  AdapterError,
  type AdapterContext,
  type PlatformAdapter,
  type SyncResult,
  type TestResult,
} from "../../types";
import {
  getGlobalPercentages,
  getOwnedGames,
  getPlayerAchievements,
  getSchemaAchievements,
  headerImageUrl,
  resolveSteamId,
  SteamApiError,
  type OwnedGame,
  type SteamOptions,
} from "./client";

export const STEAM_ID = "steam";

/** Achievements are read for at most this many games per run (first sync may take several). */
export const MAX_ACHIEVEMENT_GAMES_PER_RUN = 150;

function toAdapterError(error: unknown): AdapterError {
  if (error instanceof AdapterError) return error;
  if (error instanceof SteamApiError) {
    if (error.status === 401 || error.status === 403) return new AdapterError("auth_expired", error.message);
    if (error.status === 429) return new AdapterError("rate_limited", error.message);
    return new AdapterError(error.status === 0 ? "network" : "unknown", error.message);
  }
  return new AdapterError("unknown", "Unerwarteter Fehler beim Abruf der Steam-Daten.");
}

function options(ctx: AdapterContext): SteamOptions {
  return { fetch: ctx.fetch, apiKey: ctx.env.STEAM_API_KEY ?? "" };
}

function iso(unixSeconds: number): string | null {
  return unixSeconds > 0 ? new Date(unixSeconds * 1000).toISOString() : null;
}

/**
 * Achievements are expensive (three calls per game), so they are only read for games whose
 * playtime changed since the last run, and for every game with stats on the first run.
 */
export function gamesNeedingAchievements(games: readonly OwnedGame[], ctx: AdapterContext): OwnedGame[] {
  const firstRun = ctx.previousGames.size === 0;
  return games
    .filter((g) => g.hasStats && g.playtimeMinutes > 0)
    .filter((g) => {
      const previous = ctx.previousGames.get(String(g.appId));
      return firstRun || !previous || previous.totalPlaytimeMinutes !== g.playtimeMinutes;
    })
    .sort((a, b) => b.lastPlayed - a.lastPlayed);
}

export const steamAdapter: PlatformAdapter = {
  ...getAdapterInfo(STEAM_ID)!,

  async isConfigured(ctx) {
    return Boolean(ctx.env.STEAM_API_KEY && ctx.env.STEAM_ID);
  },

  async testConnection(ctx): Promise<TestResult> {
    try {
      const opts = options(ctx);
      const steamId = await resolveSteamId(opts, ctx.env.STEAM_ID ?? "");
      const games = await getOwnedGames(opts, steamId);
      const played = games.filter((g) => g.playtimeMinutes > 0).length;
      return { ok: true, message: `${games.length} Spiele gefunden, davon ${played} gespielt.` };
    } catch (error) {
      const adapterError = toAdapterError(error);
      return { ok: false, message: adapterError.message };
    }
  },

  async sync(ctx): Promise<SyncResult> {
    try {
      const opts = options(ctx);
      const steamId = await resolveSteamId(opts, ctx.env.STEAM_ID ?? "");
      const owned = await getOwnedGames(opts, steamId);
      const batch = emptyBatch("steam", STEAM_ID);
      const warnings: string[] = [];

      const due = gamesNeedingAchievements(owned, ctx);
      const now = due.slice(0, MAX_ACHIEVEMENT_GAMES_PER_RUN);
      if (due.length > now.length) warnings.push(`Erfolge von ${due.length - now.length} Spielen folgen beim nächsten Sync`);

      const progress = new Map<number, { unlocked: number; total: number } | null>();
      let failed = 0;
      for (const game of now) {
        try {
          const player = await getPlayerAchievements(opts, steamId, game.appId);
          if (!player || player.length === 0) {
            progress.set(game.appId, null);
            continue;
          }
          const [schema, rarity] = await Promise.all([
            getSchemaAchievements(opts, game.appId),
            getGlobalPercentages(opts, game.appId),
          ]);
          const bySchema = new Map(schema.map((s) => [s.apiName, s]));
          for (const a of player) {
            const info = bySchema.get(a.apiName);
            const achievement: AchievementInput = {
              gameExternalId: String(game.appId),
              externalId: a.apiName,
              name: info?.displayName ?? a.apiName,
              description: info?.description ?? null,
              iconUrl: info?.icon ?? null,
              unlockedAt: a.achieved && a.unlockTime > 0 ? iso(a.unlockTime) : null,
              rarityPercent: rarity.get(a.apiName) ?? null,
              hidden: info?.hidden ?? false,
            };
            batch.achievements.push(achievement);
          }
          progress.set(game.appId, { unlocked: player.filter((a) => a.achieved).length, total: player.length });
        } catch (error) {
          // A rate limit stops the whole run; anything else only skips this game.
          if (error instanceof SteamApiError && (error.status === 429 || error.status === 401 || error.status === 403)) {
            throw error;
          }
          failed++;
        }
      }
      if (failed > 0) warnings.push(`Erfolge von ${failed} Spielen nicht lesbar`);

      for (const game of owned) {
        const p = progress.get(game.appId);
        batch.games.push({
          externalId: String(game.appId),
          title: game.name,
          coverUrl: headerImageUrl(game.appId),
          deviceKind: "pc",
          owned: true,
          lastPlayedAt: iso(game.lastPlayed),
          totalPlaytimeMinutes: game.playtimeMinutes,
          // undefined = unchanged since the last run (keeps the stored value)
          achievementsUnlocked: p === undefined ? undefined : p ? p.unlocked : null,
          achievementsTotal: p === undefined ? undefined : p ? p.total : null,
          raw: { appId: game.appId },
        });
      }

      ctx.log.info(
        `${STEAM_ID}: ${owned.length} games, achievements read for ${now.length - failed}, ${due.length - now.length} postponed`,
      );
      return {
        batch,
        // Day-level history starts with the first sync: lifetime totals before it are a starting value.
        dataSince: toLocalDate(ctx.now),
        warnings,
        details: { games: owned.length, achievementGames: now.length - failed },
      };
    } catch (error) {
      throw toAdapterError(error);
    }
  },
};
