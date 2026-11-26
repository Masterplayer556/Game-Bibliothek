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
/**
 * Language of trophy names. German like the console and like the Steam achievements, so the
 * same achievement on PC and PS5 has the same name. Changing it re-reads every list, in
 * portions of MAX_TROPHY_GAMES_PER_RUN.
 */
export const TROPHY_LANGUAGE = "de-DE";

const NEW_NPSSO = "Neue NPSSO nötig: Die PlayStation-Anmeldung ist abgelaufen oder ungültig.";

/** «PT228H56M33S» or «P1DT2H» → minutes (rounded). */
export function parseDuration(value: string | null | undefined): number {
  if (!value) return 0;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(value);
  if (!match) return 0;
  const [, d = "0", h = "0", m = "0", s = "0"] = match;
  return Math.round(Number(d) * 1440 + Number(h) * 60 + Number(m) + Number(s) / 60);
}

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

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
        // The refresh token may have been rotated already: it goes with the error.
        throw new AdapterError("unknown", "Die Liste der gespielten Spiele ist nicht lesbar.", session.updates);
      }

      // Purchases: optional, only used to add bought but never started games. Every played
      // game counts as owned, also games from the PS Plus catalogue (Marcel's decision).
      let purchased: Awaited<ReturnType<PsnClient["purchasedGames"]>> | null = null;
      try {
        purchased = await client.purchasedGames(token);
      } catch {
        warnings.push("Gekaufte Spiele nicht lesbar");
      }

      // Trophies: for games whose playtime changed, and for every game whose list has not been
      // read in TROPHY_LANGUAGE yet (all of them on the first run). The second group is worked
      // off over several runs; the ids done so far are kept in the connection details.
      const byLastPlayed = (a: { lastPlayedDateTime: string | null }, b: { lastPlayedDateTime: string | null }) =>
        (b.lastPlayedDateTime ?? "").localeCompare(a.lastPlayedDateTime ?? "");
      const candidates = played.filter((g) => parseDuration(g.playDuration) > 0 || g.lastPlayedDateTime);
      const languageReady = ctx.previousDetails.trophyLanguage === TROPHY_LANGUAGE;
      const doneBefore = new Set(languageReady ? [] : stringList(ctx.previousDetails.trophyLanguageDone));
      const changed = candidates
        .filter((g) => ctx.previousGames.get(g.titleId)?.totalPlaytimeMinutes !== parseDuration(g.playDuration))
        .sort(byLastPlayed);
      const changedIds = new Set(changed.map((g) => g.titleId));
      const pending = languageReady
        ? []
        : candidates.filter((g) => !doneBefore.has(g.titleId) && !changedIds.has(g.titleId)).sort(byLastPlayed);
      const due = [...changed, ...pending];
      const now = due.slice(0, MAX_TROPHY_GAMES_PER_RUN);
      if (due.length > now.length) warnings.push(`Trophäen von ${due.length - now.length} Spielen folgen beim nächsten Sync`);
      const doneNow = new Set(doneBefore);

      const progress = new Map<string, { unlocked: number; total: number } | null>();
      if (now.length > 0) {
        let sets = new Map<string, TrophySet>();
        let setsRead = false;
        try {
          sets = await client.trophySets(token, now.map((g) => g.titleId));
          setsRead = true;
        } catch {
          warnings.push("Trophäen nicht lesbar");
        }
        // PS4 and PS5 versions can share one trophy list: it is read once and stored with
        // each version, so every entry has its list (the app counts a shared list once).
        const lists = new Map<string, Promise<Awaited<ReturnType<PsnClient["trophies"]>>>>();
        let failed = 0;
        for (const game of now) {
          const set = sets.get(game.titleId);
          if (!set) {
            if (sets.size > 0) progress.set(game.titleId, null);
            if (setsRead) doneNow.add(game.titleId); // no trophies: nothing to translate
            continue;
          }
          progress.set(game.titleId, { unlocked: sum(set.earned), total: sum(set.defined) });
          try {
            if (!lists.has(set.npCommunicationId)) lists.set(set.npCommunicationId, client.trophies(token, set, TROPHY_LANGUAGE));
            const trophies = await lists.get(set.npCommunicationId)!;
            doneNow.add(game.titleId);
            for (const t of trophies) {
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
          owned: true,
          firstPlayedAt: game.firstPlayedDateTime,
          lastPlayedAt: game.lastPlayedDateTime,
          totalPlaytimeMinutes: parseDuration(game.playDuration),
          achievementsUnlocked: p === undefined ? undefined : p ? p.unlocked : null,
          achievementsTotal: p === undefined ? undefined : p ? p.total : null,
          raw: { titleId: game.titleId, category: game.category },
        });
      }
      // Bought but never started: they belong in the library too («Nie gespielt»).
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
        details: {
          played: played.length,
          purchased: purchased?.length ?? null,
          // Every list is in TROPHY_LANGUAGE once all candidates are done.
          ...(languageReady || candidates.every((g) => doneNow.has(g.titleId))
            ? { trophyLanguage: TROPHY_LANGUAGE }
            : { trophyLanguageDone: [...doneNow] }),
        },
      };
    },
  };
}

export const psnAdapter = createPsnAdapter(psnApiClient);
