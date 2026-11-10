// The one place where adapters are registered.
// New source = new folder in sync/adapters/ + one line here. See docs/ADDING-A-PLATFORM.md.
import type { MetadataProvider } from "./metadata/types";
import type { PlatformAdapter } from "./types";

export const adapters: readonly PlatformAdapter[] = [
  // Phase 2: nintendoParental
  // Phase 5: steam
  // Phase 6: psn
];

export const metadataProviders: readonly MetadataProvider[] = [
  // Phase 7: igdb
];
