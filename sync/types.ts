// The adapter contract. Every data source implements PlatformAdapter and is listed in
// registry.ts. Adapters return data; they never touch the database.
import type { AdapterInfo } from "../src/core/adapter-catalog";
import type { ConnectionStatus, LocalDate, SyncBatch } from "../src/core/types";
import type { PersistSummary } from "../src/data/persist";

export type AdapterErrorKind = "auth_expired" | "rate_limited" | "network" | "unknown";

/**
 * Throw this from an adapter with a message that is safe to show in the app
 * (German, no tokens, no ids).
 */
export class AdapterError extends Error {
  readonly kind: AdapterErrorKind;
  constructor(kind: AdapterErrorKind, message: string) {
    super(message);
    this.name = "AdapterError";
    this.kind = kind;
  }
}

/** Only counts and states are logged: GitHub Actions logs of a public repo are public. */
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
}

export interface PreviousGameState {
  totalPlaytimeMinutes: number;
  lastPlayedAt: string | null;
}

export interface AdapterContext {
  /** Decrypted values from platform_credentials, by kind. */
  credentials: Readonly<Record<string, string>>;
  env: Readonly<Record<string, string | undefined>>;
  /** State after the last run, by external id. Lets an adapter skip unchanged games. */
  previousGames: ReadonlyMap<string, PreviousGameState>;
  now: Date;
  log: Logger;
  fetch: typeof fetch;
}

/** value null = delete the stored credential */
export interface CredentialUpdate {
  kind: string;
  value: string | null;
}

export interface TestResult {
  ok: boolean;
  /** Shown in the app. */
  message: string;
  credentialUpdates?: CredentialUpdate[];
  tokenExpiresAt?: string | null;
}

export interface SyncResult {
  batch: SyncBatch;
  /** Rotated tokens (PSN refresh token, …). Stored encrypted by the runner. */
  credentialUpdates?: CredentialUpdate[];
  tokenExpiresAt?: string | null;
  /** First day this source has data for. */
  dataSince?: LocalDate | null;
  warnings?: string[];
  /** Extra facts for the platform card (stored in platform_connections.details). */
  details?: Record<string, unknown>;
}

export interface PlatformAdapter extends AdapterInfo {
  /** Are the required credentials present? */
  isConfigured(ctx: AdapterContext): Promise<boolean>;
  /** For the «Verbindung testen» button. */
  testConnection(ctx: AdapterContext): Promise<TestResult>;
  sync(ctx: AdapterContext): Promise<SyncResult>;
}

export type RunMode = "sync" | "test";

export interface ConnectionPatch {
  status: ConnectionStatus;
  configured: boolean;
  lastSyncAt?: string;
  lastSuccessAt?: string;
  lastError?: string | null;
  dataSince?: LocalDate | null;
  tokenExpiresAt?: string | null;
  details?: Record<string, unknown>;
}

/** Everything the runner needs from the outside world. Faked in tests. */
export interface SyncStore {
  isEnabled(adapterId: string): Promise<boolean>;
  getCredentials(adapterId: string): Promise<Record<string, string>>;
  saveCredentials(adapterId: string, updates: readonly CredentialUpdate[]): Promise<void>;
  getPreviousGames(adapter: AdapterInfo): Promise<Map<string, PreviousGameState>>;
  saveBatch(batch: SyncBatch, now: Date): Promise<PersistSummary>;
  setConnection(adapter: AdapterInfo, patch: ConnectionPatch): Promise<void>;
}

export interface AdapterRunResult {
  adapterId: string;
  outcome: "ok" | "skipped_not_configured" | "skipped_disabled" | "error" | "auth_expired";
  message?: string;
  summary?: PersistSummary;
  warnings?: number;
}
