// PlayStation, through the unofficial API used by the PlayStation app (library psn-api).
//
// Login: a NPSSO (copied from the browser, valid for about two months) is exchanged for an
// access token and a refresh token. Sony issues the refresh token with a fixed lifetime of
// about ten days that a refresh does not extend (checked with a real account on 13.11.2026).
// The NPSSO is therefore kept, encrypted like every token, and exchanged again whenever the
// refresh token stops working. Only when the NPSSO itself has expired does the app ask for a
// new one.
import { getAdapterInfo } from "../../../src/core/adapter-catalog";
import { normalizeTitle } from "../../../src/core/normalize-title";
import { toLocalDate } from "../../../src/core/time";
import { emptyBatch } from "../../../src/core/types";
import {
  AdapterError,
  type AdapterContext,
  type CredentialUpdate,
  type PlatformAdapter,
  type SyncResult,
  type TestResult,
} from "../../types";
import { psnApiClient, type PsnClient, type PsnTokens, type TrophyCounts, type TrophySet } from "./client";

export const PSN_ID = "psn";
export const NPSSO_KIND = "npsso";
export const REFRESH_TOKEN_KIND = "refresh_token";
/** Trophy lists are read for at most this many games per run. */
export const MAX_TROPHY_GAMES_PER_RUN = 40;

const NEW_NPSSO = "Neue NPSSO nötig: Die PlayStation-Anmeldung ist abgelaufen oder ungültig.";

/** «PT228H56M33S» or «P1DT2H» → minutes (rounded). */
export function parseDuration(value: string | null | undefined): number {
  if (!value) return 0;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(value);
  if (!match) return 0;
  const [, d = "0", h = "0", m = "0", s = "0"] = match;
  return Math.round(Number(d) * 1440 + Number(h) * 60 + Number(m) + Number(s) / 60);
}

const sum = (c: TrophyCounts) => c.bronze + c.silver + c.gold + c.platinum;

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof Error && /fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT/i.test(error.message));
}

interface Session {
  tokens: PsnTokens;
  updates: CredentialUpdate[];
}

/** Refresh token first; if that fails, a freshly entered NPSSO. */
export async function authenticate(client: PsnClient, ctx: AdapterContext): Promise<Session> {
  const refreshToken = ctx.credentials[REFRESH_TOKEN_KIND];
  const npsso = ctx.credentials[NPSSO_KIND];
  if (refreshToken) {
    try {
      const tokens = await client.refresh(refreshToken);
      return { tokens, updates: [{ kind: REFRESH_TOKEN_KIND, value: tokens.refreshToken }] };
    } catch (error) {
      if (isNetworkError(error)) throw new AdapterError("network", "PlayStation ist nicht erreichbar.");
      if (!npsso) throw new AdapterError("auth_expired", NEW_NPSSO);
    }
  }
  if (!npsso) throw new AdapterError("auth_expired", "PlayStation ist noch nicht angemeldet: Bitte die NPSSO in der App eingeben.");
  try {
    const tokens = await client.exchangeNpsso(npsso);
    return { tokens, updates: [{ kind: REFRESH_TOKEN_KIND, value: tokens.refreshToken }] };
  } catch (error) {
    if (isNetworkError(error)) throw new AdapterError("network", "PlayStation ist nicht erreichbar.");
    throw new AdapterError("auth_expired", NEW_NPSSO);
  }
}

/**
 * When the login will need a new NPSSO. With a stored NPSSO that is the NPSSO's own expiry,
 * which Sony does not tell: unknown (null). Without one it is the refresh token's.
 */
function expiry(ctx: AdapterContext, tokens: PsnTokens): string | null {
  if (ctx.credentials[NPSSO_KIND]) return null;
  return new Date(ctx.now.getTime() + tokens.refreshTokenExpiresIn * 1000).toISOString();
}

export function createPsnAdapter(client: PsnClient): PlatformAdapter {
  return {
    ...getAdapterInfo(PSN_ID)!,

    async isConfigured(ctx) {
      return Boolean(ctx.credentials[REFRESH_TOKEN_KIND] || ctx.credentials[NPSSO_KIND]);
    },

    async testConnection(ctx): Promise<TestResult> {
      const session = await authenticate(client, ctx);
      try {
        const played = await client.playedGames(session.tokens.accessToken);
        return {
          ok: true,
          message: `Verbunden: ${played.length} gespielte Spiele gefunden.`,
          credentialUpdates: session.updates,
          tokenExpiresAt: expiry(ctx, session.tokens),
        };
      } catch {
        // Keep the rotated token even if the data request failed.
        return { ok: false, message: "Anmeldung ok, aber die Spieleliste ist nicht lesbar.", credentialUpdates: session.updates };
      }
    },

    async sync(ctx): Promise<SyncResult> {
      const session = await authenticate(client, ctx);
      const token = session.tokens.accessToken;
      const warnings: string[] = [];
      const batch = emptyBatch("psn", PSN_ID);

      let played;
      try {
        played = await client.playedGames(token);
      } catch {
        throw new AdapterError("unknown", "Die Liste der gespielten Spiele ist nicht lesbar.");
      }

      // Purchases: optional. Without them every played game counts as owned.
      let purchased: Awaited<ReturnType<PsnClient["purchasedGames"]>> | null = null;
      try {
        purchased = await client.purchasedGames(token);
      } catch {
        warnings.push("Gekaufte Spiele nicht lesbar");
      }
      const purchasedIds = new Set(purchased?.map((p) => p.titleId));
      const purchasedNames = new Set(purchased?.map((p) => normalizeTitle(p.name)));
      const isOwned = (titleId: string, name: string) =>
        !purchased || purchasedIds.has(titleId) || purchasedNames.has(normalizeTitle(name));

      // Trophies: only for games whose playtime changed (all of them on the first run).
      const firstRun = ctx.previousGames.size === 0;
      const due = played
        .filter((g) => parseDuration(g.playDuration) > 0 || g.lastPlayedDateTime)
        .filter((g) => firstRun || ctx.previousGames.get(g.titleId)?.totalPlaytimeMinutes !== parseDuration(g.playDuration))
        .sort((a, b) => (b.lastPlayedDateTime ?? "").localeCompare(a.lastPlayedDateTime ?? ""));
      const now = due.slice(0, MAX_TROPHY_GAMES_PER_RUN);
      if (due.length > now.length) warnings.push(`Trophäen von ${due.length - now.length} Spielen folgen beim nächsten Sync`);

      const progress = new Map<string, { unlocked: number; total: number } | null>();
      if (now.length > 0) {
        let sets = new Map<string, TrophySet>();
        try {
          sets = await client.trophySets(token, now.map((g) => g.titleId));
        } catch {
          warnings.push("Trophäen nicht lesbar");
        }
        const seen = new Set<string>();
        let failed = 0;
        for (const game of now) {
          const set = sets.get(game.titleId);
          if (!set) {
            if (sets.size > 0) progress.set(game.titleId, null);
            continue;
          }
          progress.set(game.titleId, { unlocked: sum(set.earned), total: sum(set.defined) });
          // PS4 and PS5 versions can share one trophy list: read it once.
          if (seen.has(set.npCommunicationId)) continue;
          seen.add(set.npCommunicationId);
          try {
            for (const t of await client.trophies(token, set)) {
              batch.achievements.push({
                gameExternalId: game.titleId,
                externalId: `${set.npCommunicationId}:${t.trophyId}`,
                name: t.name,
                description: t.detail,
                iconUrl: t.iconUrl,
                unlockedAt: t.earned ? t.earnedDateTime : null,
                rarityPercent: t.earnedRate,
                tier: t.type,
                hidden: t.hidden,
              });
            }
          } catch {
            failed++;
          }
        }
        if (failed > 0) warnings.push(`Trophäen von ${failed} Spielen nicht lesbar`);
      }

      const playedIds = new Set<string>();
      for (const game of played) {
        playedIds.add(game.titleId);
        const p = progress.get(game.titleId);
        batch.games.push({
          externalId: game.titleId,
          title: game.name,
          coverUrl: game.imageUrl,
          // The PlayStation in this household is a PS5; PS4 games run on it too.
          deviceKind: "ps5",
          owned: isOwned(game.titleId, game.name),
          firstPlayedAt: game.firstPlayedDateTime,
          lastPlayedAt: game.lastPlayedDateTime,
          totalPlaytimeMinutes: parseDuration(game.playDuration),
          achievementsUnlocked: p === undefined ? undefined : p ? p.unlocked : null,
          achievementsTotal: p === undefined ? undefined : p ? p.total : null,
          raw: { titleId: game.titleId, category: game.category },
        });
      }
      // Bought but never started: important for the pile of shame.
      const unplayed = new Map<string, NonNullable<typeof purchased>[number]>();
      for (const p of purchased ?? []) {
        if (!playedIds.has(p.titleId) && !unplayed.has(p.titleId)) unplayed.set(p.titleId, p);
      }
      const playedNames = new Set(played.map((g) => normalizeTitle(g.name)));
      for (const p of unplayed.values()) {
        if (playedNames.has(normalizeTitle(p.name))) continue; // other version of a played game
        batch.games.push({
          externalId: p.titleId,
          title: p.name,
          coverUrl: p.imageUrl,
          deviceKind: "ps5",
          owned: true,
          totalPlaytimeMinutes: 0,
          raw: { titleId: p.titleId, purchasedOnly: true },
        });
      }

      ctx.log.info(
        `${PSN_ID}: ${played.length} played, ${unplayed.size} bought only, trophies read for ${now.length}`,
      );
      return {
        batch,
        credentialUpdates: session.updates,
        tokenExpiresAt: expiry(ctx, session.tokens),
        dataSince: toLocalDate(ctx.now),
        warnings,
        details: { played: played.length, purchased: purchased?.length ?? null },
      };
    },
  };
}

export const psnAdapter = createPsnAdapter(psnApiClient);
