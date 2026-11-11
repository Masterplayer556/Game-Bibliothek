// Shared domain types. No runtime dependencies: used by the app and the sync script.

export const PLATFORM_IDS = ["steam", "psn", "nintendo", "manual"] as const;
// Planned later: 'minecraft_mods'
export type PlatformId = (typeof PLATFORM_IDS)[number];

export const DEVICE_KINDS = [
  "pc",
  "ps5",
  "ps4",
  "switch1",
  "switch2",
  "xbox360",
  "other",
] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];

export const CONNECTION_STATUSES = [
  "not_connected",
  "ok",
  "error",
  "auth_expired",
  "disabled",
] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const GAME_STATUSES = ["backlog", "playing", "completed", "dropped"] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

/** Postgres schema that holds every table of this app (the project may be shared). */
export const DB_SCHEMA = "game_bibliothek";

/** Source id used for demo rows, so they can be deleted in one go. */
export const DEMO_SOURCE = "demo";

/** Calendar date in Europe/Zurich, formatted YYYY-MM-DD. */
export type LocalDate = string;

// ---------------------------------------------------------------------------
// What an adapter (or the demo generator, or an import) hands to the persister.
// Adapters never write to the database themselves.
// ---------------------------------------------------------------------------

export interface DeviceInput {
  /** Stable id of the device on its platform (e.g. Nintendo deviceId, or 'pc'). */
  externalId: string;
  kind: DeviceKind;
  label: string;
}

export interface PlatformGameInput {
  externalId: string;
  title: string;
  coverUrl?: string | null;
  /** Fixed device for platforms with a single device per title. Nintendo leaves it empty. */
  deviceKind?: DeviceKind | null;
  owned?: boolean;
  firstPlayedAt?: string | null;
  lastPlayedAt?: string | null;
  /**
   * Lifetime playtime as reported by the platform. Leave undefined when the source only
   * has per-day data: the total is then derived from the daily rows.
   */
  totalPlaytimeMinutes?: number;
  /** null/undefined = the platform has no achievements (shown as «keine Erfolge», not 0/0). */
  achievementsUnlocked?: number | null;
  achievementsTotal?: number | null;
  raw?: Record<string, unknown>;
}

export interface DailyPlaytimeInput {
  gameExternalId: string;
  deviceExternalId: string;
  date: LocalDate;
  minutes: number;
  estimated?: boolean;
  details?: Record<string, unknown>;
}

export interface SnapshotInput {
  gameExternalId: string;
  takenAt: string;
  totalMinutes: number;
  lastPlayedAt?: string | null;
}

export interface AchievementInput {
  gameExternalId: string;
  externalId: string;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  unlockedAt?: string | null;
  rarityPercent?: number | null;
  tier?: string | null;
  hidden?: boolean;
}

export interface SyncBatch {
  platform: PlatformId;
  /** Adapter id, or DEMO_SOURCE. Stored in the `source` columns. */
  source: string;
  devices: DeviceInput[];
  games: PlatformGameInput[];
  dailyPlaytime: DailyPlaytimeInput[];
  achievements: AchievementInput[];
  /**
   * Explicit historic snapshots (demo data). Regular adapters leave this empty: the
   * persister writes a snapshot itself whenever a reported total changes.
   */
  snapshots?: SnapshotInput[];
}

export function emptyBatch(platform: PlatformId, source: string): SyncBatch {
  return { platform, source, devices: [], games: [], dailyPlaytime: [], achievements: [] };
}
