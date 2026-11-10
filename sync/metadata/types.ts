// Metadata providers are separate from platform adapters: they do not know what I own or
// play, they only describe games (cover, genres, year) and help to link the same game
// across platforms.
import type { PlatformId } from "../../src/core/types";

export interface GameMetadata {
  /** Id at the provider (IGDB id). Same id = same game. */
  providerGameId: number;
  title: string;
  coverUrl: string | null;
  genres: string[];
  releaseYear: number | null;
}

export interface MetadataProvider {
  id: string;
  displayName: string;
  requiredEnv: string[];
  isConfigured(env: Readonly<Record<string, string | undefined>>): boolean;
  testConnection(): Promise<{ ok: boolean; message: string }>;
  /** Best match for a title, or null. Results are cached by the caller. */
  findGame(title: string, platform: PlatformId): Promise<GameMetadata | null>;
  /** For «Anderes Spiel wählen» on the detail page. */
  searchGames(query: string): Promise<GameMetadata[]>;
}
