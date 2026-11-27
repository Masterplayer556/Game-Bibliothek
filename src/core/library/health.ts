// Sync health: connected sources whose data is getting old.
import type { ConnectionRow } from "./rows";

export const STALE_SYNC_HOURS = 24;

/** Connected adapters whose last successful sync is too old (or that never succeeded). */
export function staleConnections(connections: readonly ConnectionRow[], now: Date): ConnectionRow[] {
  const limit = now.getTime() - STALE_SYNC_HOURS * 3600 * 1000;
  return connections.filter(
    (c) =>
      c.enabled &&
      c.configured &&
      c.status !== "not_connected" &&
      c.status !== "disabled" &&
      (!c.last_success_at || new Date(c.last_success_at).getTime() < limit),
  );
}
