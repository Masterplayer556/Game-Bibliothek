// Metadata providers are separate from platform adapters: they do not know what I own or
// play, they only describe games (cover, genres, year) and help to link the same game
// across platforms (same provider id = same game).
import type { DeviceKind } from "../../src/core/types";

export interface GameMetadata {
  /** Id at the provider (IGDB id). */
  providerGameId: number;
  title: string;
  coverUrl: string | null;
  genres: string[];
  releaseYear: number | null;
}

export interface LookupRequest {
  key: string;
  title: string;
  deviceKinds: DeviceKind[];
}

export interface MetadataProvider {
  id: string;
  displayName: string;
  requiredEnv: string[];
  isConfigured(env: Readonly<Record<string, string | undefined>>): boolean;
  testConnection(env: Readonly<Record<string, string | undefined>>, fetchFn: typeof fetch): Promise<{ ok: boolean; message: string }>;
  /** Best match per request key (null = nothing convincing). */
  findMany(
    env: Readonly<Record<string, string | undefined>>,
    fetchFn: typeof fetch,
    requests: readonly LookupRequest[],
  ): Promise<Map<string, GameMetadata | null>>;
}
