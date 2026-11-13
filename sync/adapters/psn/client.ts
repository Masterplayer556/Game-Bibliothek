// Thin wrapper around the open-source library psn-api (MIT). The adapter only talks to this
// interface, so it can be tested without Sony's servers and the library can be swapped.
import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getPurchasedGames,
  getTitleTrophies,
  getUserPlayedGames,
  getUserTrophiesEarnedForTitle,
  getUserTrophiesForSpecificTitle,
} from "psn-api";

export interface PsnTokens {
  accessToken: string;
  refreshToken: string;
  /** seconds */
  refreshTokenExpiresIn: number;
}

export interface PlayedTitle {
  titleId: string;
  name: string;
  imageUrl: string | null;
  category: string;
  firstPlayedDateTime: string | null;
  lastPlayedDateTime: string | null;
  /** ISO 8601 duration, e.g. PT228H56M33S */
  playDuration: string | null;
}

export interface PurchasedTitle {
  titleId: string;
  name: string;
  imageUrl: string | null;
}

export interface TrophyCounts {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
}

export interface TrophySet {
  npCommunicationId: string;
  npServiceName: "trophy" | "trophy2";
  defined: TrophyCounts;
  earned: TrophyCounts;
}

export interface TrophyDetails {
  trophyId: number;
  name: string;
  detail: string | null;
  iconUrl: string | null;
  type: string;
  hidden: boolean;
  earned: boolean;
  earnedDateTime: string | null;
  /** percent of all players, as a number */
  earnedRate: number | null;
}

export interface PsnClient {
  exchangeNpsso(npsso: string): Promise<PsnTokens>;
  refresh(refreshToken: string): Promise<PsnTokens>;
  playedGames(accessToken: string): Promise<PlayedTitle[]>;
  purchasedGames(accessToken: string): Promise<PurchasedTitle[]>;
  /** Trophy set of each title the account has trophies for, keyed by titleId. */
  trophySets(accessToken: string, titleIds: readonly string[]): Promise<Map<string, TrophySet>>;
  trophies(accessToken: string, set: TrophySet): Promise<TrophyDetails[]>;
}

const auth = (accessToken: string) => ({ accessToken });

function tokens(t: { accessToken: string; refreshToken: string; refreshTokenExpiresIn: number }): PsnTokens {
  return { accessToken: t.accessToken, refreshToken: t.refreshToken, refreshTokenExpiresIn: t.refreshTokenExpiresIn };
}

function rate(value: string | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

export const psnApiClient: PsnClient = {
  async exchangeNpsso(npsso) {
    const code = await exchangeNpssoForAccessCode(npsso);
    return tokens(await exchangeAccessCodeForAuthTokens(code));
  },

  async refresh(refreshToken) {
    return tokens(await exchangeRefreshTokenForAuthTokens(refreshToken));
  },

  async playedGames(accessToken) {
    const out: PlayedTitle[] = [];
    for (let offset = 0; offset < 5000; ) {
      const page = await getUserPlayedGames(auth(accessToken), "me", { limit: 200, offset });
      for (const t of page.titles ?? []) {
        out.push({
          titleId: t.titleId,
          name: t.localizedName || t.name,
          imageUrl: t.localizedImageUrl || t.imageUrl || null,
          category: t.category,
          firstPlayedDateTime: t.firstPlayedDateTime ?? null,
          lastPlayedDateTime: t.lastPlayedDateTime ?? null,
          playDuration: t.playDuration ?? null,
        });
      }
      if (!page.nextOffset || page.nextOffset <= offset || (page.titles ?? []).length === 0) break;
      offset = page.nextOffset;
    }
    return out;
  },

  async purchasedGames(accessToken) {
    const out: PurchasedTitle[] = [];
    for (let start = 0; start < 5000; start += 100) {
      const page = await getPurchasedGames(auth(accessToken), { size: 100, start });
      const games = page.data.purchasedTitlesRetrieve.games ?? [];
      for (const g of games) out.push({ titleId: g.titleId, name: g.name, imageUrl: g.image?.url ?? null });
      if (games.length < 100) break;
    }
    return out;
  },

  async trophySets(accessToken, titleIds) {
    const out = new Map<string, TrophySet>();
    // Sony accepts at most 5 title ids per request.
    for (let i = 0; i < titleIds.length; i += 5) {
      const batch = titleIds.slice(i, i + 5);
      const response = await getUserTrophiesForSpecificTitle(auth(accessToken), "me", { npTitleIds: batch.join(",") });
      for (const title of response.titles ?? []) {
        const set = title.trophyTitles?.[0];
        if (!set) continue;
        out.set(title.npTitleId, {
          npCommunicationId: set.npCommunicationId,
          npServiceName: set.npServiceName,
          defined: set.definedTrophies,
          earned: set.earnedTrophies,
        });
      }
    }
    return out;
  },

  async trophies(accessToken, set) {
    const options = { npServiceName: set.npServiceName };
    const [titles, earned] = await Promise.all([
      getTitleTrophies(auth(accessToken), set.npCommunicationId, "all", options),
      getUserTrophiesEarnedForTitle(auth(accessToken), "me", set.npCommunicationId, "all", options),
    ]);
    const earnedById = new Map((earned.trophies ?? []).map((t) => [t.trophyId, t]));
    return (titles.trophies ?? []).map((t) => {
      const mine = earnedById.get(t.trophyId);
      return {
        trophyId: t.trophyId,
        name: t.trophyName ?? `Trophäe ${t.trophyId}`,
        detail: t.trophyDetail ?? null,
        iconUrl: t.trophyIconUrl ?? null,
        type: t.trophyType,
        hidden: t.trophyHidden,
        earned: mine?.earned === true,
        earnedDateTime: mine?.earned ? (mine.earnedDateTime ?? null) : null,
        earnedRate: rate(mine?.trophyEarnedRate),
      };
    });
  },
};
