import { describe, expect, it } from "vitest";
import { isFinished, isStale, type RunStatus } from "./sync-control";

const NOW = new Date("2026-11-14T12:00:00Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

describe("sync run state", () => {
  it("knows which states are final", () => {
    const states: RunStatus[] = ["queued", "running", "success", "partial", "error"];
    expect(states.map(isFinished)).toEqual([false, false, true, true, true]);
  });

  it("treats an open run as stale after 25 minutes without news, a finished one never", () => {
    expect(isStale({ status: "running", created_at: ago(24), started_at: ago(20) }, NOW)).toBe(false);
    expect(isStale({ status: "queued", created_at: ago(26), started_at: null }, NOW)).toBe(true);
    expect(isStale({ status: "running", created_at: ago(600), started_at: ago(599) }, NOW)).toBe(true);
    expect(isStale({ status: "error", created_at: ago(600), started_at: null }, NOW)).toBe(false);
  });

  it("does not give up on a run that waited behind another one and is still within the job's time", () => {
    // queued 12 minutes behind the scheduled sync, running for 10: 22 minutes since it was created
    expect(isStale({ status: "running", created_at: ago(22), started_at: ago(10) }, NOW)).toBe(false);
    expect(isStale({ status: "running", created_at: ago(40), started_at: ago(18) }, NOW)).toBe(false);
    // a queued run that waits longer than a whole sync can take never started
    expect(isStale({ status: "queued", created_at: ago(24), started_at: null }, NOW)).toBe(false);
  });
});
