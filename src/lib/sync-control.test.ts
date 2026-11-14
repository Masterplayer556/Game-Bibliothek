import { describe, expect, it } from "vitest";
import { isFinished, isStale, type RunStatus } from "./sync-control";

const NOW = new Date("2026-11-14T12:00:00Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

describe("sync run state", () => {
  it("knows which states are final", () => {
    const states: RunStatus[] = ["queued", "running", "success", "partial", "error"];
    expect(states.map(isFinished)).toEqual([false, false, true, true, true]);
  });

  it("treats an open run as stale after 15 minutes, a finished one never", () => {
    expect(isStale({ status: "running", created_at: ago(14) }, NOW)).toBe(false);
    expect(isStale({ status: "queued", created_at: ago(16) }, NOW)).toBe(true);
    expect(isStale({ status: "running", created_at: ago(600) }, NOW)).toBe(true);
    expect(isStale({ status: "error", created_at: ago(600) }, NOW)).toBe(false);
  });
});
