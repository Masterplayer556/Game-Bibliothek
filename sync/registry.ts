// The one place where adapters are registered.
// New source = new folder in sync/adapters/ + one line here. See docs/ADDING-A-PLATFORM.md.
import { nintendoParentalAdapter } from "./adapters/nintendo-parental/adapter";
import { psnAdapter } from "./adapters/psn/adapter";
import { steamAdapter } from "./adapters/steam/adapter";
import type { MetadataProvider } from "./metadata/types";
import type { PlatformAdapter } from "./types";

export const adapters: readonly PlatformAdapter[] = [
  nintendoParentalAdapter,
  steamAdapter,
  psnAdapter,
];

export const metadataProviders: readonly MetadataProvider[] = [
  // Phase 7: igdb
];
