// Raw rows, as read from the database.
import type { TimeToBeat } from "../igdb/time-to-beat";
import type { ConnectionStatus, DeviceKind, GameStatus, LocalDate, PlatformId } from "../types";

export interface GameRow {
  id: string;
  title: string;
  cover_url: string | null;
  genres: string[] | null;
  release_year: number | null;
  igdb_id: number | null;
  /** How long the game takes (IGDB), in minutes; null = unknown. */
  time_to_beat: TimeToBeat | null;
}

export interface PlatformGameRow {
  id: string;
  game_id: string | null;
  platform: PlatformId;
  source: string;
  external_id: string;
  title: string;
  cover_url: string | null;
  device_kind: DeviceKind | null;
  owned: boolean;
  first_played_at: string | null;
  last_played_at: string | null;
  total_playtime_minutes: number;
  achievements_unlocked: number | null;
  achievements_total: number | null;
}

export interface DeviceRow {
  id: string;
  platform: PlatformId;
  kind: DeviceKind;
  label: string;
}

export interface DailyPlaytimeRow {
  platform_game_id: string;
  device_id: string;
  play_date: LocalDate;
  minutes: number;
  source: string;
  estimated: boolean;
}

export interface SnapshotRow {
  platform_game_id: string;
  taken_at: string;
  total_minutes: number;
  last_played_at: string | null;
}

export interface AchievementRow {
  platform_game_id: string;
  external_id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  unlocked_at: string | null;
  rarity_percent: number | null;
  tier: string | null;
}

export interface UserDataRow {
  game_id: string;
  status: GameStatus | null;
  favorite: boolean;
  note: string | null;
  hide_from_pile: boolean;
  hidden: boolean;
  /** 1 to 5 stars, null = not rated. */
  rating: number | null;
  /** «Durchgespielt am». */
  completed_on: LocalDate | null;
}

export interface ConnectionRow {
  adapter_id: string;
  platform: PlatformId;
  status: ConnectionStatus;
  enabled: boolean;
  configured: boolean;
  last_sync_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  data_since: LocalDate | null;
  token_expires_at: string | null;
  details: Record<string, unknown> | null;
}

export interface RawData {
  games: GameRow[];
  platformGames: PlatformGameRow[];
  devices: DeviceRow[];
  daily: DailyPlaytimeRow[];
  snapshots: SnapshotRow[];
  achievements: AchievementRow[];
  userData: UserDataRow[];
  connections: ConnectionRow[];
  settings: Record<string, unknown>;
}
