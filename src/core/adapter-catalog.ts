// Static description of every data source. Shared by the app (platform cards) and the
// sync script (registry). Adding a source starts here; see docs/ADDING-A-PLATFORM.md.
import type { PlatformId } from "./types";

export interface AdapterCapabilities {
  /** list of games */
  library: boolean;
  /** lifetime playtime per game */
  totalPlaytime: boolean;
  /** playtime per day */
  dailyPlaytime: boolean;
  /** trophies / achievements */
  achievements: boolean;
}

export interface AdapterInfo {
  id: string;
  platform: PlatformId;
  displayName: string;
  capabilities: AdapterCapabilities;
  /**
   * env      = GitHub secrets, only the sync script knows whether they are set
   * database = encrypted token in platform_credentials, entered in the app
   * none     = no credentials (manual import)
   */
  credentialSource: "env" | "database" | "none";
  /** Names of the GitHub secrets, for the «these secrets are missing» hint. */
  requiredEnv: string[];
  /** Guide in docs/, linked from the platform card. */
  guide: string;
  /** Phase in which the adapter is built. Until then the card shows «in Arbeit». */
  availableFromPhase: number;
}

export const ADAPTER_CATALOG: readonly AdapterInfo[] = [
  {
    id: "steam",
    platform: "steam",
    displayName: "Steam",
    capabilities: { library: true, totalPlaytime: true, dailyPlaytime: false, achievements: true },
    credentialSource: "env",
    requiredEnv: ["STEAM_API_KEY", "STEAM_ID"],
    guide: "SETUP-STEAM.md",
    availableFromPhase: 5,
  },
  {
    id: "psn",
    platform: "psn",
    displayName: "PlayStation",
    capabilities: { library: true, totalPlaytime: true, dailyPlaytime: false, achievements: true },
    credentialSource: "database",
    requiredEnv: [],
    guide: "SETUP-PLAYSTATION.md",
    availableFromPhase: 6,
  },
  {
    id: "nintendo-parental",
    platform: "nintendo",
    displayName: "Nintendo (Jugendschutz-App)",
    capabilities: { library: true, totalPlaytime: false, dailyPlaytime: true, achievements: false },
    credentialSource: "database",
    requiredEnv: [],
    guide: "SETUP-NINTENDO.md",
    availableFromPhase: 2,
  },
  {
    id: "nintendo-import",
    platform: "nintendo",
    displayName: "Nintendo (Historie importieren)",
    capabilities: { library: true, totalPlaytime: false, dailyPlaytime: true, achievements: false },
    credentialSource: "none",
    requiredEnv: [],
    guide: "SETUP-NINTENDO.md",
    availableFromPhase: 2,
  },
];

export function getAdapterInfo(id: string): AdapterInfo | undefined {
  return ADAPTER_CATALOG.find((a) => a.id === id);
}
