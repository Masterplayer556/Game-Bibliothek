import { IGDB_MIN_INTERVAL_MS, IgdbError, login, searchMany, searchGames, type IgdbSession } from "../../src/core/igdb/client";
import { pickBestMatch, searchTitle } from "../../src/core/igdb/match";
import type { GameMetadata, MetadataProvider } from "./types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function session(env: Readonly<Record<string, string | undefined>>, fetchFn: typeof fetch): Promise<IgdbSession> {
  return login(fetchFn, { clientId: env.IGDB_CLIENT_ID ?? "", clientSecret: env.IGDB_CLIENT_SECRET ?? "" });
}

export const igdbProvider: MetadataProvider & { intervalMs: number } = {
  id: "igdb",
  displayName: "IGDB",
  requiredEnv: ["IGDB_CLIENT_ID", "IGDB_CLIENT_SECRET"],
  intervalMs: IGDB_MIN_INTERVAL_MS,

  isConfigured(env) {
    return Boolean(env.IGDB_CLIENT_ID && env.IGDB_CLIENT_SECRET);
  },

  async testConnection(env, fetchFn) {
    try {
      const s = await session(env, fetchFn);
      const hits = await searchGames(s, "Hollow Knight", 1);
      return { ok: hits.length > 0, message: hits.length > 0 ? "IGDB antwortet." : "IGDB antwortet, findet aber nichts." };
    } catch (error) {
      return { ok: false, message: error instanceof IgdbError ? error.message : "IGDB ist nicht erreichbar." };
    }
  },

  async findMany(env, fetchFn, requests) {
    const out = new Map<string, GameMetadata | null>();
    if (requests.length === 0) return out;
    const s = await session(env, fetchFn);
    for (let i = 0; i < requests.length; i += 10) {
      if (i > 0) await sleep(this.intervalMs);
      const batch = requests.slice(i, i + 10);
      const results = await searchMany(s, batch.map((r) => ({ key: r.key, title: searchTitle(r.title) })));
      for (const r of batch) {
        const best = pickBestMatch(searchTitle(r.title), results.get(r.key) ?? [], r.deviceKinds);
        out.set(
          r.key,
          best
            ? { providerGameId: best.igdbId, title: best.title, coverUrl: best.coverUrl, genres: best.genres, releaseYear: best.releaseYear }
            : null,
        );
      }
    }
    return out;
  },
};
